# 实时统计显示模型思考强度并补充 shell 图标

## Goal

在终端右侧实时统计面板中，补充当前会话模型的思考强度显示；同时给会话信息中的 `Shell` 行补上图标，保持和现有项目/路径/分支信息区一致的视觉密度。

## What I already know

* 当前实时统计面板入口在 `src/components/terminal/TerminalStatsPanel.tsx`，模型与上下文卡片在 `src/components/stats/termStatsCards.tsx`。
* `Row` 组件已支持 `icon` 属性，当前 `Shell` 行只是没有传图标，不需要改公共组件协议。
* 当前 `HistorySessionUsage` / Rust `HistorySessionUsage` 未包含“思考强度”字段。
* 本机真实 Codex 会话日志已确认存在 `turn_context.payload.effort` 字段，值示例为 `high` / `medium`。
* 本机 Codex 配置 `C:\Users\Administrator\.codex\config.toml` 也存在 `model_reasoning_effort = "high"`，与日志中的 `payload.effort` 一致，可作为字段语义佐证，但实时统计应以会话日志为准。
* 后端历史解析契约文件为 `.trellis/spec/backend/history-stats-contracts.md`；前端文案必须同步 `zh-CN` / `en-US`。

## Assumptions (temporary)

* “模型的思考强度”指 Codex 会话 `turn_context.payload.effort`，优先展示当前会话最近一次有效值。
* Claude 会话大概率没有同名字段；无数据时展示占位符而不是伪造默认值。
* shell 图标仅需在实时统计的会话信息区补充，不要求全局统一替换所有 shell 文本展示点。

## Open Questions

* 是否接受把“思考强度”放在现有“模型与上下文”卡片中，作为模型下一行字段展示，而不是新增独立卡片？

## Requirements (evolving)

* 实时统计面板可显示当前会话模型思考强度。
* 该字段从历史/实时会话详情链路返回，不能在前端硬编码猜测。
* Claude / 无该字段的会话必须安全降级为空占位。
* `Shell` 行增加图标，风格与同区块其他行保持一致。
* 新增或修改的用户可见文案同时支持 `zh-CN` 与 `en-US`。

## Acceptance Criteria (evolving)

* [ ] Codex 会话的实时统计面板可看到思考强度，例如 `high` / `medium`。
* [ ] Claude 或无思考强度字段的会话不报错，显示占位符。
* [ ] `Shell` 行显示图标，且不破坏现有布局。
* [ ] `npx tsc --noEmit` 通过。
* [ ] 若改到 Rust 解析链路，`cargo test` 或至少相关 `cargo check` 通过。

## Definition of Done

* 代码改动限制在实现该需求的最小范围
* 前后端类型一致
* 中英文文案齐全
* 完成静态检查，并列出需要人工确认的 UI 项

## Out of Scope

* 不重做实时统计面板整体布局
* 不扩展到历史详情页或其他非实时面板，除非实现链路复用时被动受益
* 不统一全项目所有 shell 文本展示点的图标

## Technical Notes

* 可能涉及文件：
  * `src-tauri/src/commands/history.rs`
  * `src/lib/types.ts`
  * `src/stores/historyStore.ts`
  * `src/components/stats/termStatsCards.tsx`
  * `src/components/terminal/TerminalStatsPanel.tsx`
  * `src/lib/i18n.ts`
* 真实日志样本已验证：
  * `turn_context.payload.effort = "high"`
  * `turn_context.payload.effort = "medium"`
* `Row` 已支持 `icon?: React.ReactNode`，shell 图标属于局部补参。
