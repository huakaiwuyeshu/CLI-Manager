# 添加沉浸式终端全屏按钮

## Goal

在主界面增加一个沉浸式终端全屏按钮，点击后隐藏左侧项目树和其它侧栏信息，并将 Tauri 窗口切换到系统全屏，只保留终端 Tab 与终端内容区域，方便专注编程；再次点击恢复正常布局和窗口状态。

## What I already know

* 用户希望点击一个“全屏/沉浸式”按钮后隐藏左侧项目树和其他信息。
* 用户已选择系统全屏：按钮需要隐藏侧栏，并调用 Tauri 当前窗口全屏 API。
* `src/App.tsx` 负责普通模式下的侧边栏 + 主内容左右布局。
* `src/components/TerminalTabs.tsx` 负责终端 Tab 工具栏和终端内容区域，适合放置切换按钮入口。
* `src/components/sidebar/index.tsx` 已有折叠侧边栏逻辑，但折叠后仍保留 60px，不满足“隐藏其它信息”。
* GitNexus 影响分析：`App` upstream LOW；`TerminalTabs` upstream LOW。

## Assumptions (temporary)

* 按钮放在终端 Tab 工具栏右侧操作区，与“新建 / 模板 / 历史”同级。
* 沉浸式状态为当前运行期 UI 状态，不写入设置持久化。
* 开启沉浸式时调用 `getCurrentWindow().setFullscreen(true)`；退出时调用 `setFullscreen(false)`。
* 退出沉浸式后恢复原布局，不修改用户已有侧栏宽度设置。

## Open Questions

* 无。

## Requirements (evolving)

* 在普通主界面增加沉浸式全屏切换按钮。
* 开启后隐藏左侧 `Sidebar`，主区域占满可用空间。
* 开启后调用 Tauri 当前窗口系统全屏。
* 保留终端 Tab、终端内容、终端工具栏中的常用操作。
* 再次点击同一按钮退出系统全屏并恢复侧栏。
* 不影响 `viewMode === "compact"` 的现有紧凑模式。

## Acceptance Criteria (evolving)

* [x] 普通模式下可看到沉浸式按钮。
* [x] 点击按钮后左侧项目树、搜索、底部设置/统计入口全部不可见。
* [x] 点击后窗口进入系统全屏。
* [x] 点击后右侧终端 Tab 与终端内容区域横向铺满。
* [x] 再次点击退出系统全屏，并恢复侧栏和原终端布局。
* [x] 现有新建终端、Tab 切换、会话历史入口不被破坏。

## Definition of Done (team quality bar)

* TypeScript typecheck 通过。
* 真实界面手动验证开启/关闭沉浸式模式。
* 不新增依赖。
* 不修改持久化侧栏宽度。

## Out of Scope (explicit)

* 持久化记住沉浸式状态。
* 快捷键绑定。
* 重做整体布局或侧边栏折叠逻辑。

## Technical Notes

* Likely files:
  * `src/App.tsx`：持有 `terminalFullscreen` 状态，调用 Tauri window API，并在普通模式布局中条件渲染 `Sidebar`。
  * `src/components/TerminalTabs.tsx`：接收 `fullscreen` / `onToggleFullscreen` props 并渲染按钮。
  * `src/components/icons.ts`：优先复用已有 icon；如需更贴合语义，从现有 lucide export 中补最小图标出口。
* `src/components/sidebar/index.tsx` 当前折叠宽度为 60px，不适合作为本需求实现方式。
* `src/App.css` 已有 `ui-icon-action` / `ui-toolbar-button` 样式，可复用。
* Context7 确认 Tauri 2 API：`getCurrentWindow().isFullscreen(): Promise<boolean>`，`getCurrentWindow().setFullscreen(fullscreen: boolean): Promise<void>`。
