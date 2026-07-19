# 终端 CLI 下拉框样式统一

## Goal

将编辑/新增终端弹窗里的「CLI 工具」建议下拉从浏览器原生 `datalist` 换成项目主题内的下拉样式，解决暗色界面中白色浮层割裂的问题，同时保留可输入自定义 CLI 命令的能力。

## What I Already Know

- 用户截图显示「CLI 工具」输入 `codex` 时弹出的原生建议菜单是白底，和当前暗色弹窗风格不一致。
- 相关代码在 `src/components/ConfigModal.tsx`。
- 当前实现是 `Input` + `list="cli-tool-options"` + `<datalist>`，原生下拉菜单不可稳定主题化。
- 项目已有 `src/components/ui/select.tsx` 的 Radix Select 主题样式，但固定 Select 不适合这里，因为 `cli_tool` 允许自定义命令。
- 前端规范要求表单控件有明确 label，并保持现有状态/存储字段不变。
- GitNexus 影响分析：`ConfigModal` upstream 风险 `LOW`，直接调用者 0，受影响流程 0。

## Requirements

- 替换「CLI 工具」的原生 `datalist` 建议菜单。
- 下拉浮层使用现有主题 token，适配暗色/亮色主题。
- 保留自由输入：用户仍可填写 `claude`、`codex` 之外的自定义命令。
- 保留现有供应商图标显示与 `cliTool.trim()` 保存行为。
- 不改项目数据结构、后端命令、Shell 下拉、保存流程。

## Acceptance Criteria

- [ ] 输入框聚焦或点击箭头后，候选项显示为项目风格的暗色/主题化浮层。
- [ ] 点击 `claude` 或 `codex` 能写入 CLI 工具字段并关闭浮层。
- [ ] 手动输入自定义命令不被候选项限制。
- [ ] 失焦/外部点击会关闭候选浮层。
- [ ] `npx tsc --noEmit` 通过。

## Definition of Done

- 代码改动尽量只限 `src/components/ConfigModal.tsx`。
- 不新增依赖。
- 不启动 Tauri 桌面应用；运行静态检查，并列出人工 UI 验证项。

## Technical Approach

在 `ConfigModal.tsx` 内增加一个小型 `CliToolCombobox`，用现有 `Input`、`VendorIcon`、`ChevronDown` 和主题 class 组合实现主题化建议浮层。移除 `datalist`，但保持 `cliTool` 字符串 state 和保存逻辑不变。

## Out of Scope

- 不重做整个项目配置弹窗。
- 不把 CLI 工具改成固定枚举。
- 不调整 Shell 下拉框、项目分组下拉框或国际化文案。

## Technical Notes

- 读取文件：
  - `src/components/ConfigModal.tsx`
  - `src/components/ui/input.tsx`
  - `src/components/ui/select.tsx`
  - `src/styles/components.css`
  - `.trellis/spec/frontend/component-guidelines.md`
  - `.trellis/spec/frontend/quality-guidelines.md`
- UI 技能查询要点：
  - 表单控件必须有关联 label，不能只依赖 placeholder。
  - 暗色主题控件要保证文本/背景对比度。
  - React 事件处理保持明确类型。
