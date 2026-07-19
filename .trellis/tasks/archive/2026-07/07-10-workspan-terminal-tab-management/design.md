# Workspan 技术设计

## 数据模型

`TerminalWorkspan` 仅包含：

- `id`
- `paneTree`
- `activePaneId`
- `activeSessionId`

`terminalStore` 新增 `workspans` 与 `activeWorkspanId`，并继续暴露活动 Workspan 的 `paneTree`、`activePaneId`、`activeSessionId` 镜像。

## 状态行为

- `createSession()` 未指定 `paneId` 时创建新的单会话 Workspan；指定 `paneId` 时加入该 Pane 所属 Workspan。
- `setActive(sessionId)` 根据会话归属切换 Workspan，并恢复该 Workspan 上次活动布局状态。
- 所有 Pane 变换同时更新所属 Workspan；只有所属 Workspan 当前活动时才同步兼容镜像。
- 子 Agent 转录根据父会话定位 Workspan，更新非活动 Workspan 时不得抢焦点。
- 关闭最后一个成员时删除 Workspan；活动 Workspan 被移空时选择相邻 Workspan。

## 拖拽合并

- Workspan 拖拽 ID 使用 `workspan:` 前缀，与现有 session tab DnD 分流。
- 顶栏 Workspan 落点用于排序；Pane edge 落点用于合并。
- 合并函数把来源完整 `paneTree` 插到目标 `targetPaneId` 的指定边缘，并校验来源/目标会话集合无交集。
- 中心落点、自身落点和限定视图中的 Workspan 拖拽均为 no-op。

## 持久化与恢复

- `sessionStore` 新增 `workspans`、`activeWorkspanId` 和原子保存方法。
- 落盘前按真实可恢复会话过滤 Pane 树，移除文件编辑器、同步历史和子 Agent 转录。
- 老数据不存在 Workspan 时，每个恢复会话创建独立 Workspan。
- PTY 重建后使用旧 ID 到新 ID 的映射恢复 Workspan；CLI resume、shell snapshot、`cliSessionId` 保留逻辑不变。

## UI

- 新增顶层 Workspan 标签栏，单会话显示会话标题，多会话显示 `Workspan · N`。
- 普通 Pane 只有一个可见视图时隐藏 `PaneTabBar`；多个堆叠视图时保留现有紧凑标签条。
- 所有 Workspan 的 `SplitTerminalView` 保持挂载；非活动项隐藏并向 XTerm 传递 `isVisible=false`。
