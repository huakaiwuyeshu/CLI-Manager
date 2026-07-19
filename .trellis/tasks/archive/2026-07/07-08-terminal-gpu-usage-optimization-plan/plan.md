# Terminal GPU usage optimization plan

## 目标

把终端 GPU 占用先压下来。先治 xterm.js/WebView/WebGL 的实际消耗，再研究是否需要 native renderer。不要直接重写终端层。

## 阶段 0：基线诊断

### 要做

* 增加或整理终端性能诊断日志：
  * 当前终端数量、可见终端数量、active session。
  * WebGLAddon 是否启用。
  * 背景图片、透明、blur、overlay 是否启用。
  * 每秒 PTY 输出字节数、前端 write 次数、丢弃/缓冲次数。
  * resize 触发次数、PTY resize 次数。
* 固定 3 组测试场景：
  * 单终端 idle。
  * 多 Tab + 多 split idle。
  * Codex/Claude 高频输出或构建日志输出。
* 记录 GPU/CPU/内存基线，作为后续 PR 验收依据。

### 验收

* 能复现并量化 GPU 偏高场景。
* 能区分 WebGL、背景效果、后台终端、resize、输出速率分别造成的影响。

## 阶段 1：第一层优化，低风险先落地

### 1. 后台终端降载

* 非 active Tab 不直接写入 xterm UI，只进入 bounded inactive buffer。
* 非焦点 Pane 降低 replay/write 频率。
* 激活时再批量 replay，保持“最终输出可见”，不追求后台实时渲染。

风险：

* 后台终端切回来时可能有短暂 replay。
* 超大输出需要明确丢弃策略，不能无限吃内存。

### 2. WebGLAddon 策略化

* 增加自动降级规则：
  * 低功耗模式开启时禁用 WebGL。
  * 背景图片/透明/blur 开启时优先禁用 WebGL。
  * split 数量超过阈值时只给 active terminal 使用 WebGL，其他用 canvas/默认 renderer。
  * WebGL context lost 后不要立刻重建循环。
* 设置项保留用户手动强制开/关。

风险：

* 默认 renderer 性能和 WebGL 在不同机器上表现不同，需要基线验证。

### 3. 背景效果降级

* 终端背景 blur 默认不参与高频渲染路径。
* 背景图片仅 active terminal 或可见 terminal 计算。
* 多 split 时自动关闭昂贵背景效果，保留纯色背景。

风险：

* 用户视觉偏好会受影响，必须给设置项或清晰降级规则。

### 4. Resize 合并

* 拖拽期间只更新前端布局尺寸。
* 鼠标松开或 settle debounce 后再调用 `pty_resize`。
* resize HUD 可以显示临时 cols/rows，但不要每帧触发 ConPTY 重绘。

风险：

* TUI 在拖拽中尺寸短暂不同步。可接受，最终尺寸必须正确。

### 5. 高频输出限流

* active terminal 使用 frame budget 写入。
* inactive terminal 只缓冲，不触发 render。
* 输出超过上限时保留尾部，记录一次可诊断日志。

风险：

* 后台输出历史可能被截断。需要文案或 debug 日志明确。

### 6. 输入建议与 buffer 扫描节流

* 只在 active、visible、非搜索状态下运行输入建议。
* 输入建议计算必须 debounce。
* 避免每次 render 都扫描 xterm buffer。
* LLM suggestion 必须有更长 debounce 和取消旧请求机制。

风险：

* 建议出现稍慢，但换来稳定性能。

## 阶段 2：第二层优化，学习 Nebula/Alacritty 的工程方式

### 1. 终端参考录制测试

借鉴 Nebula/Alacritty：

* 建立 VT/scrollback/resize 参考测试数据。
* 覆盖：
  * alternate screen。
  * scrollback。
  * resize reflow。
  * OSC 7/8/133/1337。
  * 中文宽字符和 IME 相关回归。
  * Claude/Codex TUI 输入框。

短期可以先做解析/状态层测试，不强求像 Alacritty 一样完整渲染测试。

### 2. Session detach/attach 设计

目标不是马上做 tmux，而是先定边界：

* 关闭窗口是否保留 PTY。
* 应用退出是否保留 PTY。
* 崩溃后恢复到什么程度。
* 多窗口/单实例如何 attach。
* 如何清理孤儿 PTY，避免后台残留进程。

### 3. Hook helper 通道研究

参考 Nebula：

* 当前 HTTP loopback bridge 可以继续用。
* 研究独立轻量 helper + named pipe 的价值：
  * 降低 hook 启动成本。
  * 更准确绑定 pane/session。
  * Codex notify 支持 chain，不覆盖用户已有 notifier。

### 4. Native renderer 可行性研究

只做实验分支：

* 评估 Alacritty/Nebula terminal core 是否可嵌入 Tauri。
* 重点验证：
  * WebView 与 native OpenGL/winit surface 嵌套。
  * 焦点、IME、拖拽、分屏、主题同步。
  * Windows 兼容性。
  * 许可边界和长期维护成本。

结论必须二选一：

* xterm.js 经优化后足够，native renderer 暂缓。
* xterm.js 仍明显达不到目标，再立单独重构任务。

## 推荐拆分 PR

### PR1：诊断与基线

* 增加终端性能诊断开关和日志。
* 固定测试场景说明。
* 不改变默认行为。

### PR2：后台终端降载

* 强化 inactive buffer。
* 可见/active 判断收敛。
* 后台不高频写 UI。

### PR3：WebGL 与背景自动降级

* 增加 renderer 策略。
* 低功耗、多 split、背景效果场景自动降级。
* 设置项保留手动覆盖。

### PR4：Resize 合并

* 拖拽期间只更新布局。
* settle 后调用 PTY resize。
* 验证 TUI 和 Codex/Claude 输入框不被破坏。

### PR5：输入建议和扫描节流

* 限制 suggestion 运行条件。
* 合并 debounce/cancel 逻辑。
* 减少 render-path buffer 扫描。

### PR6：参考测试与架构研究文档

* 建立第一批终端回归样例。
* 输出 detach/attach、hook helper、native renderer 可行性记录。

## MVP 范围

推荐 MVP 只包含 PR1 到 PR4。

理由：

* 最直接对应 GPU 占用。
* 风险可控。
* 不改终端内核。
* 能快速判断 xterm.js 是否还有优化空间。

## 暂不做

* 不直接换 Alacritty。
* 不直接 fork Nebula。
* 不在本任务里做完整 tmux-style resident mux。
* 不把终端功能拆成新的独立进程，除非后续 native renderer 研究证明必要。

## 主要风险

* 后台终端不实时渲染可能影响用户感知。
* 自动降级 WebGL 可能在部分机器上反而变慢，需要基线数据决策。
* resize 合并会让拖拽过程中的 TUI 尺寸短暂不同步。
* 背景效果降级涉及用户偏好，不能硬砍配置。
* native renderer 方向复杂度高，不能混进短期优化。

## 下一步

确认 MVP 范围后，进入实现前准备：

* 读取 frontend/backend spec。
* 对将修改的关键函数做 GitNexus impact analysis。
* 补充 implement/check context。
* 再进入代码实现。
