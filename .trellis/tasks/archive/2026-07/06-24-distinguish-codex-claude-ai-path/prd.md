# 区分 Codex 和 Claude Code 的 AI 路径输出

## Goal

在文件浏览器的 AIFolderPath 复制能力中，根据项目配置的 CLI 工具类型区分 Codex 和 Claude Code，让复制出的路径/上下文/目录树更明确地表达目标 AI 工具来源。

## What I already know

- 用户要求：在已接入 AIFolderPath 功能后，还要“根据项目的类型来区分 codex 和 claude code”。
- 用户补充：需要快捷键，并且要求“和 AIFolderPath 的功能一样”，先理解 AIFolderPath。
- 当前项目模型已有 `Project.cli_tool: string` 字段。
- 项目配置页已有 CLI 工具选项 `claude` / `codex`，也支持自定义文本。
- 现有多处代码使用 `cli_tool` 推断 Claude/Codex，例如终端标签、历史来源过滤、统计来源徽章。
- 上一轮新增的 AIFolderPath 能力集中在：
  - `src/lib/aiPathFormatter.ts`
  - `src/components/files/FileExplorerSidebar.tsx`
  - `src/components/files/FileEditorPane.tsx`
- 当前实现的 AI 路径格式为 `@项目名/相对路径`，未体现 `cli_tool`。
- 用户明确要求：需要使用快捷键。
- 现有快捷键体系在 `src/stores/settingsStore.ts` 的 `keyboardShortcuts` 中维护，并由 `src/components/settings/pages/ShortcutSettingsPage.tsx` 支持录制、清空、恢复默认和冲突提示。
- AIFolderPath 源码理解：
  - `Alt+P` 注册在 `AIFolderPath.CopyOptionsAction`，默认快捷键为 `alt P`。
  - `CopyOptionsAction` 不直接格式化内容，而是按当前默认动作委托给具体 Action。
  - 默认动作配置 `AltPActionOptionStore` 支持 `Copy AI Anchor` / `Copy AI Context` / `Copy AI Path` / `Copy AI Tree`，默认是 `Copy AI Path`。
  - 如果当前没有编辑器上下文，而默认动作是编辑器专用的 Anchor/Context，会自动回退到 `Copy AI Path`。
  - Project View 菜单包含 `Copy AI Path` 和 `Copy AI Tree`。
  - `Copy AI Path` 行为：多选输出多行路径；单目录输出目录路径；编辑器文件有选区时追加 `Lx`/`Lx-Ly`，单行选区还追加选中文本。
  - `Copy AI Anchor` 行为：编辑器中输出 `路径 + 符号 + 行号范围`，无法解析符号时回退路径。
  - `Copy AI Context` 行为：编辑器中输出多行 `path/class/method/lines`，无法解析符号时回退路径。
  - `Copy AI Usages` 行为：依赖 IntelliJ PSI/ReferencesSearch，输出 definition + 前 10 个 usage。
  - `Copy AI Tree` 行为：单目录输出目录摘要树，多选输出合并树，默认深度 2、最多 50 节点。

## Assumptions

- “项目的类型”优先理解为项目配置里的 `Project.cli_tool`，而不是扫描技术栈或目录结构。
- 识别规则应沿用现有模式：`cli_tool` 小写后包含 `codex` 判定 Codex，包含 `claude` 判定 Claude Code；未知值保持通用 AI 输出。
- 不新增后端命令，不读取额外文件，不改变文件系统权限。
- 快捷键应复刻 AIFolderPath 的 `Copy AI` 统一入口：默认 `Alt+P`，默认动作是 `Copy AI Path`，并允许以后扩展默认动作设置。

## Open Questions

- 暂无。用户已确认本次先实现 `Alt+P = Copy AI Path`，默认动作配置后续再做。

## Requirements

- 文件浏览器复制 AI 路径/上下文/目录树时，应能根据项目 `cli_tool` 区分 Claude Code 与 Codex。
- 支持快捷键触发 `Copy AI` 统一入口，默认快捷键使用 `Alt+P`。
- `Alt+P` 默认动作按 AIFolderPath 默认为 `Copy AI Path`。
- 当前上下文无法执行默认动作时，应回退到 `Copy AI Path`。
- 快捷键必须出现在现有“设置 → 快捷键”页面，可录制/清空/恢复默认，并参与冲突提示。
- 本次不实现 “Alt+P 默认动作配置”（Path/Anchor/Context/Tree 切换）；先固定为 Copy AI Path，保留后续扩展空间。
- 未配置或无法识别 `cli_tool` 时，应保持现有通用输出，不报错。
- 不影响现有文件读写、创建、重命名、删除、复制、移动。

## Acceptance Criteria

- [x] `cli_tool` 为 `claude` 或包含 `claude` 时，复制输出能体现 Claude Code。
- [x] `cli_tool` 为 `codex` 或包含 `codex` 时，复制输出能体现 Codex。
- [x] 默认 `Alt+P` 能在文件浏览器/文件编辑器上下文中触发 `Copy AI Path`。
- [x] 如果当前上下文不支持 Anchor/Context/Tree，统一入口应可回退为 Path。
- [x] “设置 → 快捷键”中能看到并修改该快捷键。
- [x] 未识别项目类型时，复制输出保持可用。
- [x] `npx tsc --noEmit` 通过。

## Definition of Done

- Typecheck 通过。
- 改动范围保持在前端格式化/菜单显示，不触碰 Tauri 文件权限和后端文件命令。
- 手动 UI 验证项列出，因为项目规范禁止 AI 自动启动 Tauri 桌面应用。

## Out of Scope

- 自动扫描项目技术栈来判定 CLI 类型。
- 新增独立快捷键设置页或后端文件命令。
- 本次新增 “Alt+P 默认动作”选择设置。
- 完整实现 IDEA PSI usages / LSP 级符号引用；除非后续接入独立代码索引，否则本次只能做“当前文件/当前选区/当前树节点”级能力。

## Decision (ADR-lite)

**Context**: AIFolderPath 的 `Alt+P` 是 Copy AI 统一入口，默认动作是 Copy AI Path，并可配置为 Anchor/Context/Tree。CLI-Manager 目前已有统一快捷键设置，但没有 PSI/LSP 能力，也没有 Alt+P 默认动作配置字段。

**Decision**: 本次先复刻用户可感知的核心路径：新增可配置快捷键 `Copy AI`，默认 `Alt+P`，执行 Copy AI Path；复制内容保持 AIFolderPath 风格的直接路径，避免 `tool:` / `path:` 包装破坏 AI 对 `@项目名/文件` 的识别；默认动作切换作为后续能力。

**Consequences**: 改动面较小，能立即满足快捷键使用；Anchor/Context/Tree 仍可通过现有按钮/菜单触发，未来可在设置中补默认动作选择。

## Technical Notes

- `src/components/ConfigModal.tsx` 中 `CLI_TOOL_OPTIONS = ["claude", "codex"]`。
- `src/components/TerminalTabs.tsx` 已有 `inferVendor`，逻辑为包含 `claude` / `codex` 推断厂商。
- `src/components/sidebar/ProjectTree.tsx` 和 `TreeNodeItem.tsx` 也按 `cli_tool` 推断品牌图标。
- 最小实现位置应在 `src/lib/aiPathFormatter.ts` 接收 `Project.cli_tool` 后统一格式化，调用方不用重复判断。
- `src/hooks/useKeyboardShortcuts.ts` 已处理全局快捷键，但会跳过输入编辑状态；文件编辑器内的快捷键可能更适合在 `FileEditorPane` 局部捕获，文件树焦点则可走全局或侧栏局部捕获。
- AIFolderPath 中可以依赖 IDEA Action/DataContext/PSI；CLI-Manager 只能依赖当前 React 状态、Monaco 选区和已加载文件树，因此“功能一样”应理解为用户可感知的入口和输出语义一致，而不是复制 IntelliJ PSI 实现。

## Implementation Summary

- 新增快捷键动作 `copyAi`，默认 `Alt+P`，接入设置页录制/清空/恢复默认/冲突提示。
- `Alt+P` 在文件编辑器内复制当前文件 AI Path，并保留 Monaco 选区行号；全局 fallback 在非输入、非终端、非编辑器目标下复制当前活动文件或项目根目录。
- AI 路径输出恢复为 AIFolderPath 风格：`@项目名/path`、`@项目名/path L1-L3`、`@项目名/path L1 selected text`；目录树首行直接输出目录路径。
- AI 路径/上下文/目录树复制共用 `src/lib/aiClipboard.ts`，避免多处重复剪贴板 toast 逻辑。

## Verification

- `npx tsc --noEmit`：通过。
- `git diff --check`：通过；仅提示仓库现有 LF/CRLF 换行转换警告。
