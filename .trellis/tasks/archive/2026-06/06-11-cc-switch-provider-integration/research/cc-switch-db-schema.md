# cc-switch.db 结构调研（2026-06-11，基于用户本机真实数据）

路径：`C:\Users\1\.cc-switch\cc-switch.db`（SQLite 3）

## providers 表（本任务核心）

```sql
CREATE TABLE providers (
    id TEXT NOT NULL,                -- UUID
    app_type TEXT NOT NULL,          -- 'claude' | 'codex' | 'gemini' | ...
    name TEXT NOT NULL,              -- 显示名，如 "Anyrouter"
    settings_config TEXT NOT NULL,   -- JSON：与 ~/.claude/settings.json 同构
    website_url TEXT,
    category TEXT,
    created_at INTEGER,
    sort_index INTEGER,
    notes TEXT,
    icon TEXT,
    icon_color TEXT,
    meta TEXT NOT NULL DEFAULT '{}', -- JSON：{"commonConfigEnabled":bool,"apiFormat":"anthropic",...}
    is_current BOOLEAN NOT NULL DEFAULT 0,   -- cc-switch 全局当前供应商
    in_failover_queue BOOLEAN, cost_multiplier TEXT, limit_daily_usd TEXT,
    limit_monthly_usd TEXT, provider_type TEXT,
    PRIMARY KEY (id, app_type)
)
```

用户本机 30 行，app_type 含 claude 等多种。

## settings_config 实际样例（脱敏）

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-***",
    "ANTHROPIC_BASE_URL": "https://...",
    "ANTHROPIC_MODEL": "claude-fable-5[1m]",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "...",
    "CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS": "1"
  },
  "hooks": { "UserPromptSubmit": [ ... ] },
  "attribution": { "commit": "", "pr": "" },
  "skipDangerousModePermissionPrompt": true
}
```

即 cc-switch 的"切换" = 将 settings_config 合并/写入目标 `settings.json`。
Phase 2 按项目切换时，写 `<project>\.claude\settings.json` 的 env 段即来源于此。

## 其他相关表（本阶段不读）

- `provider_endpoints`：供应商多端点 (provider_id, app_type, url)
- `provider_health` / `proxy_*` / `usage_daily_rollups`：cc-switch 代理与用量
- `settings`：cc-switch 自身 KV 设置

## 关键结论

1. 读 providers 一张表即可完成展示；`is_current` 标记全局当前项。
2. `settings_config` 含明文 API key，**必须 Rust 侧脱敏后再发给 WebView**。
3. 排序按 `sort_index`（同 app_type 内）。
