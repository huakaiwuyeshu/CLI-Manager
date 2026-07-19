# 突出历史会话关闭按钮背景

## Goal

让历史会话侧栏顶部的关闭按钮比普通工具按钮更醒目，降低误看漏看关闭入口的概率。

## Requirements

* 只调整历史会话侧栏顶部 `aria-label="关闭历史会话"` 的关闭按钮视觉样式。
* 关闭按钮使用更醒目的 danger 背景色。
* 刷新按钮、历史列表、会话详情行为不变。

## Acceptance Criteria

* [ ] 历史会话关闭按钮拥有明显背景色。
* [ ] 鼠标悬浮和键盘聚焦状态仍清晰可见。
* [ ] `npx tsc --noEmit` 通过，或说明无法验证的原因。

## Definition of Done

* 最小范围修改。
* 不新增依赖。
* 不改动历史会话业务逻辑。

## Technical Approach

在 `HistoryListPane` 关闭按钮上追加专用 class，并在 `components.css` 中定义 danger 背景、边框、文字色和 hover/focus 反馈。

## Out of Scope

* 不重做历史会话顶部工具栏布局。
* 不调整刷新按钮和其他操作按钮。
* 不修改主题变量或全局按钮基础样式。

## Technical Notes

* 目标按钮位于 `src/components/history/HistoryListPane.tsx`。
* 现有按钮基类为 `ui-flat-action ui-toolbar-button-compact`，当前视觉和刷新按钮接近。
