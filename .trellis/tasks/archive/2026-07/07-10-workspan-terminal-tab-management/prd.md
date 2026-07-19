# Workspan 终端标签管理

## Goal

将现有顶层终端标签升级为 Workspan。用户可以把一个顶层标签拖入当前 Workspan 的具体 Pane，并根据左、右、上、下落点预览合并后的布局；普通单会话分屏不再显示标签头，使多个终端呈现为一个融合工作区。

## Requirements

- 顶层项统一由 Workspan 管理；单会话显示原终端标题，多会话显示 `Workspan · N`。
- 普通新终端创建独立 Workspan；显式分屏和派生视图加入对应 Workspan。
- 顶层标签在标签栏内拖放时调整顺序，拖入终端区域时按悬停 Pane 的左、右、上、下合并。
- 来源已经是多终端 Workspan 时整体移动完整 Pane 树，首版不支持拆出单个 Pane。
- 普通单会话 Pane 隐藏标签头；确实包含多个堆叠视图的 Pane 保留紧凑切换条。
- 关闭多会话 Workspan 时复用现有多会话确认并关闭组内全部会话。
- Workspan 切换、排序、合并不得重建或复制 PTY。
- Workspan 的会话归属、Pane 布局、分屏比例和活动状态必须持久化，并兼容现有启动恢复流程。
- 项目、分组或 Worktree 限定视图只做过滤展示，禁用 Workspan 拖拽以避免移动不可见会话。
- Workspan 右键菜单支持通过应用内弹窗设置自定义名称；提交空白名称时清除自定义名称并恢复默认标题规则。
- 自定义名称随 Workspan 布局持久化；取消弹窗不得修改现有名称。
- 新增用户可见文案同时支持 `zh-CN` 和 `en-US`。
- Changelog Target: `[TEMP]`。

## Acceptance Criteria

- [ ] 创建三个普通终端时显示三个独立顶层标签。
- [ ] 拖拽来源标签到目标 Pane 四个方向时，预览与最终布局一致。
- [ ] 合并前后 PTY 数量和 `sessionId` 集合不变且无重复。
- [ ] 已分屏来源整体嵌入目标悬停 Pane，来源顶层标签被移除。
- [ ] 单会话 Pane 无标签头；文件编辑器、同步历史或并行子 Agent 等多视图 Pane 仍可切换。
- [ ] 切换 Workspan 时终端保持挂载、继续接收输出且不丢失 scrollback。
- [ ] 关闭单个 Pane、整个 Workspan 和最后一个 Workspan 时焦点回退正确。
- [ ] 重启恢复后 Workspan 顺序、布局、比例和活动会话正确。
- [ ] 多会话 Workspan 可通过右键菜单弹窗重命名，重启后名称保持不变。
- [ ] 提交空白名称后，单会话恢复终端标题，多会话恢复 `Workspan · N`。
- [ ] 中英文界面文案均可正常显示。

## Out of Scope

- Focus/Split 模式切换、成员侧栏和 Workspan 模板。
- 从已合并 Workspan 中拖出单个 Pane。
- Tauri 多窗口、Rust IPC 或 PTY 协议改动。

## Technical Notes

- 复用现有 `TerminalPaneNode`、四向 Drop Zone、`DragOverlay` 和绝对定位分屏渲染。
- `terminalStore.paneTree`、`activePaneId`、`activeSessionId` 保留为活动 Workspan 的兼容镜像。
- 非活动 Workspan 保持 React 挂载，仅切换可见性。
- 启动恢复必须保留远端新增的 CLI resume / shell snapshot 分流契约。
