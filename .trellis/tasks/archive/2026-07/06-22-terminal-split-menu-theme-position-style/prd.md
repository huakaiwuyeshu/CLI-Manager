# terminal split menu theme position style

## Goal

让终端右键菜单中的“向右分屏/向下分屏”打开“选择分屏终端”时，弹层使用当前终端主题配色、出现在右键位置附近，并在视觉上贴近项目树列表样式。

## What I already know

* 用户要求“选择分屏终端”不要跟随系统主题，而要跟随终端主题。
* 用户要求弹层出现位置改为右键时候的位置，而不是固定位置。
* 用户要求样式优化，使用和项目树相同的样式。
* `src/components/TerminalTabs.tsx` 中 `SplitProjectPicker` 当前用 Radix `Popover`，无自定义终端主题变量，内容使用通用 `ui-interactive` 样式。
* `handleOpenSplitPicker` 在没有 anchor 时使用固定位置 `window.innerWidth - 24` / `56`；终端正文右键菜单触发分屏时目前没有传递右键坐标。
* Tab 右键菜单已有 `terminal-skin` 和 `tabMenuStyle`，已基于 `getTerminalTheme(...)` 生成终端主题 CSS 变量。
* `src/components/XTermTerminal.tsx` 的终端正文右键菜单 `menuState` 记录 `clientX/clientY`，但 `onSplitRight/onSplitDown` 回调目前无参数。
* 项目树样式在 `src/App.css` 的 `.ui-tree-project`、`.ui-tree-meta-chip` 等规则；项目树右键菜单使用 `.context-menu` / `.context-menu-item`。
* GitNexus impact：`SplitProjectPicker`、`TerminalTabs`、`XTermTerminal` 上游影响均为 LOW。

## Requirements

* “选择分屏终端”弹层配色跟随终端主题，而不是系统/应用主题。
* 从终端正文右键菜单点击“向右分屏/向下分屏”时，弹层出现在这次右键点击位置附近。
* 从 Tab 右键菜单点击分屏时，继续贴近 Tab 右键菜单触发位置/菜单项位置。
* 弹层内部列表样式贴近项目树：项目行、工具标签、悬停/选中质感统一。
* 保持最小改动，不引入新依赖，不改分屏数据结构。

## Acceptance Criteria

* [ ] 终端主题为深/浅或自定义调色板时，“选择分屏终端”背景、文字、边框、hover 使用终端主题派生变量。
* [ ] 终端正文右键菜单触发分屏后，选择弹层不再固定在窗口右上角。
* [ ] Tab 右键菜单触发分屏仍能正常打开选择弹层。
* [ ] “空终端”和项目列表视觉贴近项目树列表样式。
* [ ] `npx tsc --noEmit` 通过。

## Definition of Done

* 前端类型检查通过。
* 变更范围仅限终端分屏选择弹层及其触发坐标传递。
* 不改动无关设置、历史、后端逻辑。

## Technical Approach

* 在 `TerminalTabs.tsx` 复用已有终端主题解析结果，给 `SplitProjectPicker` 传入终端主题 style/class。
* 将分屏 picker 的定位状态从固定 fallback 改为支持鼠标坐标；Tab 菜单继续用菜单 anchor，终端正文菜单改为传递右键坐标。
* 给 picker 增加轻量 CSS 类，复用项目树的列表密度、圆角、chip 视觉，并用终端主题 CSS 变量覆盖颜色。

## Decision (ADR-lite)

**Context**: 当前 picker 使用通用 Popover 和应用主题，正文右键触发时没有坐标，只能落在固定位置。  
**Decision**: 不换弹层库，不引入新组件；只扩展回调参数与 CSS 变量。  
**Consequences**: 改动小、风险低；后续若要完全统一所有右键菜单，可再抽公共定位工具。

## Out of Scope

* 不重构终端右键菜单整体结构。
* 不改项目树菜单行为。
* 不新增终端主题配置项。
* 不做自动 UI 启动验收，运行态 UI 由人工验收。

## Technical Notes

* 相关文件：`src/components/TerminalTabs.tsx`、`src/components/XTermTerminal.tsx`、`src/App.css`。
* 项目约束：前端无测试框架，改完跑 `npx tsc --noEmit`。
