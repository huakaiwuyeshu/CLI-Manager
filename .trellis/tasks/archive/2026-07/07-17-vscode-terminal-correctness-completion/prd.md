# VS Code 终端正确性补齐

## Goal

参照 VS Code 1.130.0 的终端实现，补齐上一轮终端替换中缺失的协议兼容、可靠回放、跨平台输入/resize、后台退出会话恢复、客户端隔离和前端生命周期分层，优先保证终端状态与任务生命周期正确。

## Changelog Target

`[TEMP]`

## Requirements

- daemon 发现信息和鉴权结果必须暴露真实协议版本与 feature，不得用当前应用常量伪装旧 daemon 能力。
- 不兼容 daemon 持有活跃会话时不得杀进程；现有会话通过兼容 transport 继续 attach，结束后切换当前 daemon。
- 启动恢复必须 attach daemon 中仍有 replay 的 alive/exited 会话；仅 daemon 中不存在时才 recreate/resume。
- xterm 通过写入屏障上传 SerializeAddon 检查点，daemon 保存检查点后的原始输出/resize 增量并流式回放。
- spool 读写、attach 和流控不得持有全局会话锁；慢客户端不得阻塞 PTY reader 或其他客户端。
- 同时支持 xterm `onData` 与 `onBinary`，二进制输入必须保持 0–255 原字节。
- 只在真实 Windows ConPTY ready 后启用 `windowsPty`、DA1 回复和 DLL reflow；Unix 不得启用 Windows PTY 行为。
- resize 传递字符与像素尺寸并校验平台边界；Windows 环境变量按大小写不敏感语义合并。
- 普通 tab 切换不得无条件全屏刷新；终端继续在隐藏状态解析输出。
- React 组件与终端生命周期解耦；删除无业务消费者的 capability 空层，addon 按实际需要加载。
- 新增用户可见警告必须同时支持 `zh-CN`、`en-US`。

## Acceptance Criteria

- [ ] 旧 daemon 有活跃会话时，新版本可恢复并操作这些会话，且不会错误启动第二个 daemon。
- [ ] 后台任务在应用退出期间完成后，重新打开仍能看到最终输出并显示 exited。
- [ ] 100 MiB 输出 attach 不会整文件载入内存，也不会阻塞其他会话。
- [ ] 一个客户端停止 ACK 时，其他客户端与 PTY 继续输出。
- [ ] `onBinary` 的 `0x00/0x80/0xff` 可无损到达 PTY。
- [ ] Linux/macOS 不设置 `windowsPty`；ConPTY 正确处理 DA1、reflow、快速 kill/spawn。
- [ ] 普通 tab 切换仅同步 layout，renderer 重建或损坏时才全屏 refresh。
- [ ] TypeScript 检查、终端专项测试、Rust 测试和 diff 检查通过；三平台 CI 覆盖新增协议与平台路径。
- [ ] `[TEMP]` CHANGELOG 和功能清单已更新。

## Definition of Done

- 实现按 P0 正确性、P1 分层性能分批完成。
- 补齐 Rust/TypeScript 单测与必要集成测试。
- GitNexus impact/detect_changes 已执行，未覆盖无关未提交改动。
- 中英文文案和 24 小时时间规则保持兼容。

## Technical Approach

- 使用现有 xterm SerializeAddon 作为权威文本检查点；不引入 `vt100`，因为其序列化只覆盖可见区域且不能完整保持 OSC/图片状态。
- daemon 采用“检查点 + sequence 后原始增量”；attach 支持 delta/reset 两种模式并逐帧交付。
- 全局 session map 只负责索引，每个 session 独立加锁；spool 流式快照读取。
- 当前协议优先使用 WebSocket，旧协议降级到 Tauri/NDJSON 兼容 transport。
- `TerminalInstanceController` 负责 xterm 生命周期、process traits、输入、attach、checkpoint 和可见性。

## Decision (ADR-lite)

**Context**: Rust daemon 无法直接使用 VS Code 的 `@xterm/headless`，而 `vt100` 不能等价恢复 xterm scrollback、OSC 和图片状态。

**Decision**: 由现有前端 xterm 周期生成 SerializeAddon 检查点，daemon 持久保存检查点后的精确原始增量；图片协议会话保持 raw-only。

**Consequences**: 正常退出和崩溃恢复窗口显著缩短；应用关闭期间超大量输出仍受显式磁盘配额约束，超限必须提示回放已截断。

## Out of Scope

- VS Code Remote Authority、扩展宿主和完整 Shell Integration。
- 在 Rust daemon 内嵌 Node/V8 或复制完整 xterm parser。
- 宣称 SerializeAddon 可以恢复图片内容。

## Technical Notes

- VS Code 对照版本：1.130.0；xterm 6.1.0-beta.288。
- 当前工作区已有大量未提交改动，终端变更必须小批次实施并避免格式化无关文件。
- 现有基线：`npx tsc --noEmit`、终端 Node 测试、`cargo test`、`git diff --check HEAD` 已通过。
