# Align theme library cards with general settings card design

## Goal

将终端设置页“独立主题库”的主题卡片改成与通用设置页调色板卡片一致的内容布局：卡片外层保持圆角容器，内容再内缩一层，避免文字和色块贴近边缘或被圆角视觉裁切。

## What I already know

- 用户明确反馈上一版不对，要求参考通用设置里的卡片设计。
- 用户截图显示当前独立主题库卡片内容仍贴近左侧边缘，选中态只是大面积背景色，缺少通用设置卡片的内层留白感。
- 通用设置页已有 `PaletteCard`，使用 `UnstyledButton` + `ui-selection-card` + `p-4`，内部 `Stack` 使用 `padding: "4px 8px 2px"` 实现内容内缩。
- 目标不是重做主题库，而是复用同类卡片视觉语言。

## Requirements

- 独立主题库卡片必须参考通用设置 `PaletteCard` 的结构和留白。
- 卡片内容需要内缩一层，文字和色块不得贴着圆角边缘。
- 选中态 Badge、标题、说明、色块布局不得互相遮挡。
- 保持主题选择、搜索、分组、预览逻辑不变。

## Acceptance Criteria

- [ ] 独立主题库卡片内容与截图中的通用设置卡片一样有明显内层留白。
- [ ] 主题名、说明、色块左侧对齐更靠内，不贴边。
- [ ] 选中卡片仍能清楚显示当前态，不遮挡文字主体。
- [ ] `npx tsc --noEmit` 通过。
- [ ] `npm run build` 通过。

## Definition of Done

- 只修改必要的前端 UI 代码。
- 不改设置存储字段、主题 preset、终端实际渲染逻辑。
- 桌面 UI 由用户人工验收。

## Out of Scope

- 不重构所有设置卡片。
- 不抽象共享卡片组件。
- 不修改通用设置页现有卡片。

## Technical Approach

在 `ThemeSettingsPage.tsx` 的主题 preset `UnstyledButton` 内，按 `GeneralSettingsPage.tsx` 中 `PaletteCard` 的模式增加内部 `Stack` 的视觉内距，并保留终端主题特有的色块数量和选中状态。

## Decision (ADR-lite)

**Context**: 独立主题库卡片和通用设置调色板卡片属于同类“可选卡片”，需要一致的内容留白和选中态视觉。
**Decision**: 不抽象新组件，只在终端主题卡片中直接对齐现有 `PaletteCard` 的内层布局。
**Consequences**: 改动最小、风险低；未来如果更多设置页出现同类卡片，再考虑抽象共享组件。

## Technical Notes

- 参考文件：`src/components/settings/pages/GeneralSettingsPage.tsx` 的 `PaletteCard`。
- 修改文件：`src/components/settings/pages/ThemeSettingsPage.tsx`。
- 相关规范：设置页使用 Mantine 控件；专用视觉内容可保留 Tailwind/CSS 组合。
