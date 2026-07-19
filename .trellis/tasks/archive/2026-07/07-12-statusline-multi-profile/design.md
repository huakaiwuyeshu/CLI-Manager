# Technical Design

## 1. Core Model

保留“配置库”和“实际生效配置”两层，不让运行时直接依赖配置库格式。

- 配置库：CLI-Manager 数据目录 `statusline/profiles.json`。
- Claude 实际配置：现有 `statusline/settings.json`，`__statusline` 继续直接读取它。
- Codex 实际配置：现有 `~/.codex/config.toml`（或用户指定目录）的 `[tui].status_line`。

建议 schema：

```json
{
  "version": 1,
  "revision": 7,
  "claude": {
    "activeProfileId": "uuid",
    "profiles": [
      {
        "id": "uuid",
        "name": "默认",
        "createdAt": 0,
        "updatedAt": 0,
        "settings": {}
      }
    ]
  },
  "codex": {
    "activeProfileId": "uuid",
    "profiles": [
      {
        "id": "uuid",
        "name": "默认",
        "createdAt": 0,
        "updatedAt": 0,
        "items": []
      }
    ]
  }
}
```

Claude 与 Codex 共用库文件和通用元数据，但 payload 类型保持独立，禁止用一个宽松 JSON 类型混装业务配置。

## 2. Initial Adoption

首次不存在 `profiles.json` 时：

1. Claude 优先读取 CLI-Manager 当前 `statusline/settings.json`。
2. 若不存在，再尝试读取并校验 `~/.config/ccstatusline/settings.json`。
3. 如果 Claude `statusLine` 指向不可识别的自定义脚本，只提示无法可视化导入，不覆盖它。
4. 都不存在时才使用内置默认配置。
5. Codex 直接读取当前 `config.toml` 的 `[tui].status_line`；不存在时使用空数组。
6. 两端读取结果分别创建名为“当前配置”的首个配置，并标记为 active。

初始化配置库本身不应改写 Claude/Codex 实际配置文件。

## 3. Save and Switch Transactions

### Save active profile

1. 校验编辑器 payload。
2. 先备份并原子写入实际配置。
3. 实际配置成功后更新配置库快照、`updatedAt` 和 `revision`。
4. 配置库写入失败时，返回明确的“实际配置已更新但配置库同步失败”错误，并允许从实际配置重新同步；不伪装成完整成功。

### Switch profile

1. 校验目标配置存在且不是当前未保存草稿的误切换。
2. 备份并应用目标配置到实际文件。
3. 应用成功后更新 `activeProfileId`。
4. 应用失败时 active 标记保持不变。

不允许删除 active 配置；前后端都执行校验。

## 4. External Drift Detection

页面加载时同时读取配置库 active 快照和实际配置，进行结构化规范化比较：

- Claude 比较解析后的 `StatuslineSettings`，忽略 JSON 空白与字段顺序。
- Codex 比较解析后的有序 `items` 数组，忽略 TOML 排版变化。

不一致时返回 `externalConfig`，前端提示用户“另存为新配置”。取消提示不会写入任何文件。外部配置非法时只报告错误，不允许导入或覆盖。

## 5. Import and Export

导出文件使用独立 schema，例如 `cli-manager-statusline-profiles-v1.json`：

- 包含 Claude/Codex 全部 profiles 和 schema 版本。
- 不包含实际文件路径、active 状态、Claude 其他设置、Codex 其他 TOML、环境变量或密钥。

导入分两阶段：

1. `analyze_import`：完整解析、迁移、校验，返回同名冲突与建议重命名。
2. 前端逐项选择 `overwrite | skip | rename`。
3. `commit_import`：携带分析时的本地 `revision` 和冲突决策；revision 已变化则拒绝并要求重新分析。
4. 所有决策验证通过后一次原子写入配置库，导入不自动切换或应用配置。

当前 active 配置的同名冲突不允许直接覆盖，只能跳过或重命名，避免导入隐式修改正在运行的状态栏。

## 6. Backend Commands

建议新增统一 profile command，内部按 tool 分派强类型 payload：

- `statusline_profiles_load(tool, configDir?)`
- `statusline_profiles_create(tool, name, source, configDir?)`
- `statusline_profiles_update(tool, profileId, payload, configDir?)`
- `statusline_profiles_rename(tool, profileId, name)`
- `statusline_profiles_duplicate(tool, profileId, name)`
- `statusline_profiles_delete(tool, profileId)`
- `statusline_profiles_switch(tool, profileId, configDir?)`
- `statusline_profiles_capture_external(tool, name, configDir?)`
- `statusline_profiles_export(path)`
- `statusline_profiles_analyze_import(path)`
- `statusline_profiles_commit_import(path, revision, decisions)`

现有 `statusline_save_settings` 和 `codex_statusline_save` 可保留为底层实际配置写入函数，避免复制成熟的校验、备份与局部 TOML 修改逻辑。

## 7. UI

Claude 和 Codex 编辑器各自增加同构的配置栏：

- 当前配置下拉框。
- 新建、复制、重命名、删除菜单。
- 当前配置标记和未保存状态。
- 切换前若有未保存修改，提示保存、放弃或取消。
- 导入/导出入口放在状态栏页面公共顶部，因为操作覆盖两端配置库。
- 检测到外部修改时显示非阻塞提示卡，提供“另存为新配置”和“忽略本次”。

## 8. Safety and Tests

- 配置库、Claude settings 和 Codex config 均使用原子写入。
- 测试初始化读取优先级、外部漂移、active 删除保护、切换失败回滚、导入 revision 冲突、非法导入零写入。
- Codex 测试必须确认其他 TOML 表和注释仍保持现有行为。
- Claude 测试必须确认 `__statusline` 仍只依赖实际 `settings.json`，配置库损坏不影响已生效状态栏运行。
