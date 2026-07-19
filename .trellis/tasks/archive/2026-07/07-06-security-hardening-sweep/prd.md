# security hardening sweep

## Goal

按已确认的安全排查报告完成最小必要修复，收紧本地文件访问、WSL 调用、进程清理、渲染外链、同步导入和敏感配置存储边界。

Changelog Target: [TEMP]

## Requirements

* 限制 transcript 显式路径读取范围，避免任意本地文件读取。
* 修复项目文件写入、复制对 symlink/junction 的越界风险。
* 修复 WSL 历史扫描 shell 注入风险。
* 改进 PTY 关闭时的孤儿进程清理，至少补齐非 Windows 的进程组处理。
* 收紧 Tauri capability 与 CSP 的过宽配置。
* 限制 Markdown 链接可打开协议。
* 禁止历史 transcript 文本触发任意本地图片读取。
* WebDAV 密码不再明文持久化。
* 背景图保存增加硬大小上限。
* 外部终端日志不打印完整启动命令。
* 本地同步导入限制 zip 内 `sync.json` 读取大小。

## Acceptance Criteria

* [ ] Rust 安全边界检查覆盖上述后端风险点。
* [ ] 前端不再从不可信 transcript/Markdown 输入打开危险本地资源。
* [ ] 类型检查通过：`npx tsc --noEmit`。
* [ ] Rust 检查/测试通过：`cargo check`、`cargo test`。
* [ ] GitNexus 变更检测范围与本任务一致。

## Definition of Done

* 只修改修复范围内必要文件。
* 不新增依赖。
* 不启动开发服务或构建生产包。
* 记录临时 changelog 条目。

## Out of Scope

* 不重构历史/终端/同步架构。
* 不实现系统级密钥链集成。
* 不改变用户主动选择项目目录的业务模型。

## Technical Notes

* 项目栈：Tauri 2、Rust、React 19、TypeScript、Vite 7。
* 重点文件：`src-tauri/src/commands/fs.rs`、`src-tauri/src/commands/subagent_transcript.rs`、`src-tauri/src/commands/history.rs`、`src-tauri/src/pty/manager.rs`、`src-tauri/capabilities/default.json`、`src-tauri/tauri.conf.json`、`src/components/ui/MarkdownContent.tsx`、`src/components/history/SessionTranscriptContent.tsx`、`src-tauri/src/commands/background.rs`、`src-tauri/src/sync/mod.rs`、`src/stores/syncStore.ts`、`src-tauri/src/commands/shell.rs`。
