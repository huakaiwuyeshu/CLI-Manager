# 优化开发服务端口占用处理

## Goal

从代码/配置层面优化 `npm run tauri dev` 启动时 Vite 固定端口 `1420` 被占用导致 `beforeDevCommand` 失败的问题，让重复启动或残留 Vite 进程时不再直接崩溃，并保持 Tauri `devUrl` 的固定端口约束。

## What I already know

* 用户反馈：手动结束端口占用后仍然报 `Port 1420 is already in use`。
* 当前 `src-tauri/tauri.conf.json` 配置 `build.devUrl` 为 `http://localhost:1420`，`beforeDevCommand` 为 `npm run dev`。
* 当前 `vite.config.ts` 配置 `server.port = 1420` 且 `strictPort = true`。
* Vite 文档确认：`strictPort` 用于端口不可用时直接失败；Tauri 文档确认：`tauri dev` 会运行 `beforeDevCommand` 并使用固定 `devUrl` 等待前端服务。
* 不能简单把 `strictPort` 改成 `false`，否则 Vite 自动换端口后 Tauri 仍然访问 `1420`，会加载不到正确前端。

## Requirements

* 保持 Tauri devUrl 使用 `http://localhost:1420`。
* 避免已有可用 Vite dev server 占用 `1420` 时，第二次 `npm run tauri dev` 直接失败。
* 如果 `1420` 被非预期服务占用，应给出清晰错误，不静默加载错误页面。
* 不新增 npm 依赖。
* 不自动结束未知进程，避免误杀用户进程。

## Acceptance Criteria

* [x] `1420` 空闲时，`npm run dev` 能正常启动 Vite。
* [x] `1420` 已有可访问 dev server 时，`npm run tauri dev` 不因 Vite strictPort 失败。
* [x] `1420` 被无关服务占用时，命令输出明确提示端口被占用且不是可复用 dev server。
* [x] `npx tsc --noEmit` 通过。

## Definition of Done

* 修改范围保持最小。
* 不新增依赖。
* 完成静态检查，并尽量用实际启动验证。

## Technical Approach

新增一个 Node dev 启动脚本作为 `npm run dev` 入口：

* 检查 `http://localhost:1420` 是否已有可响应服务。
* 如果没有服务，启动 Vite CLI，继续保持 `vite.config.ts` 的 `port: 1420` 和 `strictPort: true`。
* 如果已有服务且响应像当前前端 dev server，则复用该服务并保持脚本进程存活，避免 Tauri 认为 `beforeDevCommand` 失败。
* 如果已有服务但不像当前 dev server，则退出并给出清晰错误。

## Out of Scope

* 不改 Tauri `devUrl` 动态端口。
* 不自动 kill 端口占用进程。
* 不引入 `kill-port`、`detect-port` 等额外依赖。

## Technical Notes

* 已读取 `vite.config.ts`、`src-tauri/tauri.conf.json`、`package.json`。
* 已读取 `.trellis/spec/frontend/index.md`、`.trellis/spec/backend/index.md`、`.trellis/spec/guides/index.md`。
* 已查询 Vite 和 Tauri v2 文档。
