# 修复终端切换渐进重绘并保留白屏恢复

## Goal

修复终端切换时 xterm 从左上角到右下角逐步重绘的可见过程，同时保留隐藏终端恢复可见时的积压输出恢复和整视口刷新能力，避免重新引入偶发白屏、历史输出延迟补刷问题。

## Requirements

- 保留 `a422e53` 引入的隐藏终端积压写队列恢复逻辑。
- 保留隐藏终端恢复可见时的整视口刷新，不以删除刷新规避问题。
- 整视口刷新期间隐藏 xterm 绘制容器，收到覆盖当前视口的 `onRender` 后一次性显示。
- 设置短超时兜底；即使渲染事件缺失，终端也必须自动恢复显示。
- 后台输出回放的现有隐藏逻辑继续生效，不能提前显示未完成的回放。
- 不重建 `Terminal`、PTY 监听、scrollback 或 WebGL 之外的终端状态。
- `CHANGELOG.md` 记录目标为 `[TEMP]`。

## Acceptance Criteria

- [ ] 普通终端/Workspan 切换不再出现从左上到右下的渐进重绘。
- [ ] 隐藏终端恢复可见时仍会重新拉起积压写队列并执行必要的整视口刷新。
- [ ] 后台有大量输出时，终端在回放完成前保持隐藏，完成后显示最终画面。
- [ ] 未收到 `onRender` 时，超时兜底能恢复终端显示，不产生永久白屏。
- [ ] 分屏尺寸变化、WebGL 重建和窗口前台恢复仍能正确刷新终端。
- [ ] 针对性测试、TypeScript 类型检查通过。

## Technical Approach

- 在 `XTermTerminal` 中增加可见性恢复遮蔽状态，普通回放遮蔽与整屏刷新遮蔽统一决定容器 `visibility`。
- 在触发恢复刷新前注册一次性 `terminal.onRender` 监听；当事件范围覆盖 `0..terminal.rows - 1` 时解除刷新遮蔽。
- 使用短超时作为渲染事件缺失、终端行数变化或渲染器暂停时的兜底，并在再次隐藏、重复刷新和卸载时清理监听与定时器。
- 保持 `terminalVisibility` 的恢复决策语义不变，只补充可单测的遮蔽完成判断或时序辅助逻辑。

## Decision (ADR-lite)

**Context**: `a422e53` 的全视口刷新修复了隐藏终端恢复时的偶发白屏，但刷新过程直接暴露；`1b03ac3` 又让强制 fit 路径执行整屏刷新。

**Decision**: 不撤销刷新，而是在公开的 xterm `onRender` 事件确认整视口完成后再显示终端，并提供超时兜底。

**Consequences**: 增加少量渲染时序状态，但同时保留白屏恢复能力并消除可见的渐进绘制。必须严格清理监听和定时器，避免永久隐藏或泄漏。

## Out of Scope

- 不修改 Workspan 数据结构和挂载策略。
- 不升级 xterm 依赖。
- 不修改 PTY 输出协议、缓存上限或每帧写入预算。

## Technical Notes

- xterm `refresh(start, end)` 在下一次渲染机会请求指定行范围刷新。
- xterm `onRender` 是公开事件，事件包含实际渲染的起止行。
- Research: `research/xterm-render-lifecycle.md`。
- Changelog Target: `[TEMP]`。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
