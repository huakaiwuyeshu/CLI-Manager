# cc-switch 供应商集成 — Phase 1：解析与展示

## 背景

用户使用 cc-switch（https://ccswitch.io）管理多个 Claude/Codex/Gemini API 供应商，其数据存于
`%USERPROFILE%\.cc-switch\cc-switch.db`（SQLite）。最终目标是在 CLI-Manager 中对 CLI 为 claude
的项目支持右键切换供应商（改写 `<project>\.claude\settings.json` 的 `env` 段）。

本任务为第一阶段：**只做解析与展示**，在设置中新增"供应商"页，读取 cc-switch.db 并展示供应商列表。

## 范围（本阶段）

1. **后端**：新增 Tauri 命令 `ccswitch_list_providers(dbPath?: string)`
   - 默认路径 `~/.cc-switch/cc-switch.db`，可由前端传入自定义路径
   - 以**只读**方式打开 SQLite（复用依赖树中已有的 sqlx 0.8，不新增原生依赖）
   - 查询 `providers` 表，解析 `settings_config` JSON / `meta` JSON
   - **密钥脱敏在 Rust 侧完成**：env 中 key 名含 token/key/secret/auth/password 的值只返回掩码
   - 稳定错误字符串：`db_not_found` / `unsupported_format` / `db_open_failed` / `db_query_failed`
2. **前端**：
   - `settingsStore` 新增持久化字段 `ccSwitchDbPath: string | null`（null = 默认路径）
   - `SettingsModal` 新增 Tab `providers`（label：供应商），支持搜索过滤
   - 新页面 `ProviderSettingsPage`：db 路径展示/选择（plugin-dialog）/重置/刷新；
     按 app_type 分组筛选（默认 claude）；供应商卡片展示 name、当前标记、category、
     BASE_URL、模型、脱敏 env 明细（可展开）

## 不在本阶段范围

- 项目右键菜单与按项目切换供应商
- 写入/改写 `<project>\.claude\settings.json`
- cc-switch 代理、健康检查、用量等其余表数据

## 验收标准

- 设置 → 供应商：能列出 cc-switch.db 中全部供应商，claude 为默认筛选，`is_current` 有"当前"标记
- 自定义 db 路径可持久化，重启后生效；路径无效时给出友好错误且不崩溃
- 前端收到的任何 env 值中不含完整密钥（Rust 侧脱敏）
- 打开 db 为只读模式，不会创建/修改文件
- `npx tsc --noEmit` 与 `cd src-tauri && cargo check` 通过

## 技术要点

- sqlx 0.8.6 已由 tauri-plugin-sql 引入依赖树，显式声明 `default-features = false,
  features = ["runtime-tokio", "sqlite"]` 即可，无 libsqlite3-sys 版本冲突
- `SqliteConnectOptions::new().filename(path).read_only(true)`（create_if_missing 默认 false）
- db 实际表结构见 research/cc-switch-db-schema.md

---

# Phase 2：按项目切换供应商（2026-06-11 启动）

## 需求

CLI 为 claude 的项目，在侧栏右键菜单中选择供应商，把所选供应商的 env
（ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN / 模型映射等）写入
`<project>\.claude\settings.json`，实现按项目切换 API 供应商。

## 后端（扩展 src-tauri/src/commands/ccswitch.rs）

1. `ccswitch_get_project_provider(project_path, db_path?)` —— 探测项目当前供应商
   - 读 `<project>/.claude/settings.json`（不存在 → `hasSettingsFile: false`）
   - 与 db 中 app_type='claude' 的各 provider 比对：`env.ANTHROPIC_BASE_URL` 相等
     且（`ANTHROPIC_AUTH_TOKEN` 或 `ANTHROPIC_API_KEY`）相等 → 匹配
   - 返回 `{ matchedProviderId: string|null, hasSettingsFile: bool, baseUrl: string|null }`
   - 比对在 Rust 侧完成，明文 token 不出后端
2. `ccswitch_apply_provider(project_path, provider_id, db_path?)` —— 执行切换
   - 校验：project_path 必须是已存在目录（`project_not_found`）；provider 必须存在于
     db 且 app_type='claude'（`provider_not_found`）
   - 读项目 settings.json：不存在视为 `{}`；存在但解析失败 → `settings_parse_failed`，**不动文件**
   - env 替换规则（核心，需单测）：
     a. 移除现有 env 中所有 `ANTHROPIC_` 前缀的 key（清掉上一家供应商遗留）
     b. 将 provider `settings_config.env` 的**全部** key 覆盖写入
     c. env 之外的顶层字段（hooks/permissions/...）一律不动；只取 provider 的 env 段，
        不取 provider 的 hooks 等其他字段
   - `create_dir_all(<project>/.claude)`；原子写（同目录临时文件 + rename 覆盖），
     pretty JSON（2 空格）
   - 返回 unit；任何 env 内容（含明文 token）不返回给前端
   - 写失败 → `settings_write_failed: ...`

## 前端

1. `src/components/sidebar/index.tsx` 项目右键菜单：当 `project.cli_tool` 包含
   "claude"（忽略大小写）时显示"切换供应商"菜单项（lucide 图标，风格与现有项一致），
   点击关闭菜单并打开切换弹层
2. 新组件 `src/components/ProviderSwitchModal.tsx`（挂载方式与 sidebar 现有 modal 一致）：
   - 打开时并行调 `ccswitch_list_providers`（筛 app_type=claude）与
     `ccswitch_get_project_provider`
   - 列表：name / BASE_URL / category，当前匹配项打勾高亮
   - 点击即切换：`ccswitch_apply_provider` → 成功 toast（提示"新开终端生效"）→ 刷新匹配态
   - 错误码映射为中文提示（project_not_found / provider_not_found /
     settings_parse_failed / settings_write_failed / db_not_found）

## 验收标准（Phase 2）

- claude 项目右键出现"切换供应商"；cli_tool 为 codex/空的项目不出现
- 切换后 settings.json：ANTHROPIC_* 全部来自新供应商；用户自有非 ANTHROPIC_ env key
  保留；hooks 等其余顶层字段保持原样
- `.claude/` 或 settings.json 不存在时自动创建
- settings.json 为损坏 JSON 时报错且文件原样不动
- 明文 token 仅在 Rust 侧流转，永不进 WebView
- Rust 单测覆盖 env 替换规则（遗留清理/保留用户 key/顶层字段不动/损坏 JSON）
- `npx tsc --noEmit`、`cd src-tauri && cargo check`、`cargo test ccswitch` 通过

---

# Phase 3：恢复全局 + 体验优化（2026-06-12 启动，用户已拍板）

用户决策：恢复全局 = **直接删除项目 settings.json 中的整个 `env` 字段**（不是只删
ANTHROPIC_*）。本轮做 4 项：恢复全局、显示跟随全局状态、settings.local.json 冲突
检测、项目树徽标。批量切换（原优化项 4）不做。

## 3.1 恢复全局供应商

后端新命令：

```rust
ccswitch_reset_project_provider(project_path: String) -> Result<(), String>
```

- 不需要 db_path 参数（不读 cc-switch.db）
- 校验 project_path 是已存在目录 → `project_not_found`
- settings.json 不存在 → 直接成功（no-op）
- JSON 损坏 / 顶层非对象 → `settings_parse_failed`，不动文件
- 删除顶层 `env` 字段；删除后顶层对象为空 `{}` → 删除 settings.json 文件本身
  （`.claude/` 目录保留）；否则原子写回（同 Phase 2 的 tmp+rename）
- 写失败 → `settings_write_failed: ...`
- 纯函数抽取 + 单测（env 删除、空对象删文件判定、损坏 JSON 报错、文件不存在 no-op）

弹层 UI：列表顶部加"跟随全局供应商"选项行，点击调 reset，成功后刷新探测态。
右键菜单不加新项（在弹层内操作）。

## 3.2 显示"当前跟随全局：X"

- 零后端改动：`ccswitch_list_providers` 已返回 `isCurrent`（cc-switch 全局当前家）；
  `ccswitch_get_project_provider` 的 `baseUrl` 非空即代表"有项目级覆盖"
- 弹层逻辑：
  - 无覆盖（baseUrl 为 null）→"跟随全局"行打勾，并显示"当前全局：<isCurrent 供应商名>"
  - 有覆盖且匹配到 provider → 对应 provider 行打勾（现状）
  - 有覆盖但匹配不到 → 显示提示"项目为自定义配置（未匹配到 cc-switch 供应商）"

## 3.3 settings.local.json 冲突检测

- 扩展 `ccswitch_get_project_provider` 响应，新增字段
  `localOverrideKeys: Vec<String>`（camelCase）：读 `.claude/settings.local.json`，
  存在且可解析时收集其 env 中 `ANTHROPIC_` 前缀的 **key 名**（只返 key 名不返值，
  不泄密）；文件不存在/损坏 → 空数组（容错不报错）
- 弹层：该数组非空时显示警告条："检测到 settings.local.json 中配置了 <keys>，
  其优先级更高，会覆盖此处的切换结果"

## 3.4 项目树徽标

- 后端新命令（批量探测，避免逐项目 invoke）：

```rust
ccswitch_probe_projects(project_paths: Vec<String>, db_path: Option<String>)
    -> Result<Vec<CcSwitchProjectBadge>, String>
// 每项 { path, hasOverride: bool, providerName: Option<String> }
```

  - 读一次 db（app_type='claude' providers），循环各 path 读 settings.json 探测；
    单个 path 不存在/解析失败 → 该项 hasOverride=false（容错，不让整批失败）
  - db 不存在 → 返回 `db_not_found`（前端静默处理，清空徽标）
- 前端：`projectStore` 新增 `providerBadges: Record<projectId, { providerName: string | null }>`
  （仅含 hasOverride=true 的项目）+ `refreshProviderBadges()`：筛 cli_tool 含
  claude 的项目调批量命令；`fetchAll` 成功后调用；弹层 apply/reset 成功后调用；
  失败静默清空（logger 记录即可，不 toast）
- `TreeNodeItem` 渲染：先阅读现有徽标体系（settingsStore 已有
  `showProjectTreeBadges` 开关），新徽标融入现有风格并**尊重该开关**；
  tooltip/title 显示供应商名（匹配不到名字时显示"自定义"）

## 验收标准（Phase 3）

- 弹层"跟随全局"：点击后项目 settings.json 的 env 字段被整体删除；文件只剩 `{}`
  时文件被删除；其余顶层字段（hooks 等）保留
- 无覆盖项目打开弹层：跟随全局行打勾且显示全局当前供应商名
- `.claude/settings.local.json` 含 ANTHROPIC_* env 时弹层出现警告
- 钉了供应商的 claude 项目在项目树显示徽标，切换/恢复后徽标即时刷新；
  `showProjectTreeBadges` 关闭时不显示
- 明文密钥依旧不进 WebView（localOverrideKeys 只含 key 名）
- 新增 Rust 单测覆盖 3.1 纯函数与 3.4 探测容错
- `npx tsc --noEmit`、`cd src-tauri && cargo check`、`cargo test ccswitch` 通过
- **本轮完成后不提交 git，等用户验证后指示**

---

# Phase 4：体验优化 × 3（2026-06-12 启动，用户已拍板）

用户反馈三项体验问题，本轮一并修复。

## 4.1 设置→供应商页面：主从布局显示详情（参考截图）

**现状问题**：全屏时右侧大片空白。

**改进方案**：
- 布局：左侧列表（固定或可调宽度，如 360-400px），右侧详情面板
- 列表项：简化为名字 + 当前标记 + 分类标记（保留点击选中态）
- 详情面板：默认选中第一个供应商；显示名字、BASE_URL、模型、分类、apiFormat、notes、全局当前标记、配置解析失败标记、环境变量（可展开/收起）、官网按钮；参考 cc-switch 详情面板的层次与信息密度
- 无供应商时右侧显示空态提示；加载中时显示 loading

## 4.2 项目树供应商徽标：独立样式，不复用 cli_tool chip

**现状问题**：`ui-tree-provider-chip` 复用 `ui-tree-meta-chip` 的配色变量，与 cli_tool（claude/codex/gemini）的徽标样式冲突。

**改进方案**：
- CSS：`.ui-tree-provider-chip` 不再依赖 `--cli-chip-color`，改用独立的固定配色（如浅灰底 + 深灰文字，或小图标 + 文字）；可选：改用 lucide 图标（如 Building2, Cloud, Server）+ 文字或纯图标，尺寸 12-14px，与现有 chip 一致
- TreeNodeItem：`ui-tree-provider-chip` 类名保持，样式重写，视觉上与 cli_tool chip 明显区分

## 4.3 切换供应商弹框：美化/隐藏滚动条 + 消除右侧空白

**现状问题**：弹框右侧滚动条默认样式"太丑"，且滚动条右侧留有空白（截图所示）。

**改进方案**：
- 滚动条样式：隐藏滚动条（`scrollbar-width: none` + `::-webkit-scrollbar { display: none }`）或美化为细滚动条（半透明灰，hover 时加深）
- 右侧空白：`ProviderSwitchModal` 的 `.max-h-[50vh] ... pr-0.5` 改为 `pr-0`（或按实际情况调整内边距，消除滚动条占位导致的右侧空隙）

## 验收标准（Phase 4）

- 设置→供应商页面全屏时右侧显示供应商详情，选中态清晰，默认选中第一个
- 项目树供应商徽标样式独立（不与 claude/codex chip 混淆），视觉上明显区分 cli_tool
- 切换供应商弹框滚动条美化或隐藏，右侧无明显留白
- `npx tsc --noEmit`、`cd src-tauri && cargo check` 通过（无后端改动）
- **本轮完成后不提交 git，等用户验证后指示**
