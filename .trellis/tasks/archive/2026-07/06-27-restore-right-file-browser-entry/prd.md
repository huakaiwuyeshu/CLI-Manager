# Restore Right File Browser Entry

## Goal

文件浏览器需要同时支持左右两个入口，且入口各自打开各自区域：右侧入口打开右侧文件面板；左侧项目右键入口打开左侧文件浏览器，并替换项目列表。

## What I Already Know

* 用户希望右侧入口仍打开右侧文件面板。
* 用户希望左侧项目右键“浏览文件”入口打开左侧文件浏览器，并替换项目列表。
* 两个入口都需要保留，行为互不合并。
* 提交 `64a8fcd feat(terminal): 将文件浏览器迁移到终端侧边栏` 删除了 `Sidebar` 中的项目右键“浏览文件”入口和左侧栏内嵌 `FileExplorerSidebar`。
* 当前 `TerminalTabs` 仍保留终端右侧文件面板按钮与面板内容。

## Assumptions

* 这是前端 UI 入口调整，优先复用现有文件浏览器打开逻辑。
* 不新增依赖，不改后端接口。
* 左侧项目右键“浏览文件”入口应恢复左侧栏内嵌文件树，并替换项目列表。

## Open Questions

* 暂无阻塞问题，先通过代码定位确认最小改动范围。

## Requirements

* 右侧现有文件面板入口继续可用，并在右侧打开。
* 左侧项目右键菜单提供“浏览文件”入口，并在左侧替换项目列表显示文件浏览器。
* 关闭左侧文件浏览器后返回项目列表。

## Acceptance Criteria

* [ ] 用户可以从右侧入口打开右侧文件面板。
* [ ] 用户可以从左侧项目右键菜单打开左侧文件浏览器。
* [ ] 左侧文件浏览器打开后替换项目列表。
* [ ] 关闭左侧文件浏览器后返回项目列表。
* [ ] 不影响现有终端、项目列表和文件浏览器行为。

## Definition of Done

* 代码改动保持最小。
* 类型检查通过，或说明无法运行的原因。
* 只修改本任务相关文件。

## Out of Scope

* 不重构文件浏览器组件。
* 不调整文件浏览器功能本身。
* 不新增设置项。

## Technical Notes

* `src/components/sidebar/index.tsx`：需要恢复右键菜单“浏览文件”项、`handleOpenProjectFiles` 和左侧 `FileExplorerSidebar` 渲染。
* `src/components/TerminalTabs.tsx`：右侧文件面板已存在，保持右侧入口行为。
* `src/App.tsx`：不需要作为文件面板桥接层。
* GitNexus impact：`App`、`Sidebar`、`TerminalTabs` 均 LOW；直接调用方和受影响流程均为 0。

## Technical Approach

`Sidebar` 的项目右键“浏览文件”直接调用 `useFileExplorerStore.openProject(project)`，在左侧栏渲染 `FileExplorerSidebar` 替换项目列表；`TerminalTabs` 保持自己的右侧文件面板按钮和打开逻辑。

## Decision (ADR-lite)

**Context**: 文件浏览器曾从左侧栏迁移到终端右侧面板，但现在需要左右两个入口都存在。

**Decision**: 左侧入口恢复左侧栏文件浏览器并替换项目列表；右侧入口保持右侧文件面板。

**Consequences**: 文件浏览器有左右两种展示位置，但入口行为清晰分离；不新增依赖、不改后端接口。
