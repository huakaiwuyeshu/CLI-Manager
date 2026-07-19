# Claude 和 Codex 状态栏多配置切换

## Goal

为 Claude Code 与 Codex 状态栏增加多配置方案：用户可以把当前布局保存为多个命名配置，随时切换并应用；首次进入时应读取用户当前正在使用的状态栏配置，直接加载为可编辑配置，避免覆盖或丢失既有设置。

## What I already know

- Claude 编辑器当前只读写 CLI-Manager 数据目录下的 `statusline/settings.json`，运行时也直接加载该文件。
- Claude 的 `~/.claude/settings.json` 只负责安装 `statusLine` 命令；已有 ccstatusline 配置位于 `~/.config/ccstatusline/settings.json`，当前需要用户手动点击导入。
- Codex 编辑器当前直接读取并局部更新 `~/.codex/config.toml`（或设置中的自定义 Codex 配置目录）的 `[tui].status_line`，其他 TOML 内容保持不变。
- 两端现有保存均采用原子写入；Codex 写入前会备份原 `config.toml`。
- Claude 配置结构复杂，包含三行 Widget 和全局样式；Codex 配置仅为有序字符串数组。
- Changelog Target：`[TEMP]`。

## Requirements

- Claude Code 和 Codex 的配置集合彼此独立，配置结构不强行统一。
- Claude 与 Codex 分别维护配置列表，切换其中一个工具的配置不得影响另一个工具。
- 支持创建、重命名、复制、删除和切换命名配置。
- 当前正在使用的配置禁止删除；用户必须先切换到另一份配置。
- 切换配置时将目标配置应用为该工具当前实际生效的状态栏配置。
- 保存当前配置时，同时更新配置库快照和该工具的实际生效配置；不增加独立“应用”步骤。
- 第一次启用多配置管理时，自动读取用户当前实际配置并保存为初始配置，不能直接替换成默认值。
- 每次打开页面时比较当前实际配置与当前配置快照；存在外部修改时提示用户将其另存为新配置，不自动覆盖已有配置。
- 保留现有配置文件中不属于状态栏的字段。
- 所有写入继续使用校验、备份与原子替换。
- 所有用户可见文案支持 `zh-CN` 与 `en-US`。
- 支持将 Claude 与 Codex 的整个配置库导出为一个版本化文件，并在其他设备导入。

## Acceptance Criteria

- [ ] Claude Code 和 Codex 分别可以保存至少两个命名配置并往返切换。
- [ ] 首次打开时，Claude 已有 ccstatusline/CLI-Manager 配置与 Codex `config.toml` 当前状态栏均能作为初始配置载入。
- [ ] 切换后，编辑器内容、预览内容和实际运行配置一致。
- [ ] 删除非当前配置不影响实际状态栏；当前配置的删除入口禁用并给出原因。
- [ ] Codex 切换只修改 `[tui].status_line`，Claude 安装只修改受 CLI-Manager 管理的 `statusLine`。
- [ ] 非法、损坏或版本不兼容的配置不会覆盖当前生效配置。
- [ ] 检测到有效外部修改时可另存为新配置；用户取消时保留实际文件和配置库原内容。
- [ ] 重启应用后配置列表、当前选择和实际生效状态保持一致。
- [ ] 整库导出文件包含 Claude/Codex 命名配置、显示名称、创建/更新时间和 schema 版本，但不包含无关应用设置或密钥。
- [ ] 整库导入先完整校验，非法文件不得部分写入配置库。
- [ ] 同名冲突逐项选择覆盖、跳过或重命名；用户确认前不得写入任何配置。

## Open Questions

- 无。

## Out of Scope

- 同步模型供应商、Hook、终端主题等非状态栏配置。
- 云同步。
- 自动解析任意第三方自定义状态栏脚本为可视化组件。

## Technical Notes

- Claude 现有入口：`statusline_load_settings`、`statusline_save_settings`、`statusline_import_legacy`、`statusline_install`。
- Codex 现有入口：`codex_statusline_load`、`codex_statusline_save`。
- 推荐保留“配置库”和“当前实际配置”两层：配置库负责多份命名快照，切换操作负责事务性应用目标快照。

## Decision (ADR-lite)

**Context**：Claude 与 Codex 的状态栏配置结构、文件位置和应用方式完全不同。

**Decision**：两者分别管理命名配置，不提供首期组合方案。

**Consequences**：实现和故障边界更清晰；用户需要分别切换 Claude 与 Codex，未来如有明确需求可在独立配置之上增加组合方案。

### 保存与应用

**Context**：现有 Claude/Codex 编辑器的保存按钮都会直接修改实际配置，用户也希望配置可以随时切换。

**Decision**：保存即应用；切换配置也立即应用，不引入草稿与“应用”按钮两套状态。

**Consequences**：交互简单且兼容现有心智；后端必须保证配置库写入与实际配置应用的顺序安全，应用失败时不能错误更新当前配置标记。

### 删除当前配置

**Decision**：正在使用的配置不允许删除，必须先切换到另一份配置。

**Consequences**：不会出现删除后回退目标不明确的问题；前端需要禁用删除操作，后端仍需执行同样校验，不能只依赖 UI。

### 外部配置漂移

**Decision**：检测到实际配置与当前配置快照不一致时，提示用户将外部配置另存为新配置；不得自动覆盖当前命名配置。

**Consequences**：可以保护用户手工修改；需要对配置做规范化比较，避免仅因 JSON/TOML 格式、空白或字段顺序变化产生误报。

### 配置库迁移

**Decision**：首期支持 Claude 与 Codex 整个配置库的单文件导入/导出。

**Consequences**：需要独立的传输 schema 和版本迁移逻辑；导出不得包含 Claude/Codex 其他配置、供应商密钥或环境变量。

### 导入冲突

**Decision**：同名配置逐项选择覆盖、跳过或重命名，全部选择完成后一次性提交。

**Consequences**：交互比自动重命名复杂，但用户能精确控制迁移结果；后端需要“分析导入”和“提交导入”两个阶段，并在提交时重新校验本地配置库未发生变化。
