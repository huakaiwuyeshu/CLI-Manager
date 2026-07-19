# remove-claude-subagent-menu-item

## Goal

删除右键分屏菜单里的“启动 Claude 子Agent”入口，因为当前不再需要该功能入口。

## What I already know

* 用户明确要求删除右键分屏菜单中的“启动 Claude 子Agent”。
* 这是现有 UI 菜单项删除，不是新增功能。

## Assumptions (temporary)

* 只删除菜单入口；若底层启动子 Agent 的函数仅被该入口使用，再评估是否一并删除。
* 不改变其他右键菜单项、分屏逻辑或 Claude Hook 行为。

## Open Questions

* 暂无阻塞问题。

## Requirements (evolving)

* 右键分屏菜单不再显示“启动 Claude 子Agent”。
* 不影响其他分屏/终端右键菜单项。

## Acceptance Criteria (evolving)

* [ ] 代码中该菜单项不再渲染。
* [ ] 前端类型检查通过，或说明未运行原因。

## Definition of Done (team quality bar)

* Tests added/updated if appropriate.
* Lint / typecheck / CI green where available.
* Docs/notes updated if behavior changes.
* Rollout/rollback considered if risky.

## Out of Scope (explicit)

* 不重构右键菜单系统。
* 不改 Claude/Codex Hook 后端能力。
* 不改分屏创建、关闭、切换逻辑。

## Technical Notes

* 右键“向右分屏/向下分屏”打开的分屏终端选择器在 `src/components/TerminalTabs.tsx`。
* GitNexus 影响分析：`TerminalTabs` LOW，`SplitProjectPicker` LOW；无直接上游调用链风险。
* 本任务只删除分屏选择器中的“启动 Claude/Codex 子 Agent”手动入口，不删除 hook 触发的子 Agent 转录面板能力。
