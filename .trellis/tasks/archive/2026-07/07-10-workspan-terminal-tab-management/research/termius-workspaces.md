# Termius Workspaces 交互调研

来源：

- https://docs.termius.com/terminal/workspaces
- https://termius.com/blog/workspaces

结论：

- Termius 通过把一个终端标签拖到另一个标签上创建 Workspace。
- Workspace 是顶层标签，内部包含多个仍在运行的终端会话。
- Workspace 提供 Focus mode 与 Split view：前者一次显示一个终端，后者同时显示所有终端。
- 切换 Workspace 不会中断内部会话，布局、标签顺序和名称属于 Workspace 状态。

映射到 CLI-Manager：

- 现有 Pane 树可直接承担 Split view，不应重写。
- 需要新增顶层 Workspan 数据模型，负责会话归属、独立 Pane 树、活动会话与视图模式。
- 拖拽合并只能移动现有 `sessionId`，不能创建或复制 PTY。
