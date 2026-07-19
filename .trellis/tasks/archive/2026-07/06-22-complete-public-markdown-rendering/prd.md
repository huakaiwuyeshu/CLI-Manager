# 完善公共 Markdown 渲染体验

## Goal

把公共 `MarkdownContent` 从“样式可用”补齐到“系统级可维护组件”：覆盖常见 Markdown/GFM 元素，提供固定样例入口用于人工验收，明确链接/图片安全策略，并优化浅色/深色主题、长表格、宽代码块和可访问性细节。

## What I Already Know

* 用户要求“按照你的要求全部处理”，即处理此前列出的遗漏项。
* 当前公共组件是 `src/components/ui/MarkdownContent.tsx`。
* 当前样式集中在 `src/App.css` 的 `ui-markdown` 规则段。
* 当前使用点包括历史详情、Prompt 库、子 Agent 转录、更新说明。
* 项目要求 AI 不自动启动桌面/Tauri 运行时，视觉验证以静态检查 + 人工检查项为准。

## Requirements

* 增加固定 Markdown 样例/fixture，覆盖标题、段落、引用、表格、有序/无序/任务列表、代码、链接、脚注、图片占位等。
* 提供一个可访问的内部预览入口，用公共 `MarkdownContent` 渲染样例，便于人工验收样式。
* 继续优化 GitHub 风格 Markdown：浅色/深色主题变量、宽表格、宽代码块、列表层级、引用、段落、脚注。
* 明确链接策略：默认预览不跳转，明确允许打开的场景才通过 Tauri `openUrl` 外开。
* 明确图片策略：默认不加载远程图片，渲染为可读占位，避免历史内容带来外链加载风险。
* 不引入数学公式、Mermaid 等新依赖；只保留扩展点和样例覆盖。
* 不改后端历史数据结构，不新增 Tauri 命令。

## Acceptance Criteria

* [x] 存在固定 Markdown 样例，覆盖主流 Markdown/GFM 元素。
* [x] 存在内部预览入口，可用公共组件渲染样例。
* [x] `MarkdownContent` 支持 heading slug/anchor、链接策略、图片占位、表格/代码滚动细节。
* [x] `ui-markdown` 样式覆盖 GitHub 风格的标题、段落、引用、表格、列表、代码、脚注、链接、图片占位。
* [x] 浅色/深色主题通过 CSS 变量区分，不依赖单一硬编码颜色。
* [x] `npx tsc --noEmit` 通过。
* [x] `npm run build` 通过。

## Definition of Done

* 前端类型检查和构建通过。
* 不新增依赖。
* 不启动 Tauri 桌面运行时。
* 输出人工检查清单。

## Technical Approach

新增 `src/components/ui/markdownSample.ts` 保存固定样例；新增轻量预览组件并挂到设置/About 区域的开发预览入口，复用 `MarkdownContent`。增强 `MarkdownContent` 的标题锚点、链接策略、图片占位和元素映射；继续用 `App.css` 中的 `ui-markdown` 公共样式做 GitHub 风格细节收口。

## Decision (ADR-lite)

**Context**: Markdown 渲染已公共化，但缺少固定验收样例和若干维护策略。

**Decision**: 用 repo 内 fixture + 现有设置页入口提供人工验收路径，不新增运行时后端或独立路由。

**Consequences**: 实现简单、可维护；视觉验收仍需人工打开应用确认。

## Out of Scope

* 不支持原始 HTML 渲染。
* 不加载远程图片。
* 不新增数学公式、Mermaid、TOC 自动目录依赖。
* 不调整历史后端解析逻辑。

## Technical Notes

* Relevant files:
  * `src/components/ui/MarkdownContent.tsx`
  * `src/App.css`
  * `src/components/settings/AboutSection.tsx`
* Relevant specs:
  * `.trellis/spec/frontend/index.md`
  * `.trellis/spec/frontend/component-guidelines.md`
  * `.trellis/spec/frontend/quality-guidelines.md`
