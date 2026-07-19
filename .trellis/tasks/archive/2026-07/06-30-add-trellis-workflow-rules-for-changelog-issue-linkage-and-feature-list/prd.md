# Add Trellis workflow rules for changelog, issue linkage, feature list, and simple-task bypass

## Goal

调整本仓库的本地 Trellis 规则，让 AI 在任务开始和结束时遵循统一的交付检查：开始前先检查当前代码是否有更新，结束时补写 `CHANGELOG.md`，用户主动给出 issue 时提交信息需要关联；如果改动涉及功能变更，还要同步更新 `docs/功能清单.md`。同时放宽当前规则，允许简单任务不必强制走完整 Trellis 任务流程。

## What I already know

* 当前 Trellis 本地工作流入口在 `.trellis/workflow.md`。
* `trellis-meta` 说明项目私有规则应优先放在 `.trellis/workflow.md` 或 `.trellis/spec/`，而不是改全局 npm 包。
* 当前 `[workflow-state:no_task]` 仍要求凡是实现/改代码/构建/重构都建任务，只允许用户显式说“skip trellis / 直接改”等口令时跳过。
* 当前 `.trellis/spec/guides/index.md` 只有通用 thinking guides，没有任务开始/结束的项目级交付 checklist。
* `docs/功能清单.md` 是产品功能清单，适合记录功能变化，不适合记录纯内部流程规则本身。
* 用户新增要求：简单任务不需要走 Trellis 流程。

## Assumptions (temporary)

* “开始任务前检查代码是否更新”应定义为：先检查远端跟踪分支是否领先于本地；如果领先，需要先拉取再开始实现，而不只是查看本地最近提交。
* “用户主动发送了 issues”指用户在当前任务明确给出 issue 编号或 issue 链接时，提交信息需要包含对应关联语义。
* “简单任务”应定义为边界清晰、影响范围很小、无需研究和任务拆分的小改动，而不是所有“看起来不大”的实现任务。

## Open Questions

* 无阻塞问题，按现有仓库结构直接落地。

## Requirements (evolving)

* 调整 `.trellis/workflow.md` 的无任务入口规则，让简单任务可以直接 inline 处理，不再强制建 Trellis 任务。
* 在 Trellis 规则中加入“开始实现前先检查当前代码状态/近期更新”的明确要求。
* 在 Trellis 规则中加入“结束任务时需要把行为变更写入 `CHANGELOG.md`”的明确要求。
* 在 Trellis 规则中加入“如果用户主动给出 issue，则提交信息需要关联 issue”的明确要求。
* 在 Trellis 规则中加入“如果涉及功能变更，需要同步更新 `docs/功能清单.md`”的明确要求。
* 把上述规则沉淀到项目级 spec/guide，避免只改 workflow 提示而没有长期文档。

## Acceptance Criteria (evolving)

* [ ] `.trellis/workflow.md` 明确允许简单任务跳过 Trellis 任务流程。
* [ ] `.trellis/workflow.md` 明确要求开始实现前检查当前代码状态。
* [ ] `.trellis/workflow.md` 明确要求结束任务时更新 `CHANGELOG.md`。
* [ ] `.trellis/workflow.md` 明确要求用户主动给出 issue 时，提交信息关联 issue。
* [ ] `.trellis/workflow.md` 明确要求功能变更同步更新 `docs/功能清单.md`。
* [ ] `.trellis/spec/guides/` 中存在对应项目级 checklist，并被 `index.md` 收录。

## Definition of Done (team quality bar)

* Tests added/updated where appropriate
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 不修改 Trellis 全局 npm 安装目录或 `node_modules`。
* 不改应用业务功能代码。
* 不把纯内部 Trellis 流程规则写进 `docs/功能清单.md` 的产品功能条目。

## Technical Approach

优先修改 `.trellis/workflow.md` 中的 `[workflow-state:no_task]`、Phase 2/3 步骤与提交规则；同时新增一份项目级任务交付 checklist 到 `.trellis/spec/guides/`，把开始/结束时的强制检查固化为项目私有规范。

## Decision (ADR-lite)

**Context**: 用户要的是本仓库本地 Trellis 行为调整，而不是上游 Trellis 源码改造；同时这些规则既要影响每轮提示，也要可在后续任务里被复用。

**Decision**: 使用“双落点”方案：`.trellis/workflow.md` 负责实际流程和每轮 breadcrumb 提示，`.trellis/spec/guides/` 负责沉淀项目级 checklist 与解释。

**Consequences**: 改动范围小、可立即生效，且不会污染上游 Trellis；代价是规则会分布在 workflow 和 spec 两个入口，需要保持同步。

## Technical Notes

* Workflow source of truth: `.trellis/workflow.md`
* Shared guide index: `.trellis/spec/guides/index.md`
* Product feature inventory target: `docs/功能清单.md`
* Release notes target: `CHANGELOG.md`
