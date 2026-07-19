# 文件重命名改为原地输入

## Goal

文件浏览器中的重命名操作不再弹出对话框，而是在当前文件树行内直接切换成输入框，交互接近 VS Code。

## Requirements

* 右键“重命名”和 F2 触发时，目标行原地显示输入框。
* 输入框默认填充当前文件/文件夹名，并自动聚焦、全选。
* Enter 提交重命名；Escape 取消；失焦提交非空变更。
* 新名称为空或与原名一致时取消，不调用重命名命令。
* 新建文件/新建文件夹继续使用现有弹框，不在本任务改动。
* 目标已存在时继续复用现有覆盖确认弹框。

## Acceptance Criteria

* [ ] 右键文件/文件夹选择“重命名”，该行直接变成输入框。
* [ ] F2 对当前文件/文件夹也进入原地重命名。
* [ ] Enter 提交后文件树刷新。
* [ ] Escape 取消后不改名。
* [ ] 新建文件/文件夹弹框行为不变。
* [ ] `npx tsc --noEmit` 通过。

## Technical Notes

* 主要实现位于 `src/components/files/FileExplorerSidebar.tsx`。
* `src/components/sidebar/TreeNodeItem.tsx` 已有项目树原地重命名组件，可参考其 focus/select/Enter/Escape 行为。
* `renameEntry(path, newName, overwrite)` 已在 `useFileExplorerStore` 中封装，目标存在时会抛出 `target_exists`，当前流程已有覆盖确认处理。
