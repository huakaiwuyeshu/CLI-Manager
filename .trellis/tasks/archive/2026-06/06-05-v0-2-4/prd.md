# v0.2.4

## Goal

迭代 CLI-Manager v0.2.4。当前用户只明确了目标版本号，具体功能范围、发版内容和验收边界需要确认。

## What I Already Know

* 用户要求：迭代一个版本 v0.2.4。
* 当前任务目录：`.trellis/tasks/06-05-v0-2-4/`，任务状态为 planning。
* 当前前端版本号：`package.json` 为 `0.2.1`，`package-lock.json` 根包为 `0.2.1`。
* 当前 Tauri/Rust 版本号：`src-tauri/tauri.conf.json` 与 `src-tauri/Cargo.toml` 均为 `0.2.1`。
* `CHANGELOG.md` 最新记录为 `V0.2.2 - 2026-06-04`，尚无 `V0.2.4` 条目。
* 工作区已有未提交改动集中在终端 UI 紧凑化：`src/App.css`、`src/components/TerminalTabs.tsx`、`src/components/XTermTerminal.tsx`。
* 另有 Trellis 任务 `.trellis/tasks/06-05-remove-terminal-padding/` 处于 in_progress，可能与当前终端紧凑化改动相关。

## Assumptions (Temporary)

* v0.2.4 可能不只是版本号更新，也可能要收敛当前终端紧凑化改动并补齐发版元信息。
* 不应在未确认范围前直接修改多文件版本号、CHANGELOG 或终端代码。

## Open Questions

* 无。

## Requirements

* v0.2.4 采用“终端紧凑版”范围。
* 收敛当前终端间距/圆角压缩改动，减少终端区域外层留白。
* 保留终端背景图片透明模型，不引入单侧永久留白。
* 将应用版本号统一更新为 `0.2.4`。
* 在 `CHANGELOG.md` 增加 `V0.2.4 - 2026-06-05` 条目。

## Acceptance Criteria

* [x] v0.2.4 范围明确。
* [x] 人工确认：终端普通模式与全屏模式布局紧凑，且无明显单侧 padding。
* [x] 人工确认：背景图片启用时仍可透出，不被 wrapper opaque background 覆盖。
* [x] `package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json` 版本号一致为 `0.2.4`。
* [x] `CHANGELOG.md` 包含 v0.2.4 的核心变更说明。
* [x] 通过最小相关静态检查；运行态 UI 验证按项目约定交由人工完成。

## Definition of Done

* Tests added/updated where appropriate.
* Lint / typecheck / CI-relevant checks pass where feasible.
* Release metadata updated if behavior or version changes.
* Rollout/rollback considered if risky.

## Technical Approach

* 在已有终端布局基础上做最小 CSS/容器类名调整：收紧外层 chrome/well 间距，终端内容区保持贴合容器。
* 按版本更新清单同步 npm、Tauri、Cargo 版本源，并追加 changelog。
* 不新增依赖，不改 Tauri capability/permissions。

## Decision (ADR-lite)

**Context**: 用户选择 v0.2.4 范围为“终端紧凑版”，当前工作区已有相关终端布局改动。
**Decision**: 将本轮版本限定为终端紧凑化 + v0.2.4 发版元信息。
**Consequences**: 改动面会覆盖 UI 布局文件和版本元信息文件；主要风险是终端背景图/全屏布局的视觉回归，需要手动验证。

## Out of Scope (Explicit)

* 不新增依赖。
* 不扩大 Tauri capability/permissions。
* 不重构无关模块。
* 不引入 v0.2.4 之外的新功能包。

## Technical Notes

* 发版相关文件候选：`package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`、`CHANGELOG.md`。
* 当前终端紧凑化候选改动涉及：`src/App.css`、`src/components/TerminalTabs.tsx`、`src/components/XTermTerminal.tsx`。
* 若修改 React 组件函数或共享样式相关符号，需按项目要求先做 GitNexus impact analysis。
