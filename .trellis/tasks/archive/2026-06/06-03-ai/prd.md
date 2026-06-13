# 优化项目树 AI 徽章视觉

## Goal

优化项目树中 Codex、Claude、Gemini 徽章的视觉表现，让徽章更精致，并使用与对应 AI 品牌/主题相关的协调色，提升侧边栏项目树的信息识别度。

## What I already know

* 用户认为当前 `codex`、`claude`、`gemini` 徽章太粗糙，需要更精致。
* 当前徽章由 `src/components/sidebar/TreeNodeItem.tsx` 渲染，样式集中在 `src/App.css` 的 `.ui-tree-meta-chip` 与 `[data-cli-tool]` 分支。
* 现有实现已经为三种工具设置了不同颜色，但视觉只有浅底色 + 内描边，层次较弱。

## Requirements

* 保持现有项目树结构和徽章文案不变。
* 优先采用 CSS-only 最小改动，不增加依赖，不改数据结构。
* 为 Claude、Codex、Gemini 使用更协调的 AI 主题色。
* 增强徽章精致度：更细的边框、轻微渐变/高光、合理间距和阴影。

## Acceptance Criteria

* [x] 项目树中 Claude、Codex、Gemini 徽章颜色明显区分且协调。
* [x] 徽章比当前浅色块更精致，但不喧宾夺主。
* [x] 不影响项目树布局、拖拽、点击、折叠等交互。
* [x] 通过前端静态检查或直接运行观察验证。

## Definition of Done

* 读取相关前端规范与组件实现。
* 修改范围保持最小。
* 完成必要验证。

## Technical Approach

CSS-only 调整 `src/App.css`：保留 `TreeNodeItem.tsx` 的 `data-cli-tool` 钩子，只重写 `.ui-tree-meta-chip` 的视觉层次和三个工具的 CSS 变量。

## Out of Scope

* 不新增图标或品牌 Logo 资源。
* 不修改项目数据模型和 CLI 工具枚举。
* 不重构项目树组件。

## Technical Notes

* 已读取 `.trellis/spec/frontend/index.md`、`.trellis/spec/frontend/quality-guidelines.md`、`.trellis/spec/guides/index.md`。
* 涉及文件：`src/App.css`、`src/components/sidebar/TreeNodeItem.tsx`。
