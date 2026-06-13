# Fix project tree dark theme shadow

## Goal

降低左侧项目树在深色主题下的阴影/描边割裂感，让项目列表更贴近深色界面的平面层级。

## What I already know

* 用户反馈：左侧项目树的项目有阴影效果，在深色主题下表现不好，阴影太明显导致割裂。
* 项目树项目行组件在 `src/components/sidebar/TreeNodeItem.tsx`，项目行使用 `ui-tree-node ui-tree-project`。
* 折叠侧栏项目按钮在 `src/components/sidebar/ProjectTree.tsx`，使用 `ui-tree-collapsed-item`。
* 阴影/内描边主要来自 `src/App.css` 的项目树样式：`ui-tree-project[data-selected="true"]`、`ui-tree-group-shell`、`ui-tree-collapsed-item`、`ui-tree-inline-input`、`ui-tree-status-dot`。
* GitNexus impact：`ProjectTree` 和 `TreeNodeItem` upstream 风险均为 LOW，当前计划不改 React 逻辑，只改 CSS。

## Requirements

* 深色主题下弱化或移除左侧项目树项目的明显阴影/内描边效果。
* 保留选中、hover、无效路径、运行状态等基础可识别性。
* 不改项目树数据逻辑、拖拽逻辑、键盘导航逻辑。
* 不引入新依赖。

## Acceptance Criteria

* [ ] 深色主题下项目树项目行不再出现明显割裂的阴影效果。
* [ ] 选中项目仍能通过背景色/边框识别。
* [ ] 浅色主题不被无关改动影响。
* [ ] TypeScript/CSS 构建检查无新增错误。

## Definition of Done

* 最小 CSS 改动完成。
* 运行静态检查或说明无法运行的原因。
* 运行态桌面 UI 由用户人工验收。

## Technical Approach

只调整 `src/App.css` 中项目树相关 CSS：优先在深色主题下去掉项目行/折叠项/分组容器的明显 `box-shadow`，用更轻的背景和边框维持状态表达。

## Out of Scope

* 不重做项目树视觉体系。
* 不调整项目树布局、缩进、拖拽、键盘交互。
* 不修改全局主题色板。

## Technical Notes

* 重点样式位置：`src/App.css:995` 起的 `.ui-tree-project`，`src/App.css:1036` 起的 `.ui-tree-group-shell`，`src/App.css:1159` 起的 `.ui-tree-collapsed-item`。
* 组件位置：`src/components/sidebar/TreeNodeItem.tsx:97`、`src/components/sidebar/ProjectTree.tsx:387`。
