# Improve Dark Project Tree Visual Style

## Goal

根据截图优化左侧项目树在深色主题下的视觉表现，减少厚重块状卡片感和割裂感，让项目列表更像暗色应用中的轻量导航列表。

## What I already know

* 用户反馈：移除阴影后深色主题仍不好看，需要根据截图自行优化。
* 截图显示主要问题不是单一阴影，而是：项目行默认背景太重、圆角块过密、分组壳和项目行层级都像卡片、左侧终端图标圆底叠加行背景导致视觉噪声。
* 相关样式集中在 `src/App.css` 的 `.ui-tree-project`、`.ui-tree-group-shell`、`.ui-tree-group`、`.ui-tree-leading-icon`、`.ui-tree-collapsed-item`。
* 当前应避免改 React 结构、拖拽逻辑、键盘导航或数据逻辑。

## Requirements

* 深色主题下项目树默认项目行应更平、更轻，不再像一组厚卡片堆叠。
* 分组标题保留可点击和展开状态，但减少整块容器感。
* hover/selected 状态仍要可识别，但用轻背景/边框表达，不用明显投影。
* 左侧项目图标底色应弱化，避免“圆形按钮 + 行卡片”双重层级。
* 浅色主题尽量不受影响。

## Acceptance Criteria

* [ ] 深色主题下项目列表视觉更平整、连续，不再出现明显厚块堆叠感。
* [ ] 项目 hover、选中、分组展开状态仍清楚。
* [ ] 项目行、分组行、折叠态项目按钮风格一致。
* [ ] `npx tsc --noEmit` 通过。
* [ ] `npm run build` 通过或仅保留既有非阻塞警告。

## Definition of Done

* 最小 CSS 改动完成。
* 静态检查完成。
* 桌面运行态 UI 由用户人工验收。

## Technical Approach

推荐走“暗色专属扁平列表”方案：只在 `[data-theme="dark"]` 下覆盖项目树样式，让普通项目行默认接近透明，hover/selected 用轻微背景和边框；分组壳去掉块状背景，分组行保留轻底；项目图标圆底弱化为透明或低透明背景。

## Out of Scope

* 不重做侧栏整体布局。
* 不改搜索框、顶部按钮、底部工具栏。
* 不改项目树交互逻辑。
* 不调整浅色主题。

## Technical Notes

* 重点 CSS：`src/App.css:995` 起的 `.ui-tree-project`，`src/App.css:1036` 起的 `.ui-tree-group-shell`，`src/App.css:1070` 起的 `.ui-tree-leading-icon`，`src/App.css:1159` 起的 `.ui-tree-collapsed-item`。
* 组件引用：`src/components/sidebar/TreeNodeItem.tsx:97`、`src/components/sidebar/ProjectTree.tsx:387`。
