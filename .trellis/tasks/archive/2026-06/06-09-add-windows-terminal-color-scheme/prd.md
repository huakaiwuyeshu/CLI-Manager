# Add Windows Terminal Color Schemes

## Goal

在内置终端主题预设中补齐 Windows Terminal 内置配色，让喜欢 Windows Terminal 视觉风格的用户可以直接选择官方同款色表。

## What I already know

* 用户希望添加 Windows Terminal 的全部内置配色。
* 当前终端主题集中定义在 `src/lib/terminalThemes.ts`。
* 设置页通过 `TERMINAL_THEME_PRESETS` 和 `TERMINAL_THEME_GROUPS` 自动展示主题，不需要单独改 UI 列表逻辑。
* GitNexus 对 `TERMINAL_THEME_PRESETS` 的 upstream 影响分析结果为 LOW，未发现受影响流程。
* Microsoft Learn 文档说明 Windows Terminal 默认 `colorScheme` 为 `Campbell`，并列出内置配色名称。
* 官方/社区摘录的 defaults.json 色表包含：`Campbell`、`Campbell Powershell`、`Vintage`、`One Half Dark`、`One Half Light`、`Solarized Dark`、`Solarized Light`、`Tango Dark`、`Tango Light`。
* 项目已有 `Solarized Dark` / `Solarized Light` 主题名称，本任务优先补齐缺失项，避免重复名称。

## Requirements

* 在终端主题预设中补齐 Windows Terminal 内置配色中当前缺失的主题。
* 新主题应出现在现有主题选择 UI 中，并可被搜索。
* 新主题应使用 Windows Terminal defaults.json 对应的 background、foreground、cursor、selection 和 16 色 ANSI 映射。
* 不改变已有主题 ID、默认值或自动主题映射。

## Acceptance Criteria

* [ ] 主题列表中可搜索/选择 `Windows Terminal Campbell`、`Windows Terminal Campbell PowerShell`、`Windows Terminal Vintage`、`Windows Terminal One Half Dark`、`Windows Terminal One Half Light`、`Windows Terminal Tango Dark`、`Windows Terminal Tango Light`。
* [ ] 每个新增主题都映射完整 xterm `ITheme` 色表。
* [ ] 选择新增主题后，终端预览和实际 xterm 主题使用新增配色。
* [ ] TypeScript 类型检查通过。

## Definition of Done

* Typecheck 通过。
* 变更范围保持在最小必要文件内。
* 若无法由 AI 直接运行桌面 UI，则明确说明需人工验收。

## Out of Scope

* 不新增主题导入功能。
* 不重复添加项目里已经存在的 `Solarized Dark` / `Solarized Light`。
* 不改变应用主题或终端主题默认选择逻辑。
* 不修改字体、背景图片、透明度等非配色功能。

## Technical Notes

* 主要文件：`src/lib/terminalThemes.ts`。
* 相关 UI：`src/components/settings/pages/ThemeSettingsPage.tsx` 只消费预设数组，当前无需改动。
* Windows Terminal 色表字段 `purple` / `brightPurple` 需要映射到 xterm 的 `magenta` / `brightMagenta`。
