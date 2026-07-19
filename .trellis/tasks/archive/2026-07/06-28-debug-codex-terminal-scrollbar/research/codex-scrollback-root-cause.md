# Research: Codex scrollback root cause

- **Query**: CLI-Manager 中 Codex 在本项目终端看不到历史消息、没有滚动条的可能根因；重点查看 `XTermTerminal.tsx` scrollback/隐藏缓冲/viewport DOM/CSS，`terminalStore.ts` Codex 启动命令与 PTY env，`projectStartupCommand.ts` 的 `--no-alt-screen` 注入，以及相关 CSS。
- **Scope**: internal
- **Date**: 2026-06-29

## Findings

### Files Found

| File Path | Description |
|---|---|
| `.trellis/tasks/06-28-debug-codex-terminal-scrollbar/prd.md` | 当前任务 PRD：目标是只加诊断日志，不修行为；需要区分 alternate buffer、baseY 不增长、隐藏缓冲截断、DOM/CSS 滚动指标问题。 |
| `src/components/XTermTerminal.tsx` | xterm 实例创建、scrollback 设置、隐藏 Tab 输出缓冲、PTY 输出写入、viewport DOM 查询和容器样式。 |
| `src/stores/terminalStore.ts` | PTY 创建、启动命令延迟写入、Codex 相关命令归一化调用、分屏/恢复路径、传给后端的 envVars。 |
| `src/lib/projectStartupCommand.ts` | Codex 启动命令归一化：给直连 Codex 命令注入 `--no-alt-screen`，给空 startup_cmd 的 exact Codex 项目生成启动命令。 |
| `src/components/TerminalTabs.tsx` | Pane/Tab 可见性控制；隐藏非当前 pane tab 时给 `XTermTerminal` 传 `isVisible=false`。 |
| `src/components/SplitTerminalView.tsx` | 分屏布局保持 pane child key 稳定，避免分屏导致 XTerm remount。 |
| `src/styles/components.css` | 全局滚动条样式与 `.ui-terminal-bg-layer .xterm .xterm-viewport` 的专门样式。 |
| `src/stores/settingsStore.ts` | terminal scrollback 行数默认值、上下限与持久化字段。 |
| `src-tauri/src/commands/terminal.rs` | `pty_create` 命令：注入 `CLI_MANAGER_TAB_ID`、hook env 与 Codex provider env 后交给 `PtyManager.create`。 |
| `src-tauri/src/pty/manager.rs` | PTY 后端：shell 解析、env 注入、ConPTY 创建、reader 输出事件、resize。 |
| `.trellis/spec/frontend/component-guidelines.md` | 终端分屏、xterm Windows PTY、scrollback 丢失相关项目约定。 |
| `.trellis/spec/backend/ccswitch-integration-contracts.md` | Codex provider launch contract：空 startup_cmd 的 exact Codex 项目应启动 `codex --profile ... --no-alt-screen`。 |

### Code Patterns

#### 1. xterm scrollback 已配置，默认 5000 行，可热更新

`src/stores/settingsStore.ts:56-58` 定义：

```ts
export const TERMINAL_SCROLLBACK_ROWS_MIN = 1000;
export const TERMINAL_SCROLLBACK_ROWS_MAX = 50000;
export const TERMINAL_SCROLLBACK_ROWS_DEFAULT = 5000;
```

`src/components/XTermTerminal.tsx:298-300` 读取设置并据此计算隐藏缓冲上限：

```ts
const terminalScrollbackRows = useSettingsStore((s) => s.terminalScrollbackRows);
const inactiveBufferLimitRef = useRef(getInactiveBufferLimit(terminalScrollbackRows));
inactiveBufferLimitRef.current = getInactiveBufferLimit(terminalScrollbackRows);
```

`src/components/XTermTerminal.tsx:837-848` 创建 `Terminal` 时设置 `scrollback: terminalScrollbackRows`，并开启 Windows/ConPTY 兼容项：

```ts
const terminal = new Terminal({
  cols: 80,
  rows: 24,
  ...
  scrollback: terminalScrollbackRows,
  scrollOnEraseInDisplay: true,
  allowProposedApi: true,
  windowsPty: { backend: "conpty" },
  ...
});
```

`src/components/XTermTerminal.tsx:788-790` 在设置变化时热更新：

```ts
if (terminal.options.scrollback !== terminalScrollbackRows) {
  terminal.options.scrollback = terminalScrollbackRows;
}
```

结论：静态代码层面没有发现 scrollback 被设为 0 或被 CSS 直接禁用。若看不到历史，更像是 xterm `buffer.active.baseY` 没增长、处于 alternate buffer，或历史未进入 xterm 而被隐藏缓冲截断。

#### 2. 隐藏 Tab 不写 xterm，改存 bounded ring buffer；长输出会丢前缀

隐藏缓冲常量在 `src/components/XTermTerminal.tsx:45-50`：

```ts
const ACTIVE_WRITE_FRAME_BUDGET = 64 * 1024;
const INACTIVE_BUFFER_MIN_CHARS = 256 * 1024;
const INACTIVE_BUFFER_MAX_CHARS = 8 * 1024 * 1024;
const INACTIVE_BUFFER_CHARS_PER_SCROLLBACK_ROW = 256;
```

上限计算在 `src/components/XTermTerminal.tsx:138-141`：

```ts
const getInactiveBufferLimit = (scrollbackRows: number) => Math.min(
  INACTIVE_BUFFER_MAX_CHARS,
  Math.max(INACTIVE_BUFFER_MIN_CHARS, scrollbackRows * INACTIVE_BUFFER_CHARS_PER_SCROLLBACK_ROW)
);
```

PTY 输出路径在 `src/components/XTermTerminal.tsx:1144-1172`：可见时进 `pendingChunks` 后写 xterm；不可见时直接 `stashInactiveText(text)`。

```ts
const flushPendingWrites = () => {
  ...
  if (isVisibleRef.current) {
    enqueueActiveWrite(combined);
  } else {
    stashInactiveText(combined);
  }
};
...
if (isVisibleRef.current) {
  pendingChunks.push(text);
  ...
} else {
  // Tab hidden — stash to a bounded ring buffer; flush when reactivated
  stashInactiveText(text);
}
```

`stashInactiveText` 在 `src/components/XTermTerminal.tsx:1120-1143` 明确保留尾部、裁剪头部：

```ts
if (text.length >= maxBufferChars) {
  const suffix = text.slice(-maxBufferChars);
  inactiveBufferRef.current = [suffix];
  inactiveBufferSizeRef.current = suffix.length;
  return;
}
...
while (inactiveBufferSizeRef.current > maxBufferChars && inactiveBufferRef.current.length > 0) {
  const overflow = inactiveBufferSizeRef.current - maxBufferChars;
  const head = inactiveBufferRef.current[0];
  ...
  inactiveBufferRef.current[0] = head.slice(overflow);
  inactiveBufferSizeRef.current -= overflow;
}
```

重新可见时在 `src/components/XTermTerminal.tsx:800-817` flush：

```ts
if (!wasVisible && inactiveBufferRef.current.length > 0 && terminalRef.current) {
  const combined = inactiveBufferRef.current.join("");
  inactiveBufferRef.current = [];
  inactiveBufferSizeRef.current = 0;
  enqueueActiveWrite(combined);
}
```

结论：如果 Codex 会话在非当前 pane tab、历史页打开、pane fullscreen 隐藏、或布局不可见期间大量输出，早期内容不会进入 xterm scrollback，只会进入前端隐藏缓冲；超过上限后只保留尾部。因此“历史消息看不到”可能不是 xterm scrollback 失效，而是隐藏期输出没有完整写入 xterm。

#### 3. 可见性由 pane active tab 和 history/layout 状态决定

`src/components/TerminalTabs.tsx:1235-1255`：同一 pane 中非 active session 的 DOM `display:none`，同时 `XTermTerminal.isVisible` 只在不是 history、布局可见、且是 pane active session 时为 true。

```tsx
{paneSessions.map((session) => (
  <div
    key={session.id}
    className="absolute inset-0"
    style={{ display: session.id === pane.activeSessionId ? "block" : "none" }}
  >
    ...
    <XTermTerminal
      sessionId={session.id}
      isActive={!historyActive && session.id === activeSessionId}
      isVisible={!historyActive && isLayoutVisible && session.id === pane.activeSessionId}
      ...
    />
```

`src/components/SplitTerminalView.tsx:171-180`：pane fullscreen 时非 fullscreen leaf `display:none`，但 child key 是 `leaf.id`，正常不会因几何变化 remount：

```tsx
<div
  key={leaf.id}
  className="ui-terminal-split-child absolute min-h-0 min-w-0 overflow-hidden"
  style={{
    ...rectStyle(isFullscreenLeaf ? fullscreenRect : rect),
    display: isHiddenByFullscreen ? "none" : undefined,
    zIndex: isFullscreenLeaf ? 20 : undefined,
  }}
>
  {renderLeaf(leaf)}
</div>
```

`.trellis/spec/frontend/component-guidelines.md:347-351` 说明曾经的风险：分屏如果导致 `XTermTerminal` remount，会销毁 xterm 内存 scrollback；现约定使用 flat absolute positioning 保持组件 identity。

结论：当前分屏实现已规避常见 remount 丢 scrollback 路径；但非 active pane tab / history workspace / fullscreen-hidden pane 仍会触发隐藏缓冲逻辑。

#### 4. active 写入路径是异步分帧；scrollback 是否增长取决于 xterm 实际解析后的 buffer

`src/components/XTermTerminal.tsx:717-748` 每帧按 64KB budget 调 `terminal.write`，并在 write callback 中做 TUI 背景 normalization：

```ts
const writeTerminalChunk = (chunk: string) => {
  terminal.write(chunk, () => {
    if (terminalRef.current !== terminal) return;
    normalizeTuiComposerBackground(terminal);
    scheduleTuiComposerBackgroundNormalization(terminal);
  });
};
```

没有现有日志记录 `terminal.buffer.active.type`、`baseY`、`viewportY`、viewport DOM 的 `scrollHeight/clientHeight/scrollTop`。

结论：仅靠代码不能区分“Codex 清屏/重绘导致 baseY 不涨”和“DOM viewport 有 scrollHeight 但滚动条不可见”。这正是 PRD 要求加诊断日志的缺口。

#### 5. Codex `--no-alt-screen` 注入存在，但只覆盖“直接以 codex 开头”的自定义 startup_cmd

`src/lib/projectStartupCommand.ts:4-7`：

```ts
const CODEX_NO_ALT_SCREEN_ARG = "--no-alt-screen";
const DIRECT_CODEX_COMMAND_PATTERN = /^(\s*codex(?:\.(?:cmd|exe|ps1))?)(?=\s|$)/i;
```

`src/lib/projectStartupCommand.ts:25-34`：只有匹配 `DIRECT_CODEX_COMMAND_PATTERN` 的命令会在开头 `codex` 后插入 `--no-alt-screen`。

```ts
export function normalizeDirectCodexStartupCommand(command?: string): string | undefined {
  const trimmed = command?.trim();
  if (!trimmed) return undefined;
  if (hasNoAltScreenArg(trimmed)) return trimmed;

  const match = DIRECT_CODEX_COMMAND_PATTERN.exec(trimmed);
  if (!match) return trimmed;

  return `${match[1]} ${CODEX_NO_ALT_SCREEN_ARG}${trimmed.slice(match[1].length)}`;
}
```

`src/lib/projectStartupCommand.ts:46-68`：项目 `startup_cmd` 非空时返回 `normalizeDirectCodexStartupCommand(startupCmd)`；为空时按 `cli_tool` 生成命令，并对包含 Codex 的命令追加 `--no-alt-screen`。

```ts
const startupCmd = project.startup_cmd.trim();
if (startupCmd) return normalizeDirectCodexStartupCommand(startupCmd);
...
if (isCodexStartupCommand(command) && !hasNoAltScreenArg(command)) {
  return `${command} ${CODEX_NO_ALT_SCREEN_ARG}`;
}
```

相关调用：

- `src/components/sidebar/index.tsx:80-91` 通过 `resolveProjectStartupCommand(project)` 构造项目启动 options。
- `src/components/CommandPalette.tsx:155-170` 创建项目终端时传入 `resolveProjectStartupCommand(p)`。
- `src/components/TerminalTabs.tsx:320-331` 分屏选择项目时使用 `resolveProjectStartupCommand(project)`。
- `src/components/HistoryWorkspace.tsx:93-97` Codex 历史 resume 命令固定为 `codex resume --no-alt-screen ${sessionId}`。
- `src/components/TerminalTabs.tsx:1725-1733` duplicate session 时对已有 `session.startupCmd` 再调用 `normalizeDirectCodexStartupCommand`。
- `src/stores/terminalStore.ts:1298-1300` restoreSessions 路径也会 normalize。

结论：exact Codex 项目且无自定义启动命令时，`--no-alt-screen` 覆盖较好；自定义 startup_cmd 若是 `cmd /c codex`、`powershell -Command codex`、`pnpm codex`、别名/函数间接启动 Codex，当前正则不会注入 `--no-alt-screen`，仍可能进入 alternate screen，导致 xterm normal buffer 没有历史滚动条。

#### 6. `terminalStore.ts` 写启动命令到 PTY，但前端未显式设置 TERM

`src/stores/terminalStore.ts:722-735` 创建普通 session：

```ts
const resolvedShell = resolveShellForPty(shell, !!projectId, os);
const launchStartupCmd = prepareStartupCommandForPty(startupCmd, resolvedShell);
...
sessionId = await invoke<string>("pty_create", {
  cwd: cwd ?? null,
  envVars: buildPtyEnvVars(envVars ?? null, resolvedShell),
  shell: resolvedShell,
  hookEnvEnabled: await shouldEnableHookEnv(),
  codexProvider: getCodexProviderLaunchConfig(projectId, startupCmd),
});
```

启动命令在 `src/stores/terminalStore.ts:780-792` 延迟 500ms 写入 PTY：

```ts
if (launchStartupCmd) {
  setTimeout(() => {
    invoke("pty_write", { sessionId, data: launchStartupCmd + "\r" }).catch(...);
  }, 500);
}
```

分屏路径同样在 `src/stores/terminalStore.ts:1029-1046` 创建 PTY，并在 `src/stores/terminalStore.ts:1093-1105` 写启动命令。

`buildPtyEnvVars` 在 `src/stores/terminalStore.ts:682-690` 只处理 `CLI_MANAGER_SHELL_RUNTIME_MONITORING`：

```ts
function buildPtyEnvVars(envVars?: Record<string, string> | null, shell?: string | null): Record<string, string> | null {
  const next = { ...(envVars ?? {}) };
  if (isShellRuntimeMonitoringEnabled() && supportsShellRuntimeInjection(shell)) {
    next[SHELL_RUNTIME_MONITORING_ENV] = "1";
  } else {
    delete next[SHELL_RUNTIME_MONITORING_ENV];
  }
  return Object.keys(next).length > 0 ? next : null;
}
```

后端 `src-tauri/src/commands/terminal.rs:20-26` 注入 `CLI_MANAGER_TAB_ID` 和 hook env；未看到 TERM 注入。

```rust
let mut env_vars = env_vars.unwrap_or_default();
apply_codex_provider_launch_env(&app_handle, codex_provider, &mut env_vars).await?;
env_vars.insert("CLI_MANAGER_TAB_ID".to_string(), session_id.clone());
if hook_env_enabled.unwrap_or(false) {
    claude_hook_bridge.apply_env(&session_id, &mut env_vars);
}
```

后端 `src-tauri/src/pty/manager.rs:396-400` 原样把 envVars 传给 `CommandBuilder`：

```rust
if let Some(vars) = env_vars {
    for (k, v) in vars {
        cmd.env(k, v);
    }
}
```

结论：本项目没有在前端或后端显式设置 `TERM`。Codex 是否进入 alternate screen、是否认为终端支持滚动/alternate buffer，取决于 shell/portable_pty/ConPTY/用户环境的默认 TERM 与 Codex 自身检测。需要运行时证据记录 Codex 进程实际环境中的 `TERM`、`NO_COLOR`/`COLORTERM` 等，而当前代码不能直接证明。

#### 7. CSS 没有发现隐藏 `.xterm-viewport` 滚动条的规则

全局滚动条样式 `src/styles/components.css:1487-1510`：

```css
:root {
  --ui-scrollbar-size: 10px;
  --ui-scrollbar-thumb: var(--border);
  --ui-scrollbar-track: transparent;
}

* {
  scrollbar-width: thin;
  scrollbar-color: var(--ui-scrollbar-thumb) var(--ui-scrollbar-track);
}

*::-webkit-scrollbar {
  width: var(--ui-scrollbar-size);
  height: var(--ui-scrollbar-size);
}
```

`.xterm-viewport` 专门样式 `src/styles/components.css:1512-1540`：

```css
.diff-code-scroll,
.ui-thin-scroll,
.ui-terminal-bg-layer .xterm .xterm-viewport {
  scrollbar-width: thin;
  scrollbar-color: var(--ui-scrollbar-thumb) var(--ui-scrollbar-track);
}
...
.ui-terminal-bg-layer .xterm .xterm-viewport {
  scrollbar-gutter: stable;
}
```

隐藏滚动条规则只命中 terminal tab 横向滚动：`src/styles/components.css:392-421` 的 `.ui-terminal-tab-scroll { scrollbar-width: none; }` 和 `.ui-terminal-tab-scroll::-webkit-scrollbar { display: none; }`，未命中 `.xterm-viewport`。

`src/components/XTermTerminal.tsx:1820-1903` 外层 wrapper 和 container 都是 `overflow-hidden`：

```tsx
<div className="ui-terminal-bg-layer relative h-full w-full overflow-hidden" ...>
  ...
  <div ref={containerRef} className="h-full w-full overflow-hidden pl-2" />
</div>
```

但 xterm 自己创建的 `.xterm-viewport` 是内部滚动容器；外层 `overflow-hidden` 不等同于隐藏 viewport 滚动条。

结论：代码层面没有发现 CSS 直接把 `.xterm-viewport` scrollbar 设为 `none` 或 `display:none`。若运行时 viewport 的 `scrollHeight > clientHeight` 但滚动条不可见，需要检查 computed style、xterm 内部 DOM 尺寸、WebView overlay scrollbar 行为，而不是现有 CSS 选择器。

#### 8. 项目已有文档明确承认 Codex TUI 清屏/重绘不保证全部进入 scrollback

`src/components/settings/pages/ThemeSettingsPage.tsx:373-378` 给用户的 tooltip 文案写明：

```tsx
{text("Codex TUI 限制：Codex 主动清屏/重绘的内容不保证全部进 scrollback，但能明显改善普通回滚长度。", "Codex TUI limitation: content cleared/redrawn by Codex may not fully enter scrollback, but normal scrollback length improves.")}
```

这与 PRD 中的诊断目标一致：需要区分“normal buffer exists but `baseY` does not grow because the app clears/redraws”。

### Most Likely Root Causes

1. **最高概率：Codex/TUI 清屏或 alternate screen 使 xterm normal buffer 的 `baseY` 不增长。**
   - 证据：项目设置页已明确说明 Codex 主动清屏/重绘内容不保证进入 scrollback（`ThemeSettingsPage.tsx:373-378`）。
   - 证据：当前缺少 xterm buffer type/baseY/viewportY 诊断，无法判断是否在 alternate buffer（`XTermTerminal.tsx` 只创建/写入，没有日志）。
   - 证据：`--no-alt-screen` 只覆盖直接 `codex...` 启动命令；间接自定义命令不会自动注入（`projectStartupCommand.ts:25-34`）。

2. **较高概率：后台/隐藏期间的 Codex 输出只进 bounded inactive buffer，超限裁剪前缀，导致恢复可见后历史不完整。**
   - 证据：非可见 Tab 输出走 `stashInactiveText`，上限由 scrollbackRows 推导且最大 8MB（`XTermTerminal.tsx:1120-1143`）。
   - 证据：同 pane 非 active tab、historyActive、layout hidden 会让 `isVisible=false`（`TerminalTabs.tsx:1235-1255`）。
   - 证据：flush 时只把保留下来的 suffix 写回 xterm（`XTermTerminal.tsx:800-810`）。

3. **中等概率：自定义 Codex 启动命令未注入 `--no-alt-screen`。**
   - 证据：`normalizeDirectCodexStartupCommand` 只匹配命令开头是 `codex`/`codex.cmd`/`codex.exe`/`codex.ps1`（`projectStartupCommand.ts:7, 25-34`）。
   - 证据：exact Codex 且空 startup_cmd 的项目会生成 `codex ... --no-alt-screen`（`projectStartupCommand.ts:46-68`），但非空 startup_cmd 只做 direct normalize。
   - 证据：ccswitch spec 要求空 startup_cmd 的 exact Codex 项目启动 `codex --profile ... --no-alt-screen`（`.trellis/spec/backend/ccswitch-integration-contracts.md:280-306`）。

4. **较低概率：CSS 直接隐藏 `.xterm-viewport` 滚动条。**
   - 证据：搜索到的隐藏滚动条规则作用于 `.ui-terminal-tab-scroll`，不是 `.xterm-viewport`（`components.css:392-421`）。
   - 证据：`.xterm-viewport` 规则是 thin scrollbar 和 stable gutter（`components.css:1512-1540`）。
   - 仍需运行时确认：computed style、viewport DOM metrics、WebView overlay scrollbar 行为。

5. **待证：TERM/env 导致 Codex 终端能力检测不同。**
   - 证据：`terminalStore.ts` 与后端 `pty_create` 未显式注入 TERM（`terminalStore.ts:682-690`；`terminal.rs:20-26`；`manager.rs:396-400`）。
   - 但当前静态代码不能证明运行时 TERM 是什么，也不能证明 Codex 因 TERM 进入 alternate screen。

### External References

未做外部搜索。该问题按任务要求属于内部代码路径研究；当前结论全部来自项目源码与 spec。

### Related Specs

- `.trellis/tasks/06-28-debug-codex-terminal-scrollbar/prd.md` — 当前任务定义，只加诊断日志，区分 alternate buffer、baseY 不增长、hidden-buffer trim、DOM/CSS viewport metrics。
- `.trellis/spec/frontend/component-guidelines.md:347-398` — 终端分屏必须保持 `XTermTerminal` identity，避免 remount 丢失 xterm scrollback。
- `.trellis/spec/frontend/component-guidelines.md:808-844` — Windows PTY + xterm 配置要求 `scrollOnEraseInDisplay`、`windowsPty: { backend: "conpty" }`，并要求手动确认 Windows/PowerShell scrollback。
- `.trellis/spec/backend/ccswitch-integration-contracts.md:280-306` — Codex provider launch command 合约，空 startup_cmd 的 exact Codex 项目应包含 `--profile` 与 `--no-alt-screen`。

## Caveats / Not Found

### 还缺的运行时证据

1. **xterm buffer 状态**：`terminal.buffer.active.type` 是否是 `alternate`，`baseY` 是否增长，`viewportY` 是否跟随。
2. **viewport DOM 指标**：`.xterm-viewport` 的 `scrollHeight`、`clientHeight`、`scrollTop`、computed `overflowY`、`scrollbarWidth`/WebKit scrollbar 实际显示。
3. **隐藏缓冲裁剪证据**：进入隐藏状态时累计输出字节/字符数、是否触发 `stashInactiveText` 的 suffix 裁剪、flush 时写回多少字符。
4. **启动命令最终文本**：实际写入 PTY 的 Codex 命令是否包含 `--no-alt-screen`，尤其是用户自定义 startup_cmd、duplicate、restore、history resume、split picker 路径。
5. **PTY 环境**：Codex 进程实际看到的 `TERM`、`COLORTERM`、`WT_SESSION`、`ConEmuANSI` 等终端能力相关环境变量。
6. **Codex 行为**：Codex 是否持续发 `CSI ?1049h/l`、`CSI 2J/3J`、或其它清屏/alternate-buffer 控制序列；现有代码没有记录原始 PTY 内容，PRD 也要求避免记录 raw content/secrets。

### Not Found

- 未发现 `.xterm-viewport` 被 CSS 设置为 `scrollbar-width: none` 或 `::-webkit-scrollbar { display: none }`。
- 未发现 `XTermTerminal` 构造 effect 依赖设置项导致 scrollback 因普通设置变化而重建；构造 effect 依赖是 `[sessionId]`（`XTermTerminal.tsx:833-1640`），符合 spec 中“不因设置变化 recreate Terminal”的约定。
- 未发现前端或后端显式设置 `TERM`。
