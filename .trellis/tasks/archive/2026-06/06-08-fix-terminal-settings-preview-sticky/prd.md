# fix-terminal-settings-preview-sticky

## Goal

让“设置 → 终端设置”里的终端预览在滚动设置内容时保持可见，避免用户调整下方主题、背景等选项时看不到实时预览效果。

## What I already know

- 用户反馈：终端设置页的终端预览在最上方，滚动后会看不到预览。
- 预览实现位于 `src/components/settings/pages/ThemeSettingsPage.tsx`，当前 `terminalPreview` 是右侧网格卡片，但没有 sticky 行为。
- 设置内容滚动容器位于 `src/components/settings/SettingsLayout.tsx` 的 `overflow-y-auto` 内容区。
- `ThemeSettingsPage` 内当前是 `xl:grid-cols-[minmax(0,1fr)_320px]`，预览位于 `xl:col-start-2`。
- GitNexus 对 `ThemeSettingsPage` 的上游影响分析结果：LOW，直接影响 0，影响流程 0。

## Assumptions (temporary)

- MVP 只需要让宽屏布局下右侧终端预览随设置内容滚动保持 sticky 可见。
- 窄屏单列布局不强行 sticky，避免占用过多垂直空间和遮挡表单。
- 不调整设置数据流、不新增状态、不改终端主题逻辑。

## Requirements

- 终端设置页在 `xl` 双列布局下，右侧终端预览卡片应在滚动时保持可见。
- 预览仍保留当前主题色、字体大小、字体族的实时展示能力。
- 不影响左侧终端行为、主题列表、背景设置等表单交互。
- 不改变 Settings 全局滚动容器结构，降低对其他设置页的影响。

## Acceptance Criteria

- [x] 打开“设置 → 终端设置”，向下滚动页面时，宽屏下终端预览仍固定在内容区顶部附近可见。
- [x] 调整字体大小、字体族、终端主题时，预览仍实时反映当前设置。
- [x] 窄屏或单列布局下页面仍能正常滚动，不出现预览遮挡主要设置项。
- [x] `npx tsc --noEmit` 通过，或如无法通过需说明现有阻塞。

## Definition of Done

- 代码改动尽量局限在终端设置页布局。
- 不新增依赖、不新增全局状态。
- 完成静态检查。
- 运行态 UI 由用户人工验收。

## Technical Approach

优先采用 CSS sticky 的最小改动：只给 `terminalPreview` 所在 `Card` 增加宽屏 sticky 定位与顶部偏移，例如在 `xl` 断点下使用 `xl:sticky xl:top-5 xl:self-start`。这样滚动容器仍是现有 `SettingsLayout` 内容区，预览卡片只在右侧列内固定，不影响其他设置页。

## Decision (ADR-lite)

**Context**: 终端预览用于实时反馈主题和字体设置，但当前处于页面顶部，滚动到下方配置时不可见。

**Decision**: 采用局部 CSS sticky，而不是拆分全局设置布局或新增状态同步。

**Consequences**: 改动小、风险低；sticky 只在父滚动容器内生效，窄屏不固定以避免遮挡。

## Out of Scope

- 不重设计设置页布局。
- 不新增“浮动预览面板”或拖拽停靠功能。
- 不改终端背景预览缩略图逻辑。
- 不自动启动 Tauri 桌面应用做视觉验收。

## Technical Notes

- 相关文件：`src/components/settings/pages/ThemeSettingsPage.tsx`。
- 相关布局：`src/components/settings/SettingsLayout.tsx` 的内容区为 `flex-1 overflow-y-auto px-6 py-5`。
- 用户长期偏好：CLI-Manager 运行态 UI 由人工验收，不由 AI 启动服务检查。
