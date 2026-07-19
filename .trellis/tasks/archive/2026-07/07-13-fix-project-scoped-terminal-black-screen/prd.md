# 修复按项目聚焦终端切换黑屏

## Goal

启用“按项目聚焦终端”后，切换项目只改变终端可见性和分屏布局，不销毁、重建或完整回放已有 xterm 实例，消除长 scrollback 场景下的渐进重绘与短暂黑屏。

## Requirements

- 每个 PTY 会话在生命周期内保持同一个 `XTermTerminal` 实例和稳定 React key。
- 项目、目录分组、Worktree 过滤继续折叠不相关分屏，不保留空白区域。
- 隐藏终端继续使用现有增量输出缓冲，恢复显示时只 flush 隐藏期间的新输出并重新 fit/refresh。
- 保留 All、项目、目录分组、Worktree、Workspan、分屏与全屏现有行为。
- 不修改 xterm 渲染器策略，不新增依赖、设置项或用户可见文案。
- Changelog Target: `[TEMP]`。

## Acceptance Criteria

- [x] 长 scrollback 终端连续切换项目时，代码路径不再触发完整快照序列化和终端实例重建。
- [x] 同一 Workspan 混合多个项目分屏时，过滤模型折叠无关分屏且保留原始挂载树。
- [ ] 隐藏期间产生的 PTY 输出在恢复后只追加一次，无明显丢失或重复。
- [x] 相关 Node 测试通过。
- [x] `npx tsc --noEmit` 通过。

## Technical Approach

- `TerminalTabs` 分离稳定挂载模型与作用域可见模型：所有原始 Workspan/Pane Tree 始终挂载，过滤树仅用于可见标签、活动项和布局。
- `SplitTerminalView` 同时基于原始树保留所有 Leaf，并基于过滤树计算可见 Leaf 的折叠矩形和分隔条。
- 删除 `preservedHiddenPtySessions` 的独立隐藏重建分支，复用 `XTermTerminal` 已有的 `isVisible` 恢复逻辑。

## Decision (ADR-lite)

**Context**: 当前作用域切换会把终端从主布局卸载，再以不同父节点和 key 挂载到 1×1 隐藏容器，导致完整 scrollback 序列化、回放和 WebGL 上下文抖动。

**Decision**: 维持每个终端的稳定组件身份，只切换布局矩形、隐藏状态和 `isVisible`。

**Consequences**: 隐藏终端实例数量不增加；实现需覆盖分屏折叠和 Workspan 可见模型，回归重点为分屏、全屏、拖拽和后台输出。

## Out of Scope

- 重构 `XTermTerminal` 内部写入队列、快照持久化或 WebGL 策略。
- 修改终端 scrollback 上限或低内存模式行为。
