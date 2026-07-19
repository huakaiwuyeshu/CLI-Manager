# 调整会话历史会话列表按钮样式

## Goal

让会话历史内“刷新会话列表”按钮摆脱默认灰色视觉，和历史面板顶部操作区更协调。

## What I Already Know

* 用户反馈“会话历史的会话列表按钮”灰色不协调。
* 当前代码里相关按钮是 `src/components/history/HistoryListPane.tsx` 中标题为“刷新会话列表”的刷新按钮，使用通用 `ui-flat-action`，默认是灰色表面色。
* 同一行的关闭按钮已经有专用 `ui-history-close-action` 红色样式。
* `HistoryListPane` GitNexus upstream impact: LOW，未发现直接调用方或受影响流程。

## Requirements

* 只调整会话历史列表顶部的刷新/会话列表按钮样式。
* 不改变按钮行为、布局尺寸、快捷键、历史加载逻辑。
* 不引入新依赖，不修改配置。

## Acceptance Criteria

* [ ] 刷新会话列表按钮不再使用默认灰色作为主视觉。
* [ ] hover/focus 状态清晰，和当前主题 token 协调。
* [ ] TypeScript 类型检查通过。

## Definition of Done

* 代码改动最小。
* 运行 `npx tsc --noEmit`。
* 列出需要人工确认的 UI 检查项。

## Technical Approach

给刷新会话列表按钮增加一个专用 class，在 `components.css` 里用 `var(--primary)` 派生边框、背景和文字颜色，保持 8x8 图标按钮尺寸不变。

## Out of Scope

* 不重做会话历史顶部布局。
* 不调整关闭按钮、项目筛选、搜索框或会话行样式。
* 不启动 Tauri 桌面应用做人工视觉验证。

## Technical Notes

* Relevant files:
  * `src/components/history/HistoryListPane.tsx`
  * `src/styles/components.css`
* Existing frontend quality guideline says AI 不启动桌面应用，视觉变更以静态检查 + 人工检查清单收尾。
