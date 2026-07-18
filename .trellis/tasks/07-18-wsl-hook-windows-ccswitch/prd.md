# 兼容 Windows CCSwitch 与 WSL Claude/Codex Hook

## Goal

允许 Claude Code / Codex CLI 的 Hook 配置目录与 cc-switch 数据库分别位于 Windows、WSL、macOS 或 Linux 支持的任意环境。Hook 安装与状态检测不得依据两者是否处于同一环境决定可用性，而应分别按 Hook 目标环境生成命令、按数据库路径选择现有访问方式。

## Changelog Target

`[TEMP]`

## Requirements

- Claude 与 Codex 配置目录均可独立选择 Windows 或 WSL 路径。
- cc-switch 数据库位置与 Claude/Codex 配置目录位置相互独立；不得要求二者位于同一环境。
- Windows、macOS、Linux 原生数据库路径继续使用当前平台的原生 SQLite 访问。
- Windows 上显式选择的 WSL UNC 数据库路径必须解析发行版与 Linux 路径，并通过该 WSL 发行版内部的 SQLite 运行时执行读写；禁止通过 UNC/Plan 9 直接写 SQLite。
- Windows 版 CLI-Manager 的 cc-switch 供应商读取、通用配置读取与 Hook/statusline 通用配置写入必须共用同一数据库运行时路由，不能只修 Hook 链路。
- 写入 Windows cc-switch 数据库时，Hook 命令仍使用与目标 CLI 运行环境匹配的路径：WSL 配置使用 `/mnt/<drive>/...`，Windows 配置使用原生路径。
- 移除配置目录与数据库环境配对校验，不再返回 `wsl_environment_mismatch`。
- 保持显式 cc-switch 数据库路径校验、事务写入、第三方配置保留规则不变。
- 不新增依赖，不修改现有 Tauri command 参数。
- 用户可见文案继续兼容 `zh-CN` 与 `en-US`；删除已失效的环境不匹配提示或改为实际错误提示。

## Acceptance Criteria

- [ ] WSL Claude/Codex + Windows cc-switch DB：不返回环境不匹配，并正确同步 common config。
- [ ] Windows Claude/Codex + WSL cc-switch DB：不返回环境不匹配，并按显式数据库路径同步 common config。
- [ ] Claude/Codex 分别位于 Windows/WSL 的混合组合，按各自配置目录生成正确 Hook 命令，同时使用用户选择的同一数据库路径。
- [ ] macOS/Linux 上原生 Claude/Codex 配置与原生 cc-switch DB 的现有行为不回归。
- [ ] Windows 版从 WSL cc-switch DB 读取供应商、读取 common config，并在 WSL 内完成事务性 Hook/statusline common config 更新；不通过 UNC 直写。
- [ ] WSL 运行时依赖缺失或命令失败时返回稳定可诊断错误，不回退到 UNC 直写。
- [ ] 缺失、无效或不可写的显式数据库仍返回原有稳定状态，不静默切换数据库。
- [ ] Rust 定向单测覆盖跨环境数据库同步与路径生成；`cargo check`、`npx tsc --noEmit` 通过。
- [ ] `CHANGELOG.md` 的 `[TEMP]` 记录和 `docs/功能清单.md` 同步更新。

## Root-Cause Statement

根因位于 Hook 与 cc-switch 的边界建模：后端错误地把“Hook 配置目录环境”和“cc-switch 数据库环境”绑定，并对跨环境组合直接拒绝；同时现有数据库层仅对 WSL UNC 做只读 immutable 访问，没有 WSL 内事务写入能力。数据库访问方式应只由数据库路径和宿主平台决定，Hook 命令格式只由各 CLI 配置目录决定。因此修复应删除环境配对校验，并增加原生/WSL 数据库运行时路由。

## Scenario Matrix

| 宿主平台 | Claude/Codex 配置 | cc-switch DB | 预期 |
|---|---|---|---|
| Windows | Windows | Windows | 保持现有同步行为 |
| Windows | WSL | Windows | 同步，Hook 命令使用 WSL 路径 |
| Windows | Windows | WSL UNC | 在 WSL 内读写 DB，Hook 命令使用 Windows 路径 |
| Windows | WSL | WSL UNC | 在 WSL 内读写 DB，Hook 命令使用 WSL 路径 |
| Windows | Claude/Codex 分属 Windows/WSL | Windows 或 WSL UNC | 两个工具按各自环境生成命令，共用所选 DB |
| macOS | 原生 | 原生 | 保持现有同步行为和 POSIX 命令 |
| Linux | 原生 | 原生 | 保持现有同步行为和 POSIX 命令 |
| 任意 | 任意 | 缺失/无效/不可写 | 保持 `notDetected` / `invalidDb` / `syncFailed` 语义 |

窗口焦点、分屏、托盘、Workspan 与 Worktree 不参与本次后端配置同步，确认无关。Hook 未安装、仅 Claude 安装、仅 Codex 安装、两者均安装必须保持正确聚合。

## Discovery List

- `src-tauri/src/commands/hook_settings.rs`：根因与主要改动点；数据库解析、同步、检测、状态聚合及定向测试。
- `src-tauri/src/commands/ccswitch.rs`：数据库解析及所有供应商/common config 读取入口；需要接入原生/WSL 数据库运行时路由。
- `src-tauri/src/wsl.rs` 或同层最小 helper：复用 UNC 解析与静默 `wsl.exe` 执行，承载 WSL SQLite 请求。
- `src/components/settings/pages/HookSettingsPage.tsx`：现有环境不匹配提示；后端不再产生该状态后清理失效文案。
- `.trellis/spec/backend/cli-hook-contracts.md`：当前明确禁止跨环境同步，必须更新为新契约。
- `.trellis/spec/backend/wsl-path-contracts.md`：确认 Hook 命令路径转换规则；无需改变公共 WSL 路径工具。
- `src-tauri/src/statusline.rs`：通过同一数据库解析函数同步状态栏，属于影响范围；保持其行为可用并纳入验证。
- `CHANGELOG.md`、`docs/功能清单.md`：交付文档。

## Technical Notes

- GitNexus：`resolve_ccswitch_db_path_for_hook` 与 `inspect_ccswitch_hook_protection` 均为 `CRITICAL` 影响等级，涉及 Hook 安装/卸载/状态检测及 statusline；实施前必须获得用户确认并做定向回归。
- 根因代码：`is_wsl_db_mismatch` 同时拦截数据库解析与逐工具检测；`hook_exe_for_dir` 已根据配置目录将 Windows exe 转换成 `/mnt/...`。
- 推荐实现：引入最小数据库后端路由。原生路径继续使用 `sqlx`；Windows 上的 WSL UNC 路径解析为 `(distro, linux_path)`，通过 `wsl.exe -d <distro> --exec python3` 调用 Python 标准库 `sqlite3`，参数与配置值通过 argv/stdin 传递，事务在 WSL 内完成。
- WSL 路由只暴露 cc-switch 所需的固定操作（检测 settings 表、读取 common config、事务性写入 common config），不开放任意 SQL 执行接口。
- WSL 中缺少 `python3`/`sqlite3` 标准库时返回稳定错误 `wsl_sqlite_runtime_unavailable`，不得自动安装依赖或回退到 UNC 直写。
- 上游分支状态：`master` 与 `origin/master` 为 `0/0`；工作树已有其他未提交改动，实施时不得覆盖或混入。

## Out of Scope

- 不改动 cc-switch 自身安装位置或数据库格式。
- 不新增远程数据库、跨机器共享或网络文件系统支持；“任意环境”指当前宿主平台可选择/访问的本机原生路径，以及 Windows 上的 WSL UNC 路径。
- 不调整 Hook 事件、通知、子 Agent transcript 等无关功能。
