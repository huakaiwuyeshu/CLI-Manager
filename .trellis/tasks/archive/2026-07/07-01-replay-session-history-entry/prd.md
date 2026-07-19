# refine ai replay session model and history entry

## Goal

收敛 AI Replay 的会话呈现方式，让用户默认只看到“当前聚焦内部终端的当前会话”，降低理解成本；同时补一个明确的“历史会话”入口，保留回看能力但不再把多会话直接平铺在主界面。

## Changelog Target

V1.2.4

## What I already know

* 用户认为当前会话卡片标题使用 `Codex CLI done/running` 等技术状态，不适合作为主标题。
* 用户倾向把会话标题改成“发给 CLI 的第一句话”，也接受后续升级成“本地摘要标题”。
* 用户认为 Replay 主视图不应该直接平铺所有已记录会话，而应该绑定当前聚焦内部终端的当前会话。
* 用户同意增加单独的“历史会话”入口来查看旧会话。
* 当前 Replay 面板实现在 `src/components/terminal/SessionReplayPanel.tsx`。
* 当前 Replay 会话和事件落库逻辑在 `src/stores/replayStore.ts`。
* 当前会话标题来自 hook payload title / 已有 title 回退，不是用户 prompt 标题。

## Assumptions (temporary)

* 首版优先做“首条用户消息截断标题”，不在本任务内引入额外摘要模型或后端 summarization 流程。
* “历史会话”入口应放在 Replay 面板内部，而不是再新增全局入口。

## Open Questions

* None.

## Requirements (evolving)

* Replay 主视图默认绑定当前聚焦内部终端的当前 Replay 会话。
* 会话标题优先使用首条用户 prompt 的截断文本；没有 prompt 时回退到来源名，而不是 `Codex CLI done/running` 这类技术状态。
* 历史会话通过 Replay 头部右上角入口展开轻量列表并切换查看，不再在主视图顶部平铺多会话卡片。
* 当前 / 历史会话的运行状态降级为副信息展示，不再占据主标题语义。

## Acceptance Criteria (evolving)

* [ ] 打开 Replay 时，默认看到的是当前聚焦终端对应的当前会话，而不是最近 N 个会话卡片列表。
* [ ] 会话主标题不再显示 `Codex CLI done/running` 这类技术状态文案。
* [ ] 用户可通过明确入口查看历史 Replay 会话并切换查看。
* [ ] 历史入口不会打断时间轴主阅读路径。

## Definition of Done (team quality bar)

* Tests added/updated where appropriate
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 引入 AI 自动总结标题
* 重做整个 Replay 时间轴数据模型
* 扩展到历史会话总览页面之外的跨页面导航

## Technical Notes

* 可能影响文件：
  * `src/components/terminal/SessionReplayPanel.tsx`
  * `src/stores/replayStore.ts`
  * `src/lib/i18n.ts`
  * `CHANGELOG.md`
  * `docs/功能清单.md`
* 已选定交互：`SessionReplayPanel` 头部右上角增加“历史会话”按钮，展开内联轻量历史列表；浏览历史会话时显示“返回当前”按钮。
