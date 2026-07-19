# 修复供应商切换配置复制不完整

## Goal

供应商切换生成 Claude settings 或 Codex profile 时，使用 cc-switch 的完整有效配置，避免仅提取少数字段造成配置丢失。

## Changelog Target

[TEMP]

## Requirements

- 读取供应商配置时合并 `common_config_<app_type>` 与 `providers.settings_config`，供应商配置优先。
- Claude 生成的 settings 文件保留合并后的完整顶层配置，不再仅写入 `env`。
- Codex 在存在 `settings_config.config` TOML 时保留完整 TOML 配置；没有 TOML 时继续使用现有兼容解析生成 profile。
- Codex 密钥仍只通过 PTY 环境变量注入，不写入生成的 profile 或返回前端。
- 切换后每次启动刷新配置时使用同一完整配置规则。

## Acceptance Criteria

- [x] Claude 通用配置与供应商配置深度合并，嵌套对象不丢失且供应商字段覆盖通用字段。
- [x] Claude 生成 settings 文件包含 `env` 之外的完整配置字段。
- [x] Codex 原始 TOML 中的非密钥配置字段在生成 profile 中保留。
- [x] Codex profile 不包含明文密钥，启动环境仍能获得密钥。
- [x] 现有 env 风格、顶层字段风格及 TOML 风格供应商配置兼容测试通过。
- [x] `cargo test ccswitch` 与 `cargo check` 通过。

## Out of Scope

- 修改 cc-switch 数据库格式。
- 将供应商密钥暴露给前端或写入 Codex profile。

## Technical Notes

- 主要修改 `src-tauri/src/commands/ccswitch.rs`，并同步更新集成契约、变更记录和功能清单。
- GitNexus 影响分析：Claude settings 写入链路风险 LOW；Codex 运行配置解析链路风险 MEDIUM，影响供应商测试、profile 准备和 PTY 启动环境注入。
- 用户明确要求在当前落后远端且有未提交改动的工作区直接修改；必须避免覆盖无关改动。
