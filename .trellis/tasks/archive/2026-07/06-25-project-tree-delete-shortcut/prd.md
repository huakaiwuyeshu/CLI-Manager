# 项目树 Delete 快捷删除

## Goal

在左侧项目树中，用户聚焦项目或目录行后按 `Delete`，直接触发现有删除确认流程，减少必须右键菜单删除的操作成本。

## What I Already Know

* 用户要求：“项目树 绑定delete的快捷键，快捷删除”。
* 文件浏览器已有局部 `Delete` 删除快捷键：`src/components/files/FileExplorerSidebar.tsx`。
* 左侧项目树键盘导航集中在 `src/components/sidebar/ProjectTree.tsx` 的 `handleTreeKeyDown`。
* 项目/目录删除确认和真实删除逻辑已在 `src/components/sidebar/index.tsx`：`handleRequestDeleteProject`、`handleRequestDeleteGroup`、`confirmDialog`。
* `TreeActions` 是 `ProjectTree` 获取父组件动作的既有通道。

## Requirements

* 聚焦项目树中的项目行时，按无修饰键 `Delete` 打开项目删除确认弹窗。
* 聚焦项目树中的目录行时，按无修饰键 `Delete` 打开目录删除确认弹窗。
* 输入框、textarea、select、contenteditable 内按 `Delete` 不被项目树拦截。
* 继续复用现有确认弹窗、删除 store action、toast 和 i18n 文案。
* 不新增全局快捷键设置项，不绕过确认弹窗。

## Acceptance Criteria

* [ ] 左侧项目树聚焦项目后按 `Delete`，显示现有“删除终端？”确认弹窗。
* [ ] 左侧项目树聚焦目录后按 `Delete`，显示现有“确认删除目录？”确认弹窗。
* [ ] 重命名/新建目录输入框内 `Delete` 仍只删除文本。
* [ ] `npx tsc --noEmit` 通过。

## Definition of Done

* 代码改动最小，遵循现有 TreeContext/ProjectTree 模式。
* 完成静态类型检查。
* 列出需要人工验证的桌面 UI 项。

## Technical Approach

通过 `TreeActions` 增加项目和目录的删除请求回调，在 `ProjectTree.handleTreeKeyDown` 中处理无修饰键 `Delete`，按当前 focused visible node 类型调用父组件已有删除确认入口。

## Impact Notes

* GitNexus `ProjectTree` upstream impact：LOW，0 direct callers/processes。
* GitNexus `TreeActions` upstream impact：LOW，直接影响 `TreeNodeItem.tsx`、`ProjectTree.tsx`、`src/components/sidebar/index.tsx`，间接影响 `App.tsx`。

## Out of Scope

* 不做批量删除。
* 不新增可配置快捷键。
* 不改变删除语义、数据库 schema 或后端接口。

## Technical Notes

* 相关文件：
  * `src/components/sidebar/TreeContext.tsx`
  * `src/components/sidebar/ProjectTree.tsx`
  * `src/components/sidebar/index.tsx`
  * `src/components/files/FileExplorerSidebar.tsx`
* 相关规约：
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/frontend/component-guidelines.md`
  * `.trellis/spec/frontend/state-management.md`
  * `.trellis/spec/frontend/quality-guidelines.md`
