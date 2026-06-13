# Fix terminal IME tail-line anchor

## Goal

修复内置 xterm 终端中 IME 输入框/候选框小概率锚到尾行的问题。该问题不只发生在 Claude Code/Codex `/compact`，普通使用中也可能出现；目标是在 composition 周期内让输入框稳定锚定到用户开始输入时的位置，不跟随后续终端实时光标漂移。

## Requirements

* IME composition 开始后，`.composition-view` 和 `.xterm-helper-textarea` 复用 `compositionstart` 冻结的锚点。
* 如果 `compositionstart` 时实时 buffer 光标已经落到非输入尾行，允许回退到最近的可见输入提示行。
* 不再在 `compositionstart` 里清空 helper textarea 的位置样式，避免短暂回到 xterm 默认定位。
* composition 期间，如果 xterm 后续 render/composition update 用实时 buffer 光标重写位置，应用层要再次覆盖回冻结锚点。
* 保留非 composition 状态下 helper textarea 离屏且至少 `1x1` 的逻辑，避免中文标点第一次输入丢失。
* 不改 PTY 后端、不新增依赖、不重写 xterm 内部实现。

## Acceptance Criteria

* [ ] Claude Code/Codex 中无 `/compact` 时，中文 IME 输入框/候选框不应小概率跳到尾行。
* [ ] Claude Code/Codex `/compact` 或高频输出时，IME 输入框/候选框仍不跟随进度/状态光标漂移。
* [ ] 中文标点一次输入仍可进入终端。
* [ ] 普通英文输入、Enter、粘贴仍可用。
* [ ] `npx tsc --noEmit` 通过。
* [ ] 运行态视觉行为由用户在 Tauri 桌面应用中人工验证。

## Definition of Done

* 最小修改集中在 `src/components/XTermTerminal.tsx`。
* TypeScript 类型检查通过。
* 说明人工验证项和剩余风险。

## Technical Approach

在现有冻结锚点机制上做减法和补强：

* 将 compositionstart 的 helper textarea 释放动作改为只取消待执行的离屏 pin RAF，不清空 `left/top/width/height/lineHeight`。
* `resolveCompositionAnchorCell()` 优先使用当前 cursor；仅当当前行不像输入提示行时，查找最近的可见输入提示行作为冻结锚点。
* 注册 `terminal.onRender` composition 兜底：xterm render 后如果仍在 composition，就调用 `scheduleCompositionAnchorFix()`，用冻结锚点覆盖 `.composition-view` 和 `.xterm-helper-textarea`。
* cleanup 中 dispose 新增监听。

## Decision (ADR-lite)

**Context**: xterm 6.0.0 会在 `CompositionHelper.updateCompositionElements()` 和 render 回调里基于实时 buffer 光标定位 composition 元素。终端输出或 TUI redraw 可能让实时光标暂时落在尾行，导致输入框/候选框漂移。

**Decision**: 不改 xterm，不引入自定义输入层；在应用层冻结 compositionstart 锚点。如果实时 cursor 已经不像输入行，则使用最近的可见输入提示行；之后在 xterm 后续可能重写位置后覆盖回冻结锚点。

**Consequences**: 改动面仍集中在前端终端组件。输入行识别是受限启发式，只覆盖已有项目场景中的 `>/$/#/PS/›` prompt；如果未来 CLI 使用完全不同的自绘输入框，可能还需要增加更明确的输入锚点来源。

## Out of Scope

* 不做全屏 TUI 文本结构解析。
* 不替换 xterm helper textarea。
* 不改 Rust PTY 或 CLI 输出。
* 不自动启动 Tauri 桌面应用做视觉验证。

## Technical Notes

* Candidate file: `src/components/XTermTerminal.tsx`.
* xterm source: `node_modules/@xterm/xterm/src/browser/input/CompositionHelper.ts` uses live buffer cursor in `updateCompositionElements()`.
* xterm source: `node_modules/@xterm/xterm/src/browser/CoreBrowserTerminal.ts` calls `_syncTextArea()` on cursor move and `updateCompositionElements()` on render.
* Existing spec: `.trellis/spec/frontend/component-guidelines.md` documents xterm helper textarea composition constraints.
* User correction: issue can occur without `/compact`; do not narrow root cause to compact progress redraw only.
