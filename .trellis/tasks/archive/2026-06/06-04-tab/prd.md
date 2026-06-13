# 优化终端 Tab 关闭响应速度

## Goal

关闭终端 Tab 时让 UI 立即响应，避免因为后端 PTY 关闭、子进程 kill、reader thread join 等清理动作阻塞 Tab 消失。

## What I already know

* 用户反馈的是关闭终端 Tab 慢，不是关闭整个应用窗口慢。
* 当前点击 Tab 关闭后会走 `closeSession`。
* `closeSession` 现在先等待 `invoke("pty_close")`，然后才更新前端 sessions，因此 Tab 消失会被后端关闭耗时拖慢。
* Rust 侧 `PtyManager::close` 会 kill 子进程并等待 reader thread `join()`，这个等待可能不稳定。
* split 会话当前先关闭第二个 session，再关闭主 session，可能连续等待两次后端清理。

## Requirements

* 关闭终端 Tab 后，前端 Tab 应先从 UI/state 中移除。
* 后端 `pty_close` 改为后台异步触发，不阻塞 Tab UI 消失。
* split 会话关闭时，主 session 和 second session 都要清理，但不阻塞 UI。
* 关闭后仍要正确更新 active tab、session status、tab notification、split、背景隐藏状态和持久化 session 数据。
* 后端关闭失败不应把已关闭的 Tab 重新显示；只记录错误日志或 toast。

## Acceptance Criteria

* [x] 点击普通终端 Tab 的关闭按钮后，Tab 立即从 UI 消失。
* [x] 点击 split 终端 Tab 的关闭按钮后，相关 session 都从 UI 状态清理。
* [x] 后端 `pty_close` 即使较慢，也不阻塞前端 Tab 移除。
* [x] 关闭后重新启动应用，不恢复已关闭的 Tab。
* [x] TypeScript 类型检查通过。

## Definition of Done

* 最小改动，不引入新依赖。
* 保持现有 Zustand store 结构。
* 完成类型检查或说明无法执行的原因。
* 如能运行应用，手动验证关闭 Tab 响应。

## Technical Approach

优先修改 `src/stores/terminalStore.ts`：把 `closeSession` 中的状态清理和持久化提前执行，再用 fire-and-forget 异步调用 `pty_close` 清理主/副 PTY。Rust 侧暂不改动，避免扩大影响面。

## Decision (ADR-lite)

**Context**: Tab 关闭慢是因为 UI 状态更新等待后端 PTY 清理完成。后端清理可能被子进程退出和 reader thread join 拖慢。

**Decision**: 采用前端乐观关闭：先移除 Tab 和持久化，再后台关闭 PTY。

**Consequences**: UI 响应最快；代价是后端关闭失败时不会自动恢复 Tab。该失败属于清理失败，适合记录错误而不是阻塞用户操作。

## Out of Scope

* 不重构 Rust PTY 生命周期。
* 不修改 `PtyManager::close` 的 join 行为。
* 不新增关闭进度 UI。
* 不改变关闭整个应用窗口的行为。

## Technical Notes

* `src/components/TerminalTabs.tsx` 的关闭按钮调用 `closeSession(s.id)`。
* `src/stores/terminalStore.ts` 当前 `closeSession` 在状态更新前等待 `invoke("pty_close")`。
* `src-tauri/src/pty/manager.rs` 的 `PtyManager::close` 会 kill child 并 `join()` reader thread。
