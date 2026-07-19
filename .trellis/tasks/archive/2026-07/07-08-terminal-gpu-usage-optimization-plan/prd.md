# Terminal GPU usage optimization plan

## Goal

降低 CLI-Manager 终端区域的 GPU/CPU 占用，优先解决 xterm.js + WebView + WebGL + 多终端实例 + 背景效果叠加导致的高负载问题。同时吸收 Nebula/Alacritty 的终端工程经验，形成可分阶段执行的优化路线。

## Changelog Target

[TEMP]

## What I already know

* 当前终端实现基于 Tauri + React + xterm.js，使用 `@xterm/addon-webgl`、`@xterm/addon-image`、`@xterm/addon-search`、`@xterm/addon-serialize` 等前端插件。
* Rust 后端 PTY 基于 `portable-pty`，`PtyManager` 负责 PTY 创建、写入、resize、关闭、孤儿进程清理。
* 当前代码已经有一些性能保护：inactive buffer、active write queue、WebGL 隐藏后延迟释放、PTY 输出合并、最小 cols/rows、部分 resize 防抖。
* 用户反馈当前 CLI-Manager GPU 占用过高，希望参考 Nebula/Alacritty。Nebula 的优势集中在原生终端内核、OpenGL 渲染、dirty rendering、常驻 session、resize 合并、AI hook helper、参考录制测试。

## Requirements

* 建立终端 GPU 占用优化任务，先输出计划，不直接改业务代码。
* 短期优先做第一层优化：
  * 后台 Tab / 非焦点 Pane 降低渲染频率或停止渲染。
  * WebGLAddon 改为可控策略，而不是在所有场景无差别启用。
  * 背景图片、透明、blur、overlay 与 WebGL 的组合需要降级策略。
  * resize 拖拽期间避免高频 PTY resize，停止拖动后再应用最终尺寸。
  * 高频输出只让 active terminal 进入高频 UI 写入，后台终端只保留缓冲和状态。
  * 输入建议、TUI buffer 扫描、搜索/图片能力必须节流并只在必要时运行。
* 中期吸收第二层架构经验：
  * 设计终端性能诊断指标和开关。
  * 引入终端参考录制/回归测试思路。
  * 调研 session detach/attach 的产品化边界。
  * 评估 hook helper + named pipe 是否可降低 hook 启动和通信成本。
  * 保留 Alacritty/Nebula native renderer 作为实验分支，不纳入本 MVP。

## Acceptance Criteria

* [ ] 形成可执行的阶段计划，明确短期、中期、暂不做范围。
* [ ] 明确需要调研或修改的关键模块和风险点。
* [ ] 明确第一阶段的验收指标，包括 GPU 占用、后台终端行为、resize 行为、WebGL 降级策略。
* [ ] 明确第二阶段的架构学习项，包括测试、session 模型、hook 通道、renderer 可行性。
* [ ] 未经确认不进入代码实现。

## Definition of Done

* 任务目录包含 PRD 和计划文件。
* 计划能拆成后续小 PR 或子任务。
* 后续进入实现前，必须按 Trellis 规则补充 spec context，并做影响分析。
* 实现阶段需要跑前端类型检查；涉及 Rust PTY 时需要跑 `cargo check`，但本规划任务不主动运行构建。

## Technical Approach

先做低风险的 xterm/WebView 渲染策略优化，不直接替换终端内核。核心思路是减少不必要的绘制、减少 WebGL 合成压力、减少拖拽期间的 PTY 重绘、限制后台终端 UI 工作量。Nebula/Alacritty 的经验作为设计参考，先落到测试体系、session 模型和 hook 通道设计上。

## Decision (ADR-lite)

**Context**: 用户反馈 GPU 占用高，并指出 Alacritty/Nebula 原生终端性能明显优于 xterm.js。

**Decision**: MVP 不替换 xterm.js；先做 xterm/WebView 层面的低风险性能治理，同时建立 native renderer 可行性研究路径。

**Consequences**: 短期能更快降低 GPU 占用，避免一次性重写终端层；长期如果 xterm.js 天花板仍明显，再以实验分支验证 Alacritty/Nebula 方向。

## Out of Scope

* 本任务不直接把终端替换为 Alacritty。
* 本任务不新增重量级依赖。
* 本任务不重构整个终端布局系统。
* 本任务不改变 Claude/Codex 历史解析、统计看板、项目管理主流程。

## Open Questions

* 第一阶段是否只做“低功耗模式 + 自动降级策略”，还是同时改默认行为？
* GPU 占用验收以哪台机器和哪组场景为准？

## Technical Notes

* 重点前端文件：
  * `src/components/XTermTerminal.tsx`
  * `src/stores/terminalStore.ts`
  * `src/stores/settingsStore.ts`
  * `src/lib/terminalInputSuggestions.ts`
  * `src/lib/terminalVisibility.ts`
  * `src/lib/terminalThemes.ts`
* 重点后端文件：
  * `src-tauri/src/pty/manager.rs`
  * `src-tauri/src/commands/terminal.rs`
  * `src-tauri/src/claude_hook.rs`
  * `src-tauri/src/hook_client.rs`
* 外部参考：
  * `https://github.com/Kuddev/nebula`
  * `https://github.com/alacritty/alacritty`
