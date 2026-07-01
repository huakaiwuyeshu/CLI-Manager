# Fix codex light border and duplicate IME input

## Goal

修复 CLI-Manager 内 Codex CLI 在浅色模式下输入区/提示区出现黑色边框的问题，并排查中文输入法在确认上屏后偶发重复提交导致内容重复的问题。

## What I already know

* 用户反馈 2 个问题：浅色模式下 Codex CLI 输入区出现黑色边框；中文输入如“感觉”偶发变成“感觉感觉”。
* 用户怀疑第一个问题可能和 `.trellis/tasks/archive/2026-06/06-28-fix-light-terminal-background-contrast/` 的历史修复有关。
* GitHub `issue #72` 当前页面内容与本次反馈不一致；需要按实际症状定位，不以 issue 标题为准。
* 项目为 Tauri + React + TypeScript；终端前端实现位于 `src/components/XTermTerminal.tsx` 附近，样式位于 `src/styles/`。
* 用户新增约束：多任务并行，本次修复必须最小范围落地，不能影响其他任务。

## Assumptions (temporary)

* 黑色边框问题大概率是浅色主题下终端容器、提示输入区或 ANSI 背景颜色回退值不一致导致。
* 输入重复问题大概率与 xterm / textarea / IME composition 事件、粘贴回退路径或本地回显逻辑重复触发有关。

## Open Questions

* 黑色边框是否是历史修复回归，还是 Codex CLI 新输出样式未覆盖？
* 输入重复是否只出现在 Codex CLI，还是所有终端会话都可能出现？

## Requirements (evolving)

* 定位并修复 Codex CLI 浅色模式黑色边框问题。
* 本轮先不修改 Codex CLI 中文输入法重复上屏行为，只补充 Codex 定向诊断，避免扩大影响面。
* 改动范围限制在 Codex 终端相关实现，不扩散到无关任务文件或其他 CLI 行为。

## Acceptance Criteria (evolving)

* [ ] 浅色模式下，Codex CLI 输入区不再出现突兀的黑色边框/黑底块。
* [ ] 本轮不改变 Claude CLI 与普通 shell 的现有终端输入行为。
* [ ] 为 Codex 输入重复问题保留足够的前端诊断信息，便于后续在不碰共享输入链路的前提下继续收敛。

## Definition of Done (team quality bar)

* Tests added/updated where appropriate
* Lint / typecheck / CI green
* Docs/notes updated if behavior changes
* Rollout/rollback considered if risky

## Out of Scope (explicit)

* 不处理与本次症状无关的终端主题重构。
* 不顺手修改其他 CLI（Claude/cc）未复现的问题，除非定位后证明共用根因。
* 不做大范围输入链路重构，不替换 xterm，不新增第三方输入法库。
* 本轮不直接修复 IME 重复上屏，只做 Codex 定向诊断。

## Decision (ADR-lite)

**Context**: 用户强调多任务并行，不能影响其他任务；同时明确当前异常只在 Codex CLI 复现，而 Claude CLI 正常。

**Decision**: 先执行低风险方案 1：仅修复 Codex 浅色黑底/黑框问题，并把输入重复问题收敛为 Codex 专属诊断，不改共享 xterm 输入路径与 Rust PTY 后端。

**Consequences**: 改动面最小，能先消除可见 UI 问题；输入重复暂不止血，但可避免误伤 Claude/普通 shell。

## Technical Notes

* 需要核对历史任务：`.trellis/tasks/archive/2026-06/06-28-fix-light-terminal-background-contrast/`
* 需要定位当前终端输入链路、IME 相关处理和 Codex CLI 特殊逻辑。
* 已确认 2026-06-29 的 `5c9490f fix: resolve Codex terminal background blocks issues #68` 把 TUI 背景清理触发条件从“浅色终端”收窄成了“仅背景图模式”，疑似重新放出了浅色无背景图场景的黑底问题。
* 当前黑底修复链路集中在 `src/components/XTermTerminal.tsx` 的 `shouldNormalizeTuiComposerBackground()` / `normalizeTuiComposerBackground()`；无需动后端 PTY。
* 本地 `node_modules/@xterm/xterm@6.0.0` 源码显示：IME 提交同时涉及 `compositionend()` 的延迟 finalize（`setTimeout(0)`）与 `input(insertText)` 路径；当前项目自己的 `onCompositionEnd` 又会立刻执行 helper textarea 重新钉位与 `scheduleFit(true)`，存在和 xterm 收尾时序互相干扰的可能。
