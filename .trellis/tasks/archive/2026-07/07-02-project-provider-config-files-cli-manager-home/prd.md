# 项目级供应商配置文件启动和 cli-manager 数据目录迁移

## Goal

将 CLI-Manager 自身数据统一落到用户根目录 `~/.cli-manager`，并把供应商切换改为项目记录级配置文件启动：Codex 使用 `codex --profile/-p`，Claude Code 使用 `claude --settings`。同一路径、同一 shell 下创建的多个项目列表项，也必须能各自选择不同供应商。

## Changelog Target

[TEMP]

## What I already know

* 当前 Claude 供应商切换会写入项目路径下共享的 `.claude/settings.json`，导致同路径项目互相影响。
* 当前 Codex 已有 profile 机制，但 profile 写入位置和密钥注入机制还需要调整到 CLI-Manager 自有目录。
* 用户要求 CLI-Manager 创建 `C:\Users\Administrator\.cli-manager`，配置文件、日志文件、数据库文件全部放到这里。
* 升级不能影响既有数据；迁移必须避免数据丢失。

## Requirements

* CLI-Manager 统一使用用户根目录下的 `~/.cli-manager` 作为自有数据目录。
* 应用数据库迁移到 `~/.cli-manager`，已有旧数据库必须无损保留并可复制迁移。
* 应用日志迁移到 `~/.cli-manager/logs`。
* CLI-Manager 生成的供应商配置文件放到 `~/.cli-manager` 下的专用子目录。
* 供应商覆盖的最小颗粒度是项目记录 ID，不是项目路径，也不是 shell。
* 同路径、同 shell 的不同项目列表项，可以选择不同供应商。
* Codex 启动使用 `codex --profile <profile>` 或 `codex -p <profile>`。
* Claude Code 启动使用 `claude --settings <settings-file>`。
* 不再把项目级 Claude 供应商覆盖写入项目目录共享 `.claude/settings.json`。

## Acceptance Criteria

* [ ] 两个同路径同 shell 项目列表项选择不同 Claude 供应商后，新建内部终端分别使用各自 settings 文件。
* [ ] 两个同路径同 shell 项目列表项选择不同 Codex 供应商后，新建内部终端分别使用各自 profile。
* [ ] 旧数据目录存在、新目录不存在时，首次启动复制旧数据库到 `~/.cli-manager`，不删除旧文件。
* [ ] 新目录已有数据库时，不覆盖新数据库。
* [ ] 日志输出落到 `~/.cli-manager/logs`。
* [ ] `npx tsc --noEmit` 通过。
* [ ] `cd src-tauri && cargo check` 通过。

## Definition of Done

* Tests added/updated where core parsing or migration behavior is changed.
* Typecheck / cargo check green.
* `CHANGELOG.md` updated under `[TEMP]`.
* `docs/功能清单.md` updated for user-visible behavior.
* Rollout/rollback considered for old data migration.

## Out of Scope

* 删除旧数据目录或旧项目 `.claude/settings.json`。
* 自动改写用户手写的自定义启动命令。
* 修改 cc-switch 自身数据库格式。

## Technical Notes

* Key files already identified:
  * `src/components/ProviderSwitchModal.tsx`
  * `src/lib/providerSwitching.ts`
  * `src/lib/projectStartupCommand.ts`
  * `src/stores/projectStore.ts`
  * `src/stores/terminalStore.ts`
  * `src-tauri/src/commands/ccswitch.rs`
  * `src-tauri/src/commands/terminal.rs`
  * `src-tauri/src/lib.rs`
* Migration must be copy-first and idempotent.
* Changelog target defaults to `[TEMP]` because user did not provide a version.
