# fix terminal new button hover contrast

## Goal

修复终端区域“新建”按钮在悬浮态背景变浅后仍使用白色文字导致对比度不足的问题，保持终端 UI 低干扰视觉。

## What I already know

* 用户反馈：终端的新建按钮字体是白色，hover 后背景变成灰白，与字体颜色冲突。
* 这是前端 UI 样式问题，目标是最小局部修复。
* CLI-Manager 运行态/桌面 UI 视觉验收需人工完成，AI 不启动应用做 UI 验收。

## Assumptions (temporary)

* 问题来自终端相关组件中的按钮 hover class，而不是全局主题变量。
* 修复应优先调整 hover 态文字色/背景色中的一个，避免改动整体交互逻辑。

## Open Questions

* 暂无阻塞问题。

## Requirements (evolving)

* 修复终端新建按钮 hover 状态下文字与背景对比不足。
* 保持终端内控件风格，不引入通用应用按钮样式或新依赖。
* 仅做局部样式改动，不重构终端组件。

## Acceptance Criteria (evolving)

* [ ] 新建按钮默认态与 hover 态文字均清晰可读。
* [ ] 改动范围局限在按钮样式相关代码。
* [ ] 可行的静态检查通过；运行态 UI 由用户人工验证。

## Definition of Done (team quality bar)

* Tests added/updated only if behavior logic changes.
* Lint / typecheck / CI green where practical.
* Docs/notes updated only if规范变化。
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* 不调整终端新建流程或按钮交互逻辑。
* 不重做终端工具栏整体视觉。
* 不引入新组件库、依赖或主题系统改造。

## Technical Notes

* 适用范围：frontend。
* 已读取 `.trellis/spec/frontend/index.md`、`component-guidelines.md`、`quality-guidelines.md` 与共享指南索引。
* 相关记忆：终端内嵌 UI 应贴近终端视觉；CLI-Manager 运行态 UI 只能人工验收。
* 定位结果：`src/components/TerminalTabs.tsx` 的新建终端按钮使用 `ui-flat-action ui-toolbar-button ui-primary-action`。
* 根因：`src/App.css` 的通用 `.ui-flat-action:hover` 提供浅色 hover 背景，后续 `.ui-primary-action:hover` 保持白色文字，导致对比不足。
* GitNexus：`TerminalTabs` upstream impact = LOW，direct=0，processes=0。
