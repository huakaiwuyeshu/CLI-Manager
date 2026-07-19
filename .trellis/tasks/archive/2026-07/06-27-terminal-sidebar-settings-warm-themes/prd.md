# terminal sidebar settings and warm themes

## Goal

为终端侧边栏新增独立设置入口，统一管理侧边栏行为与三个侧边面板（实时统计、Git 变更、文件浏览）的皮肤；支持切换多套浅色暖色皮肤，并允许用户自定义实时统计卡片显示项。

## What I already know

* 设置主入口在 `src/components/SettingsModal.tsx`，当前只有 `general`、`terminal-theme` 等页签。
* `src/components/settings/pages/GeneralSettingsPage.tsx` 里已有“侧栏与行为”区块，包含精简模式、侧栏密度、合并侧边面板、关闭行为、关闭标签确认、Tab hover 信息、调试模式。
* `src/components/terminal/TerminalSidePanel.tsx` 负责三个侧边面板 Tab 容器。
* `src/components/terminal/TerminalStatsPanel.tsx`、`src/components/git/GitChangesPanel.tsx`、`src/components/files/FileExplorerSidebar.tsx` 是这次直接相关的三个 UI。
* 实时统计当前固定渲染 7 张卡片：会话、Token、趋势、模型上下文、工具、最新变更、今日用量。
* 当前这套面板样式主要耦合在 `src/components/stats/termStatsUi.tsx` 的 `TERM/TERM_PANEL` 深色 token 上。
* `src/stores/settingsStore.ts` 已承载设置持久化，适合继续追加侧边栏皮肤与实时统计卡片偏好。
* 当前工作区已有未提交改动，但与本次目标直接冲突的只有相关文件中的小幅演进，需要在实现时保留。

## Requirements

* 新增“侧边栏设置”独立页签。
* 将通用设置中的“侧栏与行为”迁移到“侧边栏设置”中。
* 将实时统计、Git 变更、文件浏览三块 UI 抽象成同一套可切换皮肤。
* 新增多套浅色暖色皮肤供侧边栏面板切换。
* 在侧边栏设置中提供实时统计卡片显示配置。

## Acceptance Criteria

* [ ] 设置面板出现新的“侧边栏设置”页签，并可正常切换。
* [ ] 原“通用设置”中的“侧栏与行为”内容迁移到“侧边栏设置”，通用页不再重复出现。
* [ ] 终端侧边栏中的实时统计、Git 变更、文件浏览三块 UI 能共享同一套皮肤配置。
* [ ] 至少新增数套浅色暖色皮肤，并可即时切换预览。
* [ ] 用户可在设置中控制实时统计显示哪些卡片，设置后立即生效并持久化。
* [ ] 新增文案同时覆盖 `zh-CN` 与 `en-US`。

## Out of Scope

* 不改后端命令或数据库结构。
* 不重做整个应用全局主题系统。
* 不调整终端正文（xterm）主题逻辑。

## Technical Notes

* 预计改动集中在设置页、`settingsStore`、终端侧边栏容器、实时统计卡片容器、Git 面板、文件浏览器面板、i18n。
* 推荐把侧边面板皮肤定义抽成单独的前端 token 映射，而不是继续散落在组件内联样式里。
