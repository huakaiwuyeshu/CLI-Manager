# History Stats Contracts

> Executable contracts for history session stats and detail payloads across Rust commands, TypeScript store normalization, and React history/statistics UI.

---

## Scenario: History usage stats payload

### 1. Scope / Trigger

- Trigger: changes touching `history_get_stats`, `history_get_session`, history message parsing, stats aggregation, or frontend consumers of history usage fields.
- This is a cross-layer contract because Rust parses JSONL history files, serializes command responses, `historyStore` normalizes payloads, and UI components render totals, charts, and per-session panels.

### 2. Signatures

Rust command payloads:

```rust
pub async fn history_get_stats(
    source: Option<String>,
    project_key: Option<String>,
    range: Option<String>,
    start_at: Option<i64>,
    end_at: Option<i64>,
    config_dir: Option<String>,
) -> Result<HistoryStatsResponse, String>

pub async fn history_get_session(
    source: String,
    project_key: String,
    session_id: String,
    config_dir: Option<String>,
) -> Result<HistorySessionDetail, String>
```

Frontend payload surfaces:

```ts
interface HistoryMessage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_tokens?: number;
  cache_read_tokens?: number;
}

interface HistoryStatsPayload {
  total_cache_read_tokens: number;
  total_cache_creation_tokens: number;
  total_cost_usd: number;
  total_unpriced_tokens: number;
}
```

### 3. Contracts

- Token fields are non-negative counts. Missing usage data must normalize to `0`.
- Claude Code JSONL streams one assistant message as multiple lines sharing the same `message.id` + `requestId`, each carrying identical usage. Usage must be counted **once** per `(message.id, requestId)` — both in aggregate stats (`scan_session_combined`) and per-message detail (`iter_session_messages` blanks token fields on duplicate lines). Without dedup, totals inflate ~3x on real data.
- Codex rollout token usage comes from `event_msg.payload.info.total_token_usage`, which is a **cumulative** session counter. Per-turn usage = adjacent diff; a shrinking cumulative value means session reset (take current value as the delta). Do not sum `last_token_usage` (duplicate events inflate it 2-5%).
- Codex `input_tokens` **includes** `cached_input_tokens`. Extraction normalizes to non-cached input + `cache_read_tokens` (Claude semantics), so pricing applies uniformly with no source-specific input deduction.
- Usage lines without a model (e.g. Codex `token_count` events) attribute to the most recent model seen in the session (e.g. from `turn_context.payload.model`).
- The `<synthetic>` model (Claude error placeholder lines) must never enter model distribution or model attribution.
- Stats aggregates must include input, output, cache read, cache creation, estimated cost, and unpriced token counts at every exposed level: total, project, model, source, daily series, and heatmap day.
- `historyStore` must accept snake_case payload fields and legacy camelCase fallbacks when normalizing stats data. `normalizeDetail` must pass message token fields through (it previously dropped them, making per-session token panels read 0).
- Unknown or unsupported models must not fake a price. They contribute to `unpriced_tokens` and `total_cost_usd` remains unaffected unless an explicit cost exists in the source payload.
- Explicit cost fields from the source payload take priority over local model-price estimation. Explicit cost and token counts may live on different JSON levels (e.g. top-level `costUSD` + `message.usage`); extraction must merge them instead of returning the first matching candidate.
- Codex session project keys should prefer session metadata `cwd`; path-derived keys are only a fallback.
- Stats date ranges may cover up to 366 days and must reject larger ranges with `date_range_too_large`.
- History index builds scan cache-miss files in parallel (`std::thread::scope`, worker count = `available_parallelism`); fingerprint-hit entries must still be reused without rescanning.

### 4. Validation & Error Matrix

| Condition | Required behavior |
|---|---|
| Missing usage field | Count tokens and cost as zero. |
| Usage field has unknown shape | Ignore unknown fields; keep the message/session readable. |
| Model pricing not found | Add all usage tokens to `unpriced_tokens`; do not estimate cost. |
| Explicit cost is present | Use explicit cost and do not add those tokens to `unpriced_tokens`. |
| Date range exceeds 366 days | Return `date_range_too_large`. |
| Codex session lacks metadata cwd | Fall back to the path-derived project key. |
| History cache invalidation runs | Clear file, stats, project, and aggregate caches together. |

### 5. Good/Base/Bad Cases

- Good: a Claude session with input/output/cache usage and known model produces complete totals, cost, model distribution, daily trend, and per-session message token fields.
- Base: a Codex session without model pricing still appears in stats with token totals and `unpriced_tokens`.
- Bad: frontend assumes a newly added numeric field is always present and renders `NaN` when older cached payloads omit it.

### 6. Tests Required

- Rust tests:
  - Date bounds accept a full 366-day range and reject larger ranges.
  - Codex session collection uses metadata `cwd` as project key when present.
  - Session project cache reuses matching fingerprints.
  - Case-insensitive ASCII search avoids per-message lowercasing regressions.
- Frontend checks:
  - `npm run build` must pass after payload/type changes.
  - Stats UI must render missing token/cost fields as zero, not `NaN`.
- Release checks:
  - `cargo test` must pass before tagging a release that changes history stats contracts.

### 7. Wrong vs Correct

#### Wrong

```ts
const cost = raw.total_cost_usd.toFixed(2);
```

This crashes or renders `NaN` when older payloads omit `total_cost_usd`.

#### Correct

```ts
const cost = asNumber(rec.total_cost_usd ?? rec.totalCostUsd ?? rec.totalCostUSD);
```

Normalize at the store boundary so UI components only consume stable numeric fields.

