# fix-terminal-osc-color-reply-leak

## Goal

修复 Codex 终端颜色探测响应泄漏到输入框的问题，确保实时 OSC 10/11 查询低开销、有序回复，历史 Replay 不产生任何 PTY 输入副作用。

## Changelog Target

`[TEMP]`

## Requirements

- 实时输出中的同批 OSC 10/11 查询合并为一次 PTY 写入。
- Replay 中的 OSC 10/11 查询只从显示流移除，不向当前 PTY 回写。
- 保持现有 OSC 7/133/633/777 处理、终端主题颜色和 PTY ACK 语义不变。
- 不新增依赖，不修改后端协议。

## Acceptance Criteria

- [x] Codex 同批前景色和背景色查询只触发一次有序写入。
- [x] Replay 解析颜色查询时不触发写入。
- [x] 相关 Node 回归测试与 TypeScript 类型检查通过。
- [x] `CHANGELOG.md` 的 `[TEMP]` 记录本次修复。

## Verification

- `node --test scripts/terminalOsc.test.mjs scripts/ptyHostSocket.test.mjs scripts/terminalProcessManager.test.mjs scripts/terminalReplay.test.mjs scripts/terminalVisibility.test.mjs`：24/24 通过。
- `npx tsc --noEmit`：通过。
- `git diff --check`：通过。

## Root Cause

终端输出规范化函数同时负责显示流转换和 PTY 回写副作用，并被实时输出与历史 Replay 共用；实时查询分别异步写入，Replay 则会错误重新回复历史查询。

## Out of Scope

- 不调整 Codex 本身的终端探测逻辑。
- 不重构 PTY WebSocket 协议或 xterm 生命周期。

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
