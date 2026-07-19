# 修复搜狗输入法扩展屏光标漂移

## Goal

修复在 Windows 扩展屏/副屏场景下，CLI-Manager 终端里使用搜狗输入法输入时候选框或输入光标漂移的问题，优先覆盖用户描述的 Codex 终端输入 `,` 时漂移场景，并保持现有终端输入行为不回退。

## What I already know

* 问题发生在 Windows 11 + 搜狗输入法 + 扩展屏/副屏场景。
* 用户描述是在副屏运行 Codex 时，输入 `,` 会出现输入法光标漂移。
* 仓库里已经有针对 IME / 搜狗的自定义锚点修复逻辑，位置在 `src/components/XTermTerminal.tsx`。
* 当前逻辑通过 `estimateCellSize()` 用终端容器尺寸和 `terminal.cols/rows` 估算单元格尺寸，再把 `.xterm-helper-textarea` 和 `.composition-view` 手动定位到推导出的光标格子。
* xterm upstream 的 `CompositionHelper` 会使用渲染层提供的精确 `cell.width / cell.height`，并用 `compositionView.getBoundingClientRect()` 同步 textarea 尺寸。
* 当前实现没有直接复用 xterm 的精确 cell 尺寸，而是自己估算；在混合 DPI / 副屏场景下，这类估算容易累计误差。
* GitNexus 影响分析：
  * `XTermTerminal`：LOW，未发现跨模块上游调用风险。
  * `estimateCellSize`：HIGH，但影响范围局限在 `XTermTerminal.tsx` 内部 IME 相关链路。
  * `scheduleCompositionAnchorFix`：HIGH，但影响范围局限在 `onCompositionStart/update` 和组件内部。

## Assumptions (temporary)

* 根因更可能是终端内 IME 锚点坐标估算误差，而不是 Rust PTY、Tauri IPC 或历史会话逻辑。
* 最小修复应集中在 `src/components/XTermTerminal.tsx`，无需改后端。
* 这次先解决“副屏/混合 DPI 下 IME 锚点漂移”，不顺带重构整段终端输入逻辑。

## Open Questions

* 本次是否只需要覆盖“搜狗 + 副屏 + Codex 终端”的已知场景，还是要顺手把所有终端会话（普通 Shell / Claude / Codex）统一纳入修复范围。

## Requirements (evolving)

* 修复 xterm IME helper textarea / composition view 的定位误差。
* 修复后不能破坏现有中文输入、英文输入、粘贴和终端焦点行为。
* 修改应尽量限制在前端终端组件，避免扩大影响面。

## Acceptance Criteria (evolving)

* [ ] 在副屏场景下，搜狗输入法输入 `,` 时候选框/输入光标不再明显偏离终端光标位置。
* [ ] 主屏场景下，现有中文输入行为不回退。
* [ ] 普通英文输入、粘贴、终端焦点切换行为保持正常。
* [ ] `npx tsc --noEmit` 通过。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* Rust PTY 管理逻辑修改
* 输入法品牌兼容性全面重构
* 与当前问题无关的终端样式或交互重构

## Technical Notes

* 相关文件：`src/components/XTermTerminal.tsx`
* 参考上游：`node_modules/@xterm/xterm/src/browser/input/CompositionHelper.ts`
* 当前风险集中在：
  * `estimateCellSize()`
  * `applyCompositionAnchorFix()`
  * `pinHelperTextareaAnchor()`
