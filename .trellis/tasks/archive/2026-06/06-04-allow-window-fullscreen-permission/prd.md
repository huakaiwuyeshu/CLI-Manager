# Allow Window Fullscreen Permission

## Goal

修复点击终端沉浸式全屏按钮时报错 `window.set_fullscreen not allowed` 的问题，让前端已实现的 `getCurrentWindow().setFullscreen(...)` 能在主窗口执行。

## What I already know

* 用户遇到 Tauri 权限错误：`window.set_fullscreen not allowed`。
* 报错直接给出缺失权限：`core:window:allow-set-fullscreen`。
* `src-tauri/capabilities/default.json` 是主窗口 capability，当前已有 minimize / maximize / close / set-size 等 window 权限，但缺少 fullscreen 权限。
* Tauri 2 文档确认 capability `permissions` 用于授予窗口 API 命令权限。

## Assumptions

* 只需要允许主窗口执行 `setFullscreen`。
* 不需要开放其它 window 权限。
* 不修改 Rust 命令、窗口配置或前端逻辑。

## Open Questions

* 无。

## Requirements

* 在主窗口 capability 中添加 `core:window:allow-set-fullscreen`。
* 不新增其它权限。
* 保持权限列表结构不变。

## Acceptance Criteria

* [x] 点击终端全屏按钮不再报 `window.set_fullscreen not allowed`。
* [x] capability 文件只新增一条 fullscreen 权限。
* [x] `npx tsc --noEmit` 仍通过。

## Definition of Done

* 完成最小权限配置改动。
* 不新增依赖。
* 不扩大无关权限边界。

## Out of Scope

* 修改全屏按钮 UI。
* 修改 Rust 后端命令。
* 添加新的 Tauri capability 文件。

## Technical Approach

在 `src-tauri/capabilities/default.json` 的 `permissions` 数组中追加：

```json
"core:window:allow-set-fullscreen"
```

## Technical Notes

* 当前相关文件：`src-tauri/capabilities/default.json`。
* 这是配置权限修复，不涉及 TypeScript 符号编辑。
