# fix history session stats card layout

## Goal

修复历史会话详情「上下文」视图顶部统计卡片排版拥挤、文字换行不稳定的问题，让「Token 构成 / 请求统计 / 成本与消息」在不同宽度下更规整可读。

## What I already know

- 用户截图显示顶部四个统计卡片内的 metric 小块排版不齐，长标签和值容易挤在一起。
- 现有入口是 `src/components/history/SessionDetailPane.tsx`，上下文视图由 `src/components/history/SessionContextView.tsx` 渲染。
- 现有样式在 `src/styles/components.css`，`.ui-session-context-view` 使用 `repeat(auto-fit, minmax(230px, 1fr))`，metric 小块使用 2 列 grid。
- 前端类型 `HistorySessionUsage` 目前只有 `tool_call_count`、`mcp_calls`、`skill_calls`、`builtin_calls` 调用次数，没有 MCP/Skill token 消耗字段。
- 后端历史统计规范要求工具事件保持 source truth，不合成不存在的时长/状态；同理不应凭调用次数推断 token 消耗。
- GitNexus impact: `SessionContextView` upstream 风险 LOW，direct callers 0，affected processes 0。

## Requirements

- 保持历史详情「上下文」视图的现有信息结构，不重做数据模型。
- 优先通过卡片内布局和现有调用次数补充展示，解决顶部卡片视觉不满和乱排。
- 新增/修改用户可见文案必须补齐 `zh-CN` 与 `en-US`。
- 不新增依赖，不启动 Tauri 桌面应用。

## Acceptance Criteria

- [ ] 顶部统计卡片在窄宽度和截图类似宽度下不会出现标签和值互相挤压。
- [ ] Token 构成、请求统计、成本与消息卡片高度和内部 metric 排布更一致。
- [ ] 若展示 MCP/Skill 信息，只展示现有可靠的调用次数或占比，不标成 token 消耗。
- [ ] `npx tsc --noEmit` 通过。

## Technical Approach

推荐先做前端局部修复：

- 在 `SessionContextView` 中基于现有 `usage.mcp_calls` / `usage.skill_calls` / `usage.builtin_calls` 计算调用分类总数。
- 在「请求统计」或新增轻量卡片中补充 MCP、Skill、内置工具调用数，填满卡片信息密度。
- 调整 `.ui-session-process-metrics` 子项为更稳定的 label/value 双行或允许标签截断、值右对齐，避免长中文/英文挤压。

暂不做 MCP/Skill token 消耗字段，因为当前日志聚合没有可靠归因字段；若要做，需要后端合同、Rust 解析、前端类型和 UI 一起改。

## Out of Scope

- 不新增后端 MCP/Skill token 归因。
- 不重构历史详情视图结构。
- 不引入新的图表库或 UI 组件库。

## Technical Notes

- Relevant files:
  - `src/components/history/SessionContextView.tsx`
  - `src/styles/components.css`
  - `src/lib/i18n.ts`
  - `src/lib/types.ts`
- UI reference search:
  - Analytics dashboards should stay data-dense and compact.
  - Compact performance/card widgets should include clear numerical labels.
  - Responsive layouts need stable dimensions and padding across breakpoints.
