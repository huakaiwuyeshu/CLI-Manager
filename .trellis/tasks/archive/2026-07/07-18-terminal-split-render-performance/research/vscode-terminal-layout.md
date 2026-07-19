# VS Code 终端布局与重绘策略

## 基准

- 本地源码：`D:/work/pythonProject/vscode-main`
- VS Code：1.130.0
- CLI-Manager xterm：`@xterm/xterm 6.1.0-beta.288`

## VS Code 的做法

### 分屏与侧栏拖动

- `terminalGroup.ts` 使用 `SplitView`/Sash 直接更新 DOM pane 尺寸，不通过 React state 驱动每一帧布局。
- 每个 `SplitPane.layout()` 只把最新像素尺寸传给 `TerminalInstance.layout()`。
- 分屏最小尺寸为 80px，布局结构调整期间通过 `disableLayout` 避免发送中间错误尺寸。
- `terminalTabbedView.ts` 在 Sash 拖动期间仅每 100ms 重绘 Tab 列表，终端区域仍由 SplitView 直接布局。
- 几何尺寸没有 250ms CSS transition，避免拖动结束后继续产生 ResizeObserver 风暴。

### xterm resize

- 缓冲区少于 200 行时立即同时 resize。
- 大缓冲区时纵向 rows 立即更新，横向 cols 延迟 100ms；原因是横向 resize 会触发 scrollback reflow，成本远高于纵向 resize。
- 隐藏终端在 window idle 时处理 resize。
- `setVisible(true)` 会先 flush 待处理 resize，再按当前容器尺寸重新计算一次，避免后台创建或隐藏期间缓存了旧尺寸。

### 可见性恢复

- 终端实例保持存活，隐藏只改变可见性，不销毁 parser/buffer。
- xterm RenderService 在 IntersectionObserver 判断不可见时暂停绘制；隐藏期间的 refresh 请求记为 full-refresh-needed，恢复可见后一次性刷新整屏。
- WebGL resize 会同步调整 canvas，并同步请求完整 viewport redraw，避免清空 canvas 后出现闪烁。
- FitAddon 在容器/字符尺寸无效时直接返回；不能在 `display:none` 状态依赖 fit 得到正确尺寸。

## CLI-Manager 差异

1. `Sidebar` 拖动每帧更新 React state，导致大型组件树重复渲染。
2. pane width/height 有 250ms transition，外层侧栏拖动时没有关闭，造成持续布局和 ResizeObserver 回调。
3. `useTerminalDisplay.fitWhenStable()` 只在 `needsViewportRefresh` 时刷新；普通 Tab 切回若 WebGL 未重建且尺寸未变化，没有兜底重绘。
4. `TerminalResizeDebouncer.flush()` 已实现，但没有形成“Tab 恢复/拖动结束提交最终尺寸”的统一调用契约。

## 推荐最小方案

1. 侧边栏拖动用 DOM style/CSS 变量做 live preview，只在 mouseup 提交 React state 和持久化设置。
2. 增加统一 layout-drag 状态，拖动期间关闭 pane 几何 transition；不改变非拖动动画。
3. Tab 恢复采用“先 fit/flush，若恢复帧未产生完整 render，再触发一次 viewport refresh”的条件式兜底，避免每次切换无条件全刷。
4. 拖动结束显式提交最终尺寸；保留 VS Code 的 rows immediate、cols 100ms debounce 策略。

## 风险

- 图谱影响均为 LOW，但 `Sidebar` 本体很大，改动必须限制在宽度预览路径。
- viewport 刷新条件过宽会重新引入逐行扫描；条件过窄会继续保留空白，需要用 render 事件和两帧超时测试锁定。
- resize 结束时若强制滚动，可能破坏用户查看 scrollback 的位置，必须保持滚动状态。
