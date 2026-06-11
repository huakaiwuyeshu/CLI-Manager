# Fix terminal IME candidate popup position

## Goal

修复内置 xterm 终端中偶发的中文输入法候选框错位：真实输入光标在上方 prompt 行，但 IME composition 文本和候选框被锚到终端底部。目标是候选框稳定跟随真实输入光标，同时保留之前针对 Claude Code `/compact` 进度光标错位的保护。

## What I already know

* 用户截图显示：终端光标在上方 `› codex ...` 输入行；composition 文本/候选框出现在底部。
* 项目使用 React 19、TypeScript 5.8、xterm.js 6.0、Tauri 2；不需要新增依赖。
* Rust 侧依赖与本问题无关，问题位于前端 xterm helper textarea / composition anchoring。
* `src/components/XTermTerminal.tsx` 已有 IME 修复逻辑：composition 时重定位 `.composition-view` 和 `.xterm-helper-textarea`。
* 当前 `resolveCompositionAnchorCell()` 只扫描底部最近 8 行的 prompt；找不到就 fallback 到 `bottomRow`。这会解释截图里的“真实 cursor 在上方，但候选框落到底部”。
* 既有规约 `.trellis/spec/frontend/component-guidelines.md` 明确：不能隐藏/移除 `.xterm-helper-textarea`；非 composition 保持 1x1 离屏；composition 时需要修正 xterm 的进度光标错位。
* 既有任务 `06-09-fix-compact-ime-input-anchor-jitter` 处理过相反场景：真实输入在底部，但 xterm 光标/候选窗漂到 progress 区。

## Assumptions (temporary)

* 本次不是后端 PTY 或输入法本身问题，而是现有 bottom prompt fallback 过于激进。
* 最小修复应仍只改 `src/components/XTermTerminal.tsx`，必要时补充规约说明。
* 不新增外部输入框，不重写 xterm。

## Open Questions

* 是否接受“优先使用当前 xterm 光标；仅在能明确识别到底部真实 prompt 时才覆盖到底部”的折中策略？

## Requirements (evolving)

* IME 候选框应跟随真实输入光标，不应在未识别到底部 prompt 时强制落到底部。
* 保留之前 `/compact` 场景下底部真实输入行的修复能力。
* 保留普通键盘输入、回车、粘贴和中文/IME composition 可用性。
* 不绑定 Claude/Codex 具体文案，不修改 CLI 输出。

## Acceptance Criteria (evolving)

* [ ] 截图场景：光标在上方 prompt 行时，输入中文/拼音的候选框靠近上方光标，不落到底部。
* [ ] `/compact` 或高频 TUI redraw 场景：如果底部存在真实 prompt，候选框仍不跟随 progress cursor 乱跳。
* [ ] 普通英文输入、回车、粘贴仍可用。
* [ ] `npx tsc --noEmit` 通过。
* [ ] 运行态 UI 由用户人工验证。

## Definition of Done (team quality bar)

* Tests added/updated where practical; for xterm runtime visual behavior，提供明确人工验证项。
* Typecheck green.
* Docs/spec notes updated if a new xterm IME rule is clarified.
* No new dependencies.

## Out of Scope (explicit)

* 不启动 Tauri 桌面应用做 AI 侧视觉验证。
* 不重写 xterm internals。
* 不新增自定义输入框或替换系统 IME。
* 不改 Rust PTY 通道。

## Technical Notes

* Candidate file: `src/components/XTermTerminal.tsx`.
* Relevant existing code: `resolveCompositionAnchorCell()` and `applyCompositionAnchorFix()` around `XTermTerminal.tsx:640`.
* xterm source note: `CompositionHelper.updateCompositionElements()` uses buffer cursor `x/y` to position `.composition-view` and helper textarea, then schedules a delayed update.
* Existing spec reference: `.trellis/spec/frontend/component-guidelines.md` section “Common Mistake: Letting xterm helper textarea follow non-IME redraw cursors”.
* Frontend quality spec says terminal visual/runtime checks are manual; AI should run static checks and list manual checks.
