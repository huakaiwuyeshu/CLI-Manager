# Refine project tree badges

## Goal

把项目树里的 CLI 工具徽章改得更克制：文字弱化，主要通过左侧小色点和细边框区分工具，让项目树整体更干净。

## What I already know

* 用户明确希望采用“文字统一弱化，只用左侧小色点/细边框区分工具”的方案。
* 当前项目树项目项在 `src/components/sidebar/TreeNodeItem.tsx` 中渲染 CLI 工具徽章。
* 当前 `p.cli_tool` 已写入 `data-cli-tool={p.cli_tool.trim().toLowerCase()}`，可以直接用 CSS 按工具名区分。
* 当前徽章样式集中在 `src/App.css` 的 `.ui-tree-meta-chip` 及其 `data-cli-tool` 变体。

## Assumptions (temporary)

* 本次只调整视觉样式，不改变项目树交互、数据结构或 CLI 工具显示文本。
* 不新增依赖，不改业务逻辑。

## Open Questions

* 无阻塞问题。

## Requirements

* CLI 工具徽章文字颜色统一弱化，降低视觉抢占。
* Claude / Codex / Gemini 仍通过左侧小色点和细边框保持可识别。
* 未知 CLI 工具使用默认主色小色点/边框。
* 保持现有尺寸和布局，不引入明显高度变化。

## Acceptance Criteria

* [x] 项目树 CLI 工具徽章不再使用大面积彩色背景作为主要识别方式。
* [x] Claude / Codex / Gemini 徽章仍能通过色点/细边框区分。
* [x] TypeScript 组件逻辑无需改动，或只做必要的样式 class 调整。
* [x] 运行静态检查或直接验证改动范围。

## Definition of Done

* 样式修改完成。
* 影响范围保持在最小必要文件。
* 完成基本验证。

## Out of Scope

* 不重做项目树布局。
* 不改分组数量徽章、运行状态圆点、路径异常徽章，除非样式冲突必须微调。
* 不新增 CLI 工具枚举或配置项。

## Technical Notes

* 目标文件预计为 `src/App.css`。
* 现有组件位置：`src/components/sidebar/TreeNodeItem.tsx`。
