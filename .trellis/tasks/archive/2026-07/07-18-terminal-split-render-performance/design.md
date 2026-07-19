# 终端分屏与重绘性能设计

## 1. Workspan Tab 拖拽分屏

现状：拖动顶部 Workspan Tab 时，`terminalTabCollisionDetection` 能命中其他 Workspan Tab，但 `handleDragOver` 不会激活目标。只有当前 Workspan 的 Pane 挂载且 drop-zone enabled，而当前 Workspan 又等于拖动源，所以 edge preview 条件永远不成立。

方案：

1. 在 `TerminalTabs` 增加 500ms hover activation timer，与 VS Code `TerminalTabsDragAndDrop` 一致。
2. Workspan 拖动进入另一个 Workspan Tab 时启动 timer；目标变化时重置。
3. timer 到期调用现有 `activateWorkspanTab(targetId)`，保持 `activeDragWorkspanId` 不变。
4. 目标 Workspan Pane 挂载后，现有 edge collision、preview 和 `mergeWorkspanAtPaneEdge` 继续工作。
5. drag leave、cancel、end、组件卸载时统一清理 timer。

不修改 Store 合并算法。

## 2. Tab 可见性恢复

现状：普通 Tab 切回只强制 fit；`needsViewportRefresh` 未设置且尺寸不变时不会刷新 WebGL viewport。

方案：恢复可见时进入短暂 render barrier，执行最终尺寸 fit 和完整 viewport refresh；只有收到覆盖全部 rows 的 `onRender` 后揭示，500ms safety timer 保底。这样允许显式重绘，但不暴露逐行扫描。

## 3. 侧边栏 resize

现状：每帧 `setSidebarWidth` 重渲染大型 Sidebar；终端 pane width/height 还有 250ms transition，导致拖动后继续触发 ResizeObserver 和 fit。

方案：

1. sidebar DOM ref 直接更新 live width。
2. mouseup 时一次性同步 state 和持久化。
3. 移除终端 pane 的 left/top/width/height transition，保留 opacity/visibility 动画。
4. 保留现有 `TerminalResizeDebouncer`：大缓冲 rows 立即、cols 100ms debounce。

## Risk

- GitNexus 风险均为 LOW。
- `fitWhenStable` 会影响 IME、replay 和 viewport resize 流程，验证范围需覆盖这些路径。
- hover activation 必须避免 timer 泄漏和拖动结束后的误切换。
