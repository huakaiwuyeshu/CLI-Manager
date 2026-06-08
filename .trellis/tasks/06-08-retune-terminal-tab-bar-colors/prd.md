# Retune Terminal Tab Bar Colors

## Goal

当前终端 tab 和新建按钮配色不够协调：硬绿色边框与新建按钮底色过于抢眼。需要换成更贴近终端视觉的配色，保持 tab 可识别但不突兀。

## What I already know

- 当前颜色主要在 `src/App.css` 的 `.ui-terminal-pane-chrome` 作用域内。
- `--terminal-tab-border-green: #22c55e` 是硬编码绿色来源。
- 新建按钮使用 `ui-primary-action`，在 terminal pane 作用域内被覆盖成绿色混合底色。
- `src/components/TerminalTabs.tsx` 的按钮结构无需修改，最小方案只改 CSS。

## Requirements

- 调整 terminal tab 边框、选中态和新建按钮配色。
- 配色应贴近终端主题，不使用突兀的硬绿色。
- 只影响 terminal pane 内的 tab/toolbar，不影响全局按钮样式。
- 不修改终端会话、分屏、PTY、历史逻辑。

## Acceptance Criteria

- [ ] terminal tab 普通态边框更柔和。
- [ ] terminal tab 选中态仍能清楚辨认。
- [ ] 新建按钮不再使用抢眼绿色底色。
- [ ] toolbar 其他按钮与新建按钮视觉统一。

## Definition of Done

- TypeScript 静态检查或前端构建通过。
- diff 只包含预期 CSS/Trellis 文件。
- CLI-Manager 运行态终端视觉由人工验收。

## Technical Approach

只改 `src/App.css`：将 `--terminal-tab-border-green` 替换为语义更中性的 terminal tab accent 变量，并调整 tab border、selected shadow、toolbar button、primary action 的 `color-mix` 比例。

## Decision (ADR-lite)

**Context**: 当前硬绿色和新建按钮底色过于抢眼，不贴合终端内嵌 UI。
**Decision**: 使用主题蓝灰方案，从 `--terminal-theme-accent`、foreground、muted 派生 tab 和 toolbar action 配色。
**Consequences**: 颜色会随终端主题变化，更协调；最终观感仍需人工在桌面 UI 中确认。

## Options

1. **主题蓝灰（推荐）**：使用 `--terminal-theme-accent` 与 foreground/background 混合，整体贴近当前终端主题。
2. **低饱和青色**：使用固定青色作为弱强调，比绿色冷静但仍有存在感。
3. **中性灰 + 仅选中强调**：普通态低存在感，选中态用主题 accent 强调。

## Out of Scope

- 不新增用户自定义颜色设置项。
- 不重做 tab 结构或 toolbar 布局。
- 不改主题 palette 配置。

## Technical Notes

- `src/App.css:1948` 定义 terminal pane chrome 和当前 tab/action 配色。
- `src/components/TerminalTabs.tsx:1157` 渲染新建按钮，但本次无需修改组件。
- 项目记忆要求：CLI-Manager 运行态/桌面 UI 不由 AI 启动服务验证，最终需人工验收视觉。