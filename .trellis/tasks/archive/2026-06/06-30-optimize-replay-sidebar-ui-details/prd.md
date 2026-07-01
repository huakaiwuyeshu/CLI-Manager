# 优化 Replay 右侧栏 UI 细节对齐参考图

## Goal

根据 `docs/ai-replay-ui.png` 调整现有 Replay 右侧栏板块的布局、间距、时间轴、卡片层次和交互细节，使实际 UI 与参考图更一致，并修复当前明显的视觉拥挤问题，同时确保改动局部化，不影响其他并行任务。

## What I already know

* 用户明确要求按 `docs/ai-replay-ui.png` 优化右侧栏 Replay 板块
* 用户已指出一个具体问题：时间轴里的“全部”、时间与竖线距离过近
* 用户新增约束：多任务并行，本次改动不能影响其他任务
* 项目是 Tauri + React 19 + TypeScript + Tailwind CSS 4
* 当前仓库没有激活任务，已创建任务目录用于记录本次需求

## Assumptions (temporary)

* 本次主要是前端 UI 微调与结构优化，不涉及后端接口变更
* 需要尽量复用现有 Replay 数据结构和交互，不做功能扩展
* 参考图代表目标视觉风格，允许在工程约束内做等价实现
* 实施时应限制在 Replay 侧栏相关组件、样式和必要的 i18n 文案内

## Open Questions

* 无

## Requirements (evolving)

* 对齐参考图优化 Replay 右侧栏整体 UI
* 修复时间轴区域的间距与对齐问题
* 改动范围保持局部，不影响其他并行任务和无关模块
* 保持现有 Replay 数据结构和主要交互不变，优先做视觉与布局优化
* 不新增参考图中的齿轮或筛选设置按钮

## Acceptance Criteria (evolving)

* [ ] Replay 右侧栏整体视觉更接近参考图
* [ ] 时间轴标签、时间文本与竖线不再拥挤或重叠
* [ ] 布局在中英文文案下均保持可读和对齐稳定
* [ ] 改动文件集中在 Replay 相关前端组件，不引入无关行为变更
* [ ] 不新增无实际功能支撑的入口按钮

## Technical Approach

在 `src/components/terminal/SessionReplayPanel.tsx` 内局部重排现有布局结构，调整头部、会话卡片、指标卡、筛选区、时间轴列表和详情区的间距、尺寸、对齐与选中态；保持现有 store、数据结构和主要交互不变，必要时仅补充极少量 i18n 文案或 aria 文案。

## Decision (ADR-lite)

**Context**: 参考图包含齿轮与筛选设置入口，但当前产品并没有清晰对应的功能需求；同时用户要求本次改动不要影响其他并行任务。  
**Decision**: 本次只优化现有 Replay 面板 UI，不新增齿轮按钮和筛选设置按钮，不扩展数据或交互能力。  
**Consequences**: 改动范围更可控，风险更低，更适合并行任务环境；代价是与参考图在个别装饰性入口上不会 1:1 一致。

## Definition of Done (team quality bar)

* Tests added/updated (unit/integration where appropriate)
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 不改后端 Replay 数据生成逻辑
* 不顺带重构无关侧栏模块
* 不处理与 Replay 无关的视觉问题

## Technical Notes

* Task dir: `.trellis/tasks/06-30-optimize-replay-sidebar-ui-details`
* 参考图：`docs/ai-replay-ui.png`
* 主要落点：`src/components/terminal/SessionReplayPanel.tsx`
* 数据层已定位：`src/stores/replayStore.ts`
* 用户已同意“最小影响方案”：局部优化 Replay 右侧栏，不影响其他并行任务
