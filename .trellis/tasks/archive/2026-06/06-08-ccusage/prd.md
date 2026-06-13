# 使用 ccusage 做用量分析

## Goal

在 CLI-Manager 中新增一套基于 `ccusage` 的用量分析能力。用户在设置中默认关闭该能力；开启后应用负责检查/准备 `bunx ccusage`，之后分析看板切换到独立的 ccusage 看板，支持在 Claude / Codex / 全部 三种来源之间切换并展示 ccusage 产出的本地用量统计。旧分析看板保留代码但在该模式下隐藏，避免在原看板上继续堆逻辑。

## What I already know

* 用户要求设置中新增开关，默认关闭。
* 用户要求开启后安装/准备 `bunx ccusage`；如果没有 `bunx`，先安装 Bun/bunx，并使用国内镜像源。
* 用户要求分析看板使用 ccusage 的数据。
* 用户要求旧分析看板隐藏，不在原分析看板上修改；需要两套分析看板分离。
* 用户希望 ccusage 数据可本地持久化，避免每次打开长时间等待；可考虑内存数据库。
* 当前旧分析看板入口：`src/components/sidebar/SidebarFooter.tsx` → `src/App.tsx` → `src/components/stats/StatsPanel.tsx`。
* 当前旧看板数据来自 `src/stores/historyStore.ts` 调用 Tauri command `history_get_stats`，后端实现位于 `src-tauri/src/commands/history.rs`。
* 当前设置持久化走 `src/stores/settingsStore.ts` + `tauri-plugin-store` 的 `settings.json`。
* 设置页 tab id 有稳定性约束，若只是新增设置项，优先放入现有 `general` 或合适页面，不随意重命名现有 tab id。
* Tauri command 边界需要校验外部输入，尤其是路径和命令参数。

## Assumptions (temporary)

* `bunx` 随 Bun 安装提供；检查 `bunx --version` 或 `bun --version` 可判断可用性。
* ccusage 不需要作为项目依赖加入 `package.json`，优先用 `bunx ccusage` 运行，避免污染项目依赖。
* ccusage MVP 数据源覆盖 Claude Code 与 Codex CLI 本地日志；来源切换提供 `claude`、`codex`、`all` 三档，其中 Codex 解析依赖 ccusage 的 Codex 数据源支持。
* 国内镜像源优先使用 npm registry 镜像，例如 `https://registry.npmmirror.com`。
* “内存数据库”更适合运行期加速；跨重启持久化仍应使用磁盘 SQLite 或本地 JSON 缓存，否则无法真正避免下次启动等待。

## Research Notes

### ccusage

* `bunx ccusage` 可直接运行 ccusage，无需全局安装 ccusage 包。
* ccusage 支持 `daily`、`monthly`、`session`、`blocks` 等报告。
* 所有主要报告可加 `--json` 输出结构化 JSON。
* `daily --json` 返回 `daily` 与 `totals`，包含 `inputTokens`、`outputTokens`、`cacheCreationTokens`、`cacheReadTokens`、`totalTokens`、`totalCost`、`modelsUsed`、`modelBreakdowns` 等字段。
* `daily --instances --json` 可按项目/实例分组。
* 可通过 `CLAUDE_CONFIG_DIR` 指定 Claude 配置目录。
* ccusage 支持统一报告 `ccusage daily --json`，也支持聚焦来源：`ccusage claude daily --json`、`ccusage codex daily --json`。
* Codex 数据源默认读取 `~/.codex`，可通过 `CODEX_HOME` 覆盖；Codex 支持仍应按 Beta/实验性能力处理，避免把本地估算当官方账单。
* 支持 `--offline`，避免运行期联网取价格数据；支持 `--mode auto|calculate|display` 控制成本计算口径。

### Bun / bunx

* Bun 官方文档说明 Windows 可通过 PowerShell 安装脚本、Scoop 或 `npm install -g bun` 安装。
* `bunx` 类似 `npx`：先找本地包，再从 npm 自动安装并缓存到 Bun 全局缓存。
* `bun install` 兼容 `.npmrc` registry；`npm install -g bun --registry=<mirror>` 可用 npm registry 镜像安装 Bun 包。

### Constraints from this repo

* 设置持久化字段需要默认值与迁移逻辑，参考 `settingsStore.ts` 的 `DEFAULTS` 与 `migrate*` 模式。
* 新 Tauri command 需要注册到 `src-tauri/src/commands/mod.rs` 和 `src-tauri/src/lib.rs`。
* 当前 `src-tauri/capabilities/default.json` 已有 `shell:default`，但新命令仍应只暴露必要 command，不开放任意命令执行。
* CLI-Manager 桌面 UI 运行态需要人工验收，AI 侧只做静态检查、typecheck、cargo check 等。

## Requirements (evolving)

* 新增持久化设置：`ccusageAnalyticsEnabled`，默认 `false`。
* 设置 UI 新增 ccusage 用量分析开关，关闭时仍使用/展示旧分析看板入口行为；开启后分析入口打开新版 ccusage 看板。
* 新旧看板组件分离：旧 `StatsPanel` 不承载 ccusage 逻辑；新增 `CcusageStatsPanel` 或同等独立组件。
* 新增后端 ccusage 能力模块，只允许执行固定白名单命令：检查 bun/bunx、安装 Bun/bunx、运行 `bunx ccusage [claude|codex] <known-report> --json` 或 `bunx ccusage <known-report> --json` 统一报告。
* 开启 ccusage 能力后，需要检查工具状态；缺少 Bun/bunx 时必须先弹出二次确认，用户确认后才执行安装，并提示安装进度/错误。
* ccusage 数据读取优先走缓存；手动刷新时重新运行 ccusage。
* 新版 ccusage 看板提供来源切换：Claude、Codex、全部；默认展示全部。
* Claude 来源运行 ccusage 的 `claude` 聚焦报告，Codex 来源运行 `codex` 聚焦报告，全部来源运行 ccusage 统一报告。
* MVP 只覆盖当前要求：开关、工具准备、SQLite+内存缓存、独立 ccusage 看板、来源切换、手动刷新和错误展示。
* ccusage 数据缓存采用 SQLite 持久化 + 运行期内存缓存，避免每次打开看板都等待完整扫描，并保证重启后仍可先展示缓存。
* ccusage 命令运行时应按来源传入环境变量：Claude 优先复用现有 `claudeHookConfigDir` 作为 `CLAUDE_CONFIG_DIR`；Codex 优先复用现有 `codexHookConfigDir` 作为 `CODEX_HOME`；未配置时使用 ccusage 默认目录。
* ccusage 运行建议使用 `--json --offline`，降低运行期联网和不可控等待。

## Acceptance Criteria (evolving)

* [x] 新安装/首次启动时，ccusage 开关默认关闭。
* [x] 开关关闭时，分析入口不显示 ccusage 看板。
* [x] 开关开启且工具可用时，分析入口打开新版 ccusage 看板。
* [x] 新版 ccusage 看板不修改旧 `StatsPanel` 的统计口径和布局。
* [x] 新版 ccusage 看板支持 Claude / Codex / 全部 三种来源切换。
* [x] 选择 Claude 时只展示 ccusage Claude 聚焦报告；选择 Codex 时只展示 ccusage Codex 聚焦报告；选择全部时展示 ccusage 统一报告。
* [x] 没有 bunx 时，UI 先显示二次确认；用户确认后才进入正在安装/安装失败/安装完成状态。
* [x] ccusage JSON 解析失败时，UI 显示明确错误，不崩溃。
* [x] 有 SQLite 缓存时优先展示缓存，并提供刷新入口。
* [x] 重启应用后，在未刷新前仍能展示上次成功的 ccusage 缓存数据。
* [x] 刷新后缓存更新时间可见。
* [x] `npx tsc --noEmit` 通过。
* [x] `cd src-tauri && cargo check` 通过。

## Definition of Done

* Tests added/updated where practical for pure parsers/migrators.
* Typecheck and Rust check pass.
* Manual UI verification checklist provided because桌面 UI 需人工验收。
* Risky install behavior has explicit UX and error handling.

## Technical Approach (draft)

1. Settings layer：在 `settingsStore.ts` 增加 `ccusageAnalyticsEnabled`，默认 false；设置页新增开关和状态说明。
2. Backend layer：新增 `src-tauri/src/commands/ccusage.rs`，提供固定命令：`ccusage_get_status`、`ccusage_install_tools`、`ccusage_get_report`、`ccusage_refresh_report`。
3. Tool execution：Rust 用 `std::process::Command` 调固定可执行文件和参数；不从前端透传任意命令字符串。
4. Cache layer：优先使用已有 SQLite 能力增加一张本地缓存表，保存 source、report kind、filter key、payload JSON、created/updated 时间；运行期可在 Zustand store 加内存缓存。
5. Frontend data layer：新增 `ccusageStore` 或在现有 historyStore 外新增独立 store，负责来源选择、状态、缓存、刷新、错误。
6. UI layer：新增独立 ccusage 看板组件，使用 ccusage payload 渲染核心指标、日趋势、项目/模型/成本分布，并提供 Claude / Codex / 全部来源切换。
7. Switch routing：`App` 根据 `ccusageAnalyticsEnabled` 决定打开旧 `StatsPanel` 还是新 `CcusageStatsPanel`；旧看板代码保留但启用 ccusage 时隐藏。

## Feasible Approaches

**Approach A: SQLite 持久缓存 + 运行期内存缓存（推荐）**

* How it works: 后端运行 ccusage 后把 JSON payload 写入 SQLite；前端打开时先读 SQLite 缓存，必要时后台刷新。
* Pros: 跨重启有效；与项目已有 SQLite 技术栈一致；缓存可设置 TTL/手动刷新。
* Cons: 需要新增 migration 和缓存表。

**Approach B: Store/JSON 文件持久缓存**

* How it works: 把 ccusage JSON 直接写到 `tauri-plugin-store` 或 app local data JSON 文件。
* Pros: 实现更少。
* Cons: 大 payload 不适合 settings store；查询/增量更新不方便。

**Approach C: 纯内存缓存**

* How it works: 只在当前运行期缓存 ccusage 输出。
* Pros: 最简单。
* Cons: 重启后仍要等待 ccusage 扫描，不满足“持久化到本地”的目标。

## Decision (ADR-lite)

**Context**: 开启 ccusage 会触发 Bun/bunx 安装，属于会修改用户全局开发环境的高影响操作。

**Decision**: 开关开启后只做工具检查；如果缺少 Bun/bunx，必须弹出二次确认，用户明确点击安装后才执行安装。

**Consequences**: 比完全自动安装多一次点击，但风险更可控，也更符合桌面工具对全局环境修改的预期。

**Context**: ccusage 已支持 Claude Code、Codex CLI 和统一报告；继续只做 Claude 会浪费现成能力，也无法覆盖用户希望查看 Codex 用量的场景。

**Decision**: 新 ccusage 看板支持 Claude / Codex / 全部 三种来源切换。Claude 与 Codex 使用 ccusage 聚焦报告，全部使用 ccusage 统一报告。

**Consequences**: 前端和缓存 key 需要携带 source；Codex 结果依赖 ccusage 的实验性 Codex 数据源，UI 文案需避免把本地估算表述为官方账单。

## Open Questions

* None.

## Out of Scope (explicit)

* 不重写旧 `StatsPanel`。
* 不把 ccusage 加入项目 npm 依赖。
* 不支持任意自定义 shell 命令执行。
* 不在 MVP 中做云同步 ccusage 缓存。
* 不自研 Codex 日志解析器；Codex 用量完全依赖 ccusage 的 Codex 数据源。
* 不在 MVP 中加入 billing blocks/5 小时窗口。
* 不在 MVP 中加入费用/Token 阈值预警。
* 不在 MVP 中加入独立工具诊断页；只展示必要状态和最近错误。

## Technical Notes

* Inspected: `src/App.tsx`、`src/components/stats/StatsPanel.tsx`、`src/stores/historyStore.ts`、`src-tauri/src/commands/history.rs`。
* Inspected: `src/stores/settingsStore.ts`、`src/components/SettingsModal.tsx`、`src/components/settings/pages/GeneralSettingsPage.tsx`。
* Inspected: `src-tauri/src/commands/hook_settings.rs` for config-dir resolution and command registration style.
* Inspected: `.trellis/spec/frontend/state-management.md`、`.trellis/spec/frontend/component-guidelines.md`、`.trellis/spec/frontend/quality-guidelines.md`、`.trellis/spec/guides/cross-layer-thinking-guide.md`、`.trellis/spec/guides/tauri-user-file-security-checklist.md`。
* Docs checked via Context7: `/ryoppippi/ccusage` and `/oven-sh/bun`.
