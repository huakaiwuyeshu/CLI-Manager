# 终端设置折叠与 Shell 配置扩展

## Changelog Target

[TEMP]

## Goal

缩短“设置 -> 终端设置”的首屏长度，并让项目 Shell 下拉只显示用户启用的终端类型。

## Requirements

- 将“终端行为”“终端预览”“终端主题库”“终端背景”改为折叠区块。
- 新增独立折叠区块“Shell / 终端类型”。
- 自动扫描当前平台可用 Shell；扫描到的项默认启用。
- Windows 支持 PowerShell、PowerShell 7、CMD、Git Bash、WSL；WSL 只显示单个入口。
- macOS / Linux 支持对应平台的常见 shell，并避免显示 Windows 专属项。
- 支持手动添加自定义终端：名称 + 可执行文件路径。
- 只有启用的终端类型才在新建/编辑项目 Shell 下拉中显示。
- 已有项目使用当前未启用或自定义 Shell 时，编辑时保留当前值，不能丢配置。

## Non-Goals

- 不支持自定义启动参数。
- 不拆分 WSL 发行版。
- 不调整 CLI 工具、项目路径、启动命令等其它项目配置行为。

## Validation

- `npx tsc --noEmit`
- `cd src-tauri && cargo check`
- 手动或代码检查确认新文案兼容 `zh-CN` 与 `en-US`。
