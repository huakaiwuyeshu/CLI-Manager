# 显示文件 Git 状态

## Goal

在项目文件浏览器中显示每个文件的 Git 状态，并用颜色区分新增、修改、本地编辑和未提交/未跟踪状态，帮助用户在浏览和编辑文件时直接看到工作区变化。

## What I already know

* 用户要求：“文件预留需要显示git 信息使用颜色区分，新增 修改 编辑 和未提交”。
* 相关 UI 是 `src/components/files/FileExplorerSidebar.tsx`，由侧边栏“浏览文件”入口打开。
* 文件树状态由 `src/stores/fileExplorerStore.ts` 管理，当前 `ProjectFileEntry` 只有名称、路径、类型、大小、修改时间和 children。
* 现有 Git 变更面板已实现 `git_get_changes`、`GitFileChange`、`STATUS_CONFIG`，可复用状态与颜色。
* 后端 `src-tauri/src/commands/fs.rs` 的 `file_list_dir` 只返回文件系统信息，不包含 Git 状态。
* 当前编辑器用 `content !== savedContent` 判断未保存编辑状态，可作为“编辑”状态来源。

## Assumptions (temporary)

* “文件预留”理解为“文件浏览/文件列表”。
* “新增”对应 Git `A` 或未跟踪 `??/U`。
* “修改”对应 Git `M`。
* “编辑”对应当前内置文件编辑器中尚未保存的文件。
* “未提交”可能指所有 Git 工作区变更，也可能特指已保存但未 commit 的变更，需要确认。

## Open Questions

* None.

## Requirements (evolving)

* 文件浏览器行需要能展示 Git 状态。
* Git 状态只显示在文件浏览器树和搜索结果中，不扩展到编辑器标签。
* 不使用额外图标/徽标区分状态，直接用文件名颜色区分。
* 不新增依赖，优先复用现有 Git 变更数据和颜色配置。
* 不改变现有文件打开、创建、重命名、删除、复制/移动行为。

## Acceptance Criteria (evolving)

* [ ] 修改过的已跟踪文件名显示“修改”状态色。
* [ ] 新增/未跟踪文件名显示“新增/未提交”状态色。
* [ ] 内置编辑器中未保存的文件名显示“编辑”状态色，且保存后消失或降级为 Git 状态。
* [ ] 搜索结果和普通文件树展示一致。
* [ ] 编辑器标签不显示 Git 状态。
* [ ] 文件行不额外显示状态图标/徽标。
* [ ] 非 Git 项目或 Git 查询失败时文件浏览器仍可正常使用。

## Definition of Done

* TypeScript 类型检查通过。
* Rust 相关改动如有，至少运行 `cargo check` 或相关测试。
* UI 行为通过代码检查或本地运行验证。
* 不提交用户已有的无关未提交改动。

## Out of Scope (explicit)

* 不实现 commit/stage/discard 等新操作入口。
* 不重做现有 Git 变更面板。
* 不在编辑器标签显示 Git 状态。
* 不引入新 UI 库或 Git 依赖。

## Decision (ADR-lite)

**Context**: Git 状态信息已有现成后端命令和前端颜色配置；用户只需要在文件浏览阶段感知状态。

**Decision**: MVP 只在文件浏览器树和搜索结果展示 Git 状态，复用现有 `git_get_changes` 数据与 `STATUS_CONFIG` 颜色，不扩展编辑器标签。

**Consequences**: 改动范围集中在文件浏览器 store/component 和类型定义；编辑器标签保持简洁，但打开文件后不能从标签直接看到 Git 状态。

## Technical Notes

* Inspected `src/components/files/FileExplorerSidebar.tsx`.
* Inspected `src/stores/fileExplorerStore.ts`.
* Inspected `src/lib/types.ts`.
* Inspected `src/components/git/GitStatusIcon.tsx`.
* Inspected `src/stores/gitStore.ts`.
* Inspected `src-tauri/src/commands/fs.rs`.
