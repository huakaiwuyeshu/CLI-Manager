# 优化文件拖拽移动体验

## Goal

让文件浏览器的树内拖拽移动更稳定：拖到已展开文件夹后，目标文件夹不应被刷新过程折叠，文件树不应整棵跳动，滚动位置不应回到顶部。

## What I already know

* 当前文件拖拽移动主要在 `src/components/files/FileExplorerSidebar.tsx` 中触发。
* 实际移动复用 `src/stores/fileExplorerStore.ts` 的 `pasteInto`，通过 `clipboard.mode === "move"` 调用后端 `file_move`。
* 现有未提交改动已经实现了树内拖拽移动、根目录 drop、右键菜单图标等逻辑。
* 现有 `pasteInto` 在移动后按顺序执行：
  * `loadDir(targetParentPath)`
  * `loadDir(parentPath(clipboard.path))`
* 当源父目录是根目录或目标目录祖先时，第二次刷新会用不含子节点的目录列表覆盖已有树节点，导致目标展开目录的 `children` 被清掉；UI 看起来像文件夹关闭、树重新排列，滚动位置也可能被内容高度变化夹回顶部。

## Requirements

* 拖拽文件/文件夹到已展开目录后，该目录保持展开。
* 移动后只更新源父目录与目标父目录需要变更的列表，不整棵重置文件树。
* 移动刷新应避免中间态把目标目录子节点清空，降低树高度突变和滚动条跳顶。
* 保留现有复制、粘贴、拖到终端插入路径、重名覆盖确认逻辑。
* 不新增依赖，不改后端接口。

## Acceptance Criteria

* [ ] 将根目录文件拖到已展开子目录后，子目录仍保持展开，并能看到移动后的文件。
* [ ] 将子目录中文件拖回根目录后，文件树不跳回顶部。
* [ ] 将文件拖到另一个文件上仍移动到该文件所在目录。
* [ ] 移动到同一父目录、把目录拖入自身或子目录仍为 no-op。
* [ ] 复制粘贴行为不受影响。
* [ ] `npx tsc --noEmit` 通过。

## Definition of Done

* 改动尽量集中在现有 store / 文件树组件。
* 优先修正刷新顺序和状态更新，不引入新的拖拽框架或复杂动画。
* 静态检查通过，并列出需要人工验证的桌面 UI 场景。

## Out of Scope

* 不实现多选拖拽。
* 不实现跨项目拖拽。
* 不新增拖拽排序。
* 不调整文件树整体视觉风格。

## Technical Approach

优先在 `fileExplorerStore.pasteInto` 中把 move 后的源父目录和目标父目录刷新合并：后端移动成功后并发读取需要刷新的目录，在内存里对 `tree` 依次 `replaceChildren`，最后只 `set` 一次。这样避免 `loadDir(root)` 的中间态清掉已展开目标目录的 `children`。

必要时，在 `FileExplorerSidebar` 的滚动容器上补一个轻量 scrollTop 保持，作为 DOM 层兜底；但首选不加兜底，先修数据层中间态。

## Technical Notes

* 相关文件：
  * `src/stores/fileExplorerStore.ts`
  * `src/components/files/FileExplorerSidebar.tsx`
* 相关既有任务：
  * `.trellis/tasks/06-25-file-browser-menu-icons-drag-move/prd.md`
  * `.trellis/tasks/06-25-fix-file-tree-drag-disabled/prd.md`
