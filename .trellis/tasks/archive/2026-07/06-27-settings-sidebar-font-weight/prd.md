# settings sidebar font weight

## Goal

将设置页左侧导航标签文字整体加粗一点，仅提升可读性，不改变字号、颜色、间距、布局和其它页面。

## What I already know

* 目标区域是设置页左侧导航标签：通用、终端设置、快捷键、命令模板、供应商、模型价格、同步、Hook 设置、关于。
* 渲染组件位于 `src/components/settings/SettingsNav.tsx`。
* 当前按钮字重由 Tailwind 类控制：激活项 `font-semibold`，非激活项 `font-medium`。
* 该组件由 `src/components/settings/SettingsLayout.tsx` 引用，设置弹层入口在 `src/components/SettingsModal.tsx`。
* 当前工作区存在用户未提交改动，需避免覆盖无关修改。

## Assumptions (temporary)

* 用户想要的是左侧导航文字比现在略粗，而不是改整个设置页所有标题。
* 单点调整 `SettingsNav` 的字重即可满足诉求。

## Open Questions

* 无阻塞问题；按最小改动处理。

## Requirements (evolving)

* 仅调整设置页左侧导航标签文字字重。
* 激活和未激活状态都要比当前更粗一点，但仍保留激活态更强调的层级。
* 不改文案、不改国际化、不改布局。

## Acceptance Criteria (evolving)

* [ ] 设置页左侧所有导航标签视觉上比当前更粗。
* [ ] 激活态仍明显强于非激活态。
* [ ] 仅涉及设置导航相关代码，无无关副作用。

## Definition of Done (team quality bar)

* 最小改动完成
* 类型检查或最小静态验证通过
* 不影响现有设置页交互

## Out of Scope (explicit)

* 不调整设置页右侧内容区样式
* 不调整字号、颜色、边距、圆角
* 不修改其它页面导航样式

## Technical Notes

* 已检查文件：`src/components/settings/SettingsNav.tsx`、`src/components/settings/SettingsLayout.tsx`、`src/components/SettingsModal.tsx`
* 预期改法：将非激活项从 `font-medium` 提升到 `font-semibold`，激活项从 `font-semibold` 提升到更高字重（优先用现有 Tailwind 任意值类）
