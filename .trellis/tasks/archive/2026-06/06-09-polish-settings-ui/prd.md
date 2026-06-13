# Polish Settings UI

## Goal

提升设置页的完成度与一致性，优先处理截图中最明显的半成品感和信息噪音：隐藏未实现的全局设置搜索、精简 Hook 设置页的路径/状态展示、统一通用主题与终端主题卡片的视觉密度。

## What I already know

* 用户已同意优先优化：隐藏未实现搜索框、Hook 设置页改成状态卡 + 路径 code 行、统一主题卡片样式。
* `src/components/SettingsModal.tsx` 当前为每个设置 tab 配置 `searchPlaceholder`，全部带“预留”。
* `src/components/settings/SettingsTopBar.tsx` 当前无条件渲染设置搜索框。
* `src/components/settings/pages/HookSettingsPage.tsx` 当前把路径展示成类输入框块，检查项也以大块边框卡片展示，信息密度偏散。
* `src/components/settings/pages/GeneralSettingsPage.tsx` 的 `PaletteCard` 是三色圆点 + 标题 + 描述 + “当前”角标。
* `src/components/settings/pages/ThemeSettingsPage.tsx` 的终端主题按钮是扁平小卡，只显示标题 + 色块，和通用主题卡片密度不一致。
* `src/App.css` 已有 `ui-selection-card` / `ui-interactive` 等通用选择态样式，应沿用，不新增复杂样式体系。

## Assumptions

* 本任务只做设置页 UI polish，不改变任何设置项、状态管理、Hook 安装逻辑或主题数据。
* 终端主题页已有可用搜索功能，保留该局部搜索；隐藏的是设置弹窗顶栏的“预留”全局搜索。
* 本轮不处理项目树标签弱化、标题栏自绘、滚动条 overlay 等 P1/P2 项，避免扩大范围。

## Requirements

* 隐藏设置弹窗顶部未实现的全局搜索框，并移除“预留”占位文案暴露。
* Hook 设置页的路径展示改为更轻量的只读 code 行，降低输入框感。
* Hook 设置页的安装检查项改为更紧凑的状态项，减少大块表单视觉。
* 通用配色卡片与终端主题卡片统一为中等密度：标题、说明/色块、清晰选中态，不引入新交互。
* 保留现有按钮、开关、刷新、安装/删除逻辑和无障碍属性。

## Acceptance Criteria

* [ ] 设置页顶部不再显示“搜索 X 设置（预留）”。
* [ ] 快捷键/模板等依赖 `searchValue` 的页面功能不被破坏；若仍需搜索，应通过页面内部搜索或后续任务处理。
* [ ] Hook 设置页路径不再像可编辑输入框，长路径仍可换行查看。
* [ ] Hook 设置页 Claude/Codex 两块状态信息更紧凑，已安装/未完整状态可一眼区分。
* [ ] 通用配色卡片和终端主题卡片在圆角、padding、选中态、色块尺寸上明显更一致。
* [ ] 不新增依赖，不修改 Rust 后端，不修改设置存储结构。
* [ ] `npx tsc --noEmit` 通过。

## Definition of Done

* 代码仅覆盖确认的 UI polish 范围。
* 类型检查通过。
* 按记忆要求，运行态 UI 由用户人工验收；我不自动启动桌面应用。

## Technical Approach

* 在 `SettingsTopBar` 层支持不渲染搜索区域，`SettingsModal` 不再为未实现全局搜索提供占位。
* 在 `HookSettingsPage` 内局部调整 `PathRow`、`CheckRow` 和卡片内容布局，复用现有 Card/Button/Input/Switch 组件。
* 在 `GeneralSettingsPage` 与 `ThemeSettingsPage` 内对主题卡片 JSX/Tailwind 类做局部统一，复用 `ui-selection-card` 选择态。
* 不改业务逻辑、不加抽象组件，保持最小改动。

## Decision (ADR-lite)

**Context**: 设置页截图中最大问题不是功能缺失，而是未实现搜索暴露、Hook 路径区域表单感强、主题卡片密度不统一。

**Decision**: 采用局部 UI polish，不重构设置架构，不新增设计系统组件。

**Consequences**: 改动小、风险低；全局设置搜索能力暂不实现，后续如果要做真正跨页搜索可单独建任务。

## Out of Scope

* 不实现设置全局搜索。
* 不重做项目树、标签栏或终端工具栏。
* 不自绘 Windows 标题栏。
* 不调整后端 Hook 安装/卸载逻辑。
* 不新增主题数据或依赖。

## Technical Notes

* Inspected: `src/components/SettingsModal.tsx`
* Inspected: `src/components/settings/SettingsTopBar.tsx`
* Inspected: `src/components/settings/SettingsLayout.tsx`
* Inspected: `src/components/settings/pages/HookSettingsPage.tsx`
* Inspected: `src/components/settings/pages/GeneralSettingsPage.tsx`
* Inspected: `src/components/settings/pages/ThemeSettingsPage.tsx`
* Inspected: `src/App.css` shared selection/interactive classes
