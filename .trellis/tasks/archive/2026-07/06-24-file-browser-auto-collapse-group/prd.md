# 文件浏览器自动折叠目录聚合行

## Goal

文件浏览器不直接展开常见生成目录、缓存目录和 AI 工具输出目录，而是按 JetBrains 风格把这些被自动折叠的目录聚合成一行，例如“已折叠文件: 13”，减少树列表噪音；用户仍可点击该行展开查看。

## What I already know

- 用户给了截图，期望类似 JetBrains Project 树底部的“已折叠文件: 13”聚合行。
- 当前 `src/stores/fileExplorerStore.ts` 已有 `DEFAULT_COLLAPSED_DIRECTORY_NAMES` 名单与默认折叠判断。
- 当前 `src/components/files/FileExplorerSidebar.tsx` 负责文件树渲染，已有目录右键折叠和单子目录链压缩。
- 当前工作区已有其他未提交改动，包括 AI 路径复制相关逻辑；本任务必须避免覆盖这些改动。

## Requirements

- 在文件浏览器树中，被默认折叠名单匹配的目录默认不作为普通目录行展示。
- 同一层级内匹配默认折叠名单的目录聚合成一行，显示数量：`已折叠文件: N`。
- 点击聚合行后展开显示这些目录；展开后目录保持现有树行、右键菜单和打开/折叠行为。
- 目录右键菜单显示“忽略”，忽略后该目录加入当前项目的“已折叠文件”聚合行。
- 手动忽略的目录需要按项目持久化，下次进入同一项目仍保持忽略。
- 搜索结果不做聚合，避免隐藏搜索命中。
- 不改后端文件 I/O、不改删除/移动/复制语义。

## Acceptance Criteria

- [ ] 根目录下 `.git`、`.trellis`、`dist` 等匹配项默认只计入“已折叠文件: N”。
- [ ] 点击“已折叠文件: N”后能看到这些目录，再次点击可收起。
- [ ] 右键目录选择“忽略”后，该目录进入“已折叠文件: N”聚合行。
- [ ] 重启或重新进入同一项目后，手动忽略目录仍保持聚合。
- [ ] 普通目录和文件仍按原有方式显示。
- [ ] 搜索模式仍直接显示匹配结果。
- [ ] `npx tsc --noEmit` 通过。

## Technical Approach

- 在 `fileExplorerStore` 暴露判断默认折叠目录的 helper，继续以名单作为单一来源。
- 在 `FileExplorerSidebar` 渲染层把当前层级的 entries 分成普通项和默认折叠项。
- 新增本地 UI 状态记录哪些层级的聚合行已展开；展开状态不持久化，刷新后恢复默认聚合。
- 手动忽略路径通过 `settings.json` 按项目持久化。

## Out of Scope

- 不新增设置页配置名单。
- 不隐藏文件，只聚合目录。
- 不修改后端搜索、读取、复制、移动、删除命令。

## Technical Notes

- 相关文件：`src/stores/fileExplorerStore.ts`、`src/components/files/FileExplorerSidebar.tsx`。
- UI 样式应复用 `ui-file-tree-row`，避免新增复杂视觉体系。
