# add-terminal-color-palettes-grouping

## Goal

扩充终端主题配色，并在“设置 → 终端设置”的主题选择区按色系分组展示，避免所有终端主题平铺在一起导致查找困难。

## What I already know

- 用户要求：添加更多终端配色；终端主题要按照色系区分，不要全部放在一起。
- 终端主题预设定义在 `src/lib/terminalThemes.ts` 的 `TERMINAL_THEME_PRESETS`。
- 当前 `TerminalThemePreset` 包含 `id/name/theme/family/tone`，其中 `tone` 只有 `light | dark`，`family` 是主题系列标识。
- 设置页主题列表位于 `src/components/settings/pages/ThemeSettingsPage.tsx`，当前通过 `filtered.map(...)` 直接平铺展示所有主题。
- 现有主题已包含 Tokyo Night、Forest、Graphite、Warm Paper、Dracula、Nord、Solarized、Catppuccin、Gruvbox、Everforest、Rosé Pine、Kanagawa、Ayu、Night Owl、Material、One 等系列。
- 当前同一文件已有一处上一任务改动：终端预览卡片使用 sticky 固定。后续实现要保留这个改动，不回退。

## Assumptions (temporary)

- MVP 只改前端终端主题预设和设置页展示，不改 xterm 实例更新逻辑、不改设置存储字段含义。
- 新增主题应直接加入内置预设，不增加导入/导出或用户自定义主题编辑器。
- 分组应服务于视觉浏览，不能破坏搜索：搜索后仍按组展示匹配项，空组隐藏。
- 现有主题 id 必须保持不变，避免用户已保存的 `terminalThemeName` 失效。

## Open Questions

- 新增终端主题范围先按中等扩充处理：补充一批常见且辨识度高的内置主题，不做一次性大规模主题库。

## Requirements (evolving)

- 增加一批内置终端配色。
- 主题选择 UI 改为分组展示，避免单个大列表平铺。
- 保留现有主题选择、搜索、禁用态和预览联动。
- 保留现有主题 id 和自动主题解析逻辑。

## Acceptance Criteria (evolving)

- [x] 终端设置页主题区按分组显示主题，组标题清晰可读。
- [x] 新增主题可以被选择，并立即反映到右侧终端预览和真实终端主题参数。
- [x] 搜索主题时只显示包含匹配主题的分组；没有匹配项时仍显示“未找到匹配主题”。
- [x] “跟随应用”模式下主题卡片仍禁用，提示文案不丢失。
- [x] 已保存的旧主题 id 仍能正常加载。
- [x] `npx tsc --noEmit` 通过。

## Definition of Done

- 代码改动尽量局限在 `src/lib/terminalThemes.ts` 和 `src/components/settings/pages/ThemeSettingsPage.tsx`。
- 不新增依赖、不新增全局状态。
- 不重构设置页整体布局。
- 完成静态检查；运行态 UI 由用户人工验收。

## Research Notes

### Internet references

- Alacritty theme collection: used as the primary source for additional terminal palette names and hex values.
- Catppuccin official palette: used to confirm Catppuccin flavor naming and colors.
- TokyoNight project: used to confirm Tokyo Night variant naming and terminal support.

### Constraints from current repo

- 主题数据是纯前端常量，`getTerminalTheme(...)` 通过 `themeMap` 按 id 取主题。
- 设置页直接消费 `TERMINAL_THEME_PRESETS`，因此分组可以通过新增元数据或本页内映射实现。
- 保存值是主题 id；只要旧 id 不变，就不需要迁移。

### Feasible approaches here

**Approach A: 按视觉色系分组（推荐）**

- How it works: 给主题预设增加 `group` 元数据，例如「冷色 / 暖色 / 自然绿 / 高对比 / 浅色办公 / 经典主题」。设置页按 group 渲染分组。
- Pros: 符合“按照色系区分”的原始诉求；浏览体验最好。
- Cons: 需要给每个主题分配一个主观但稳定的分类。

**Approach B: 按深色/浅色分组**

- How it works: 直接复用现有 `tone`，分成「深色主题」「浅色主题」。
- Pros: 改动最小，分类客观。
- Cons: 色系区分不够细，深色主题仍会堆在一起。

**Approach C: 双层分组：深色/浅色 + 色系**

- How it works: 顶层分「深色/浅色」，组内再按色系小标题或排序。
- Pros: 结构最完整。
- Cons: UI 更复杂，当前设置页空间有限，容易过度设计。

## Technical Approach

采用 Approach A：在 `TerminalThemePreset` 增加轻量 `group` 字段和一组固定 group 定义；设置页先过滤再按 group 渲染。新增主题以“常见且辨识度高”的内置主题为主，避免引入依赖或远程下载。

## Decision (ADR-lite)

采用视觉色系/视觉气质分组，不使用单纯深浅分组，也不做双层分组。初始分组建议为：冷色、暖色、自然绿、粉紫、经典高对比、浅色办公。

## Out of Scope

- 不做用户自定义终端主题编辑器。
- 不做主题导入/导出。
- 不改应用主题配色方案。
- 不改终端背景图设置。
- 不自动启动 Tauri 桌面应用做视觉验收。

## Technical Notes

- 相关文件：`src/lib/terminalThemes.ts`、`src/components/settings/pages/ThemeSettingsPage.tsx`。
- 可能需要用 GitNexus 在实施前分别分析 `TERMINAL_THEME_PRESETS` / `ThemeSettingsPage` 的改动影响。
