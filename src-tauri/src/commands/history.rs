use log::debug;
use memchr::memmem;
use serde::Serialize;
use serde_json::Value;
use std::collections::{BTreeMap, HashMap};
use std::env;
use std::fs::{self, File};
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};

/// BufReader 容量；默认 8KB 对几 MB 的 jsonl 文件 syscall 次数偏多。
const READ_BUF_CAPACITY: usize = 64 * 1024;
/// collect_session_files 的 TTL：避免分析看板/搜索短时间内反复全树扫盘。
const SESSION_FILES_TTL_MS: i64 = 5_000;

#[derive(Clone)]
struct SessionFileRef {
    source: String,
    project_key: String,
    path: PathBuf,
}

#[derive(Clone)]
struct SessionSummaryScan {
    message_count: usize,
    first_user_message: Option<String>,
    first_message: Option<String>,
    branch: Option<String>,
}

#[derive(Clone, Default)]
struct SessionStatsScan {
    input_tokens: u64,
    output_tokens: u64,
    dominant_model: Option<String>,
}

#[derive(Clone)]
struct CachedSessionComputation {
    created_at: i64,
    updated_at: i64,
    session_id: String,
    title: String,
    message_count: usize,
    branch: Option<String>,
    stats: SessionStatsScan,
}

#[derive(Default)]
struct SessionStatsCache {
    entries: HashMap<String, CachedSessionCacheEntry>,
}

#[derive(Clone)]
struct CachedSessionCacheEntry {
    fingerprint: SessionFileFingerprint,
    computed: CachedSessionComputation,
}

#[derive(Clone, Copy, PartialEq, Eq)]
struct SessionFileFingerprint {
    created_at: i64,
    updated_at: i64,
    size: u64,
}

#[derive(Clone)]
struct HistoryIndexEntry {
    file_ref: SessionFileRef,
    fingerprint: SessionFileFingerprint,
    computed: CachedSessionComputation,
}

#[derive(Clone, Default)]
struct HistorySessionIndex {
    entries: Vec<HistoryIndexEntry>,
    by_path: HashMap<String, usize>,
    refreshed_at: i64,
    generation: u64,
}

static HISTORY_SESSION_INDEX: OnceLock<RwLock<HistorySessionIndex>> = OnceLock::new();

const HISTORY_SESSION_INDEX_TTL_MS: i64 = 5_000;

#[derive(Clone)]
struct CachedSessionFiles {
    timestamp_ms: i64,
    files: Vec<SessionFileRef>,
}

#[derive(Default)]
struct SessionFilesCache {
    by_source: HashMap<String, CachedSessionFiles>,
}

const HOUR_MS: i64 = 60 * 60 * 1000;
const DAY_MS: i64 = 24 * HOUR_MS;
static SESSION_STATS_CACHE: OnceLock<Mutex<SessionStatsCache>> = OnceLock::new();
static SESSION_FILES_CACHE: OnceLock<Mutex<SessionFilesCache>> = OnceLock::new();

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryMessage {
    pub role: String,
    pub content: String,
    pub timestamp: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistorySessionSummary {
    pub session_id: String,
    pub source: String,
    pub project_key: String,
    pub title: String,
    pub file_path: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub message_count: usize,
    pub branch: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistorySessionDetail {
    pub session_id: String,
    pub source: String,
    pub project_key: String,
    pub title: String,
    pub file_path: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub message_count: usize,
    pub branch: Option<String>,
    pub messages: Vec<HistoryMessage>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistorySearchResult {
    pub session_id: String,
    pub source: String,
    pub project_key: String,
    pub title: String,
    pub file_path: String,
    pub role: String,
    pub snippet: String,
    pub timestamp: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryPromptItem {
    pub session_id: String,
    pub source: String,
    pub project_key: String,
    pub file_path: String,
    pub session_title: String,
    pub updated_at: i64,
    pub message_index: usize,
    pub prompt: String,
    pub timestamp: Option<String>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryStatsProjectItem {
    pub project_key: String,
    pub sessions: usize,
    pub messages: usize,
    pub input_tokens: u64,
    pub output_tokens: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryStatsModelItem {
    pub model: String,
    pub sessions: usize,
    pub ratio: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryStatsHeatmapDay {
    pub day_start_utc: i64,
    pub sessions: usize,
    pub messages: usize,
    pub level: u8,
    pub session_refs: Vec<HistorySessionSummary>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryStatsDailySeriesItem {
    pub day_start_utc: i64,
    pub sessions: usize,
    pub messages: usize,
    pub input_tokens: u64,
    pub output_tokens: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryStatsSourceItem {
    pub source: String,
    pub sessions: usize,
    pub messages: usize,
    pub input_tokens: u64,
    pub output_tokens: u64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryStatsProjectEfficiencyItem {
    pub project_key: String,
    pub sessions: usize,
    pub messages: usize,
    pub input_tokens: u64,
    pub output_tokens: u64,
    pub avg_messages_per_session: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryStatsHourlyActivityItem {
    pub hour: u8,
    pub sessions: usize,
    pub messages: usize,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryStatsResponse {
    pub range_days: usize,
    pub total_sessions: usize,
    pub total_messages: usize,
    pub total_input_tokens: u64,
    pub total_output_tokens: u64,
    pub project_ranking: Vec<HistoryStatsProjectItem>,
    pub model_distribution: Vec<HistoryStatsModelItem>,
    pub heatmap: Vec<HistoryStatsHeatmapDay>,
    pub daily_series: Vec<HistoryStatsDailySeriesItem>,
    pub source_distribution: Vec<HistoryStatsSourceItem>,
    pub project_efficiency: Vec<HistoryStatsProjectEfficiencyItem>,
    pub hourly_activity: Vec<HistoryStatsHourlyActivityItem>,
}

#[derive(Default)]
struct DayStatsAggregate {
    sessions: usize,
    messages: usize,
    input_tokens: u64,
    output_tokens: u64,
    session_refs: Vec<HistorySessionSummary>,
}

#[derive(Clone, Default)]
struct HourStatsAggregate {
    sessions: usize,
    messages: usize,
}

#[tauri::command]
pub async fn history_list_sessions(
    source: Option<String>,
    query: Option<String>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<HistorySessionSummary>, String> {
    tokio::task::spawn_blocking(move || {
        let source_filter = source.map(|v| v.to_lowercase());
        let query_lower = query
            .map(|q| q.trim().to_lowercase())
            .filter(|q| !q.is_empty());
        let max_sessions = limit.unwrap_or(usize::MAX);
        let start_offset = offset.unwrap_or(0);
        let mut sessions = Vec::new();
        if max_sessions == 0 {
            return Ok(sessions);
        }

        if query_lower.is_none() {
            let mut files: Vec<(SessionFileRef, SessionFileFingerprint)> =
                collect_session_files(source_filter.as_deref())
                    .into_iter()
                    .map(|file_ref| {
                        let fingerprint = session_file_fingerprint(&file_ref.path);
                        (file_ref, fingerprint)
                    })
                    .collect();
            files.sort_by(|a, b| {
                b.1.updated_at
                    .cmp(&a.1.updated_at)
                    .then_with(|| a.0.path.cmp(&b.0.path))
            });

            for (file_ref, _) in files.into_iter().skip(start_offset).take(max_sessions) {
                let computed = get_or_scan_session_computation(&file_ref);
                sessions.push(summary_from_computation(&file_ref, &computed));
            }
            return Ok(sessions);
        }

        for entry in refresh_history_index() {
            if let Some(filter) = &source_filter {
                if &entry.file_ref.source != filter {
                    continue;
                }
            }

            let summary = summary_from_computation(&entry.file_ref, &entry.computed);
            if let Some(q) = &query_lower {
                let title = summary.title.to_lowercase();
                let session_id = summary.session_id.to_lowercase();
                let project = summary.project_key.to_lowercase();
                let source_name = summary.source.to_lowercase();
                let branch = summary
                    .branch
                    .as_ref()
                    .map(|v| v.to_lowercase())
                    .unwrap_or_default();
                if !title.contains(q)
                    && !session_id.contains(q)
                    && !project.contains(q)
                    && !source_name.contains(q)
                    && !branch.contains(q)
                {
                    continue;
                }
            }

            sessions.push(summary);
        }

        Ok(sessions.into_iter().skip(start_offset).take(max_sessions).collect())
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn history_get_session(
    file_path: String,
    source: String,
    project_key: String,
) -> Result<HistorySessionDetail, String> {
    tokio::task::spawn_blocking(move || {
        let path = PathBuf::from(&file_path);
        if !path.exists() {
            return Err(format!("Session file not found: {file_path}"));
        }
        let file_ref = SessionFileRef {
            source,
            project_key,
            path,
        };
        build_session_detail(&file_ref)
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn history_search(
    query: String,
    source: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<HistorySearchResult>, String> {
    tokio::task::spawn_blocking(move || {
        let normalized_query = query.trim().to_lowercase();
        if normalized_query.is_empty() {
            return Ok(Vec::new());
        }

        let max_hits = limit.unwrap_or(100).max(1);
        let files = collect_session_files(source.as_deref());
        let mut hits: Vec<HistorySearchResult> = Vec::new();

        for file_ref in files {
            let computed = get_or_scan_session_computation(&file_ref);
            let file_path_str = file_ref.path.to_string_lossy().to_string();
            let title = computed.title.clone();
            let session_id = computed.session_id.clone();
            let source_name = file_ref.source.clone();
            let project_key = file_ref.project_key.clone();
            let mut local_full = false;

            let scan_result =
                iter_session_messages_filtered(&file_ref.path, &normalized_query, |_, msg| {
                    if !msg.content.to_lowercase().contains(&normalized_query) {
                        return true;
                    }
                    hits.push(HistorySearchResult {
                        session_id: session_id.clone(),
                        source: source_name.clone(),
                        project_key: project_key.clone(),
                        title: title.clone(),
                        file_path: file_path_str.clone(),
                        role: msg.role,
                        snippet: excerpt(&msg.content, 180),
                        timestamp: msg.timestamp,
                    });
                    if hits.len() >= max_hits {
                        local_full = true;
                        return false;
                    }
                    true
                });
            if let Err(err) = scan_result {
                debug!(
                    "history_search skip unreadable file: path={}, err={}",
                    file_ref.path.to_string_lossy(),
                    err
                );
                continue;
            }
            if local_full {
                return Ok(hits);
            }
        }

        Ok(hits)
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn history_list_prompts(
    scope: Option<String>,
    source: Option<String>,
    project_key: Option<String>,
    file_path: Option<String>,
    query: Option<String>,
    limit: Option<usize>,
) -> Result<Vec<HistoryPromptItem>, String> {
    tokio::task::spawn_blocking(move || {
        let scope = scope
            .as_deref()
            .map(|v| v.trim().to_lowercase())
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| "global".to_string());
        let files = collect_session_files(source.as_deref());
        let target_project = project_key
            .map(|v| v.trim().to_string())
            .filter(|v| !v.is_empty());
        let target_file = file_path
            .map(|v| v.trim().replace('\\', "/").to_lowercase())
            .filter(|v| !v.is_empty());
        let normalized_query = query
            .map(|q| q.trim().to_lowercase())
            .filter(|q| !q.is_empty());
        let max_items = limit.unwrap_or(200).clamp(1, 2000);
        let mut prompts: Vec<HistoryPromptItem> = Vec::new();

        for file_ref in files {
            if let Some(project) = &target_project {
                if &file_ref.project_key != project {
                    continue;
                }
            }

            if scope == "session" {
                let Some(target) = target_file.as_ref() else {
                    continue;
                };
                let current = path_to_key(&file_ref.path).to_lowercase();
                if &current != target {
                    continue;
                }
            }

            let computed = get_or_scan_session_computation(&file_ref);
            let session_id = computed.session_id.clone();
            let source_name = file_ref.source.clone();
            let project_key_owned = file_ref.project_key.clone();
            let file_path_str = file_ref.path.to_string_lossy().to_string();
            let session_title = computed.title.clone();
            let updated_at = computed.updated_at;
            let title_lower = session_title.to_lowercase();
            let mut local_full = false;

            let scan_result = iter_session_messages(&file_ref.path, |index, msg| {
                if msg.role != "user" {
                    return true;
                }
                let prompt = normalize_text(&msg.content);
                if prompt.is_empty() {
                    return true;
                }
                if let Some(q) = &normalized_query {
                    let prompt_lower = prompt.to_lowercase();
                    if !prompt_lower.contains(q) && !title_lower.contains(q) {
                        return true;
                    }
                }
                prompts.push(HistoryPromptItem {
                    session_id: session_id.clone(),
                    source: source_name.clone(),
                    project_key: project_key_owned.clone(),
                    file_path: file_path_str.clone(),
                    session_title: session_title.clone(),
                    updated_at,
                    message_index: index,
                    prompt,
                    timestamp: msg.timestamp,
                });
                if prompts.len() >= max_items {
                    local_full = true;
                    return false;
                }
                true
            });
            if let Err(err) = scan_result {
                debug!(
                    "history_list_prompts skip unreadable file: path={}, err={}",
                    file_ref.path.to_string_lossy(),
                    err
                );
                continue;
            }
            if local_full {
                break;
            }
        }

        prompts.sort_by(|a, b| {
            b.updated_at
                .cmp(&a.updated_at)
                .then(b.message_index.cmp(&a.message_index))
        });
        Ok(prompts)
    })
    .await
    .map_err(|err| err.to_string())?
}

#[tauri::command]
pub async fn history_get_stats(
    source: Option<String>,
    project_key: Option<String>,
    range_days: Option<usize>,
) -> Result<HistoryStatsResponse, String> {
    let range_days = range_days.unwrap_or(30).clamp(1, 180);
    let source_filter = source.map(|v| v.to_lowercase());
    let target_project = project_key
        .map(|v| v.trim().to_string())
        .filter(|v| !v.is_empty());
    let entries = refresh_history_index();
    let end_day = day_start_utc(now_millis());
    let start_day = end_day - (range_days as i64 - 1) * DAY_MS;

    let mut total_sessions = 0usize;
    let mut total_messages = 0usize;
    let mut total_input_tokens = 0u64;
    let mut total_output_tokens = 0u64;
    let mut project_map: HashMap<String, HistoryStatsProjectItem> = HashMap::new();
    let mut model_map: HashMap<String, usize> = HashMap::new();
    let mut source_map: HashMap<String, HistoryStatsSourceItem> = HashMap::new();
    let mut day_map: BTreeMap<i64, DayStatsAggregate> = BTreeMap::new();
    let mut hourly_map: Vec<HourStatsAggregate> = vec![HourStatsAggregate::default(); 24];

    for entry in entries {
        if let Some(filter) = &source_filter {
            if &entry.file_ref.source != filter {
                continue;
            }
        }
        if let Some(project) = &target_project {
            if &entry.file_ref.project_key != project {
                continue;
            }
        }

        let computed = entry.computed;
        let summary = summary_from_computation(&entry.file_ref, &computed);
        let day_start = day_start_utc(summary.updated_at);
        if day_start < start_day || day_start > end_day {
            continue;
        }

        total_sessions += 1;
        total_messages += summary.message_count;
        total_input_tokens = total_input_tokens.saturating_add(computed.stats.input_tokens);
        total_output_tokens = total_output_tokens.saturating_add(computed.stats.output_tokens);
        let hour = hour_of_day_utc(summary.updated_at);
        hourly_map[hour].sessions += 1;
        hourly_map[hour].messages += summary.message_count;

        let project_entry =
            project_map
                .entry(summary.project_key.clone())
                .or_insert(HistoryStatsProjectItem {
                    project_key: summary.project_key.clone(),
                    sessions: 0,
                    messages: 0,
                    input_tokens: 0,
                    output_tokens: 0,
                });
        project_entry.sessions += 1;
        project_entry.messages += summary.message_count;
        project_entry.input_tokens = project_entry
            .input_tokens
            .saturating_add(computed.stats.input_tokens);
        project_entry.output_tokens = project_entry
            .output_tokens
            .saturating_add(computed.stats.output_tokens);

        let source_entry = source_map.entry(summary.source.clone()).or_insert(HistoryStatsSourceItem {
            source: summary.source.clone(),
            sessions: 0,
            messages: 0,
            input_tokens: 0,
            output_tokens: 0,
        });
        source_entry.sessions += 1;
        source_entry.messages += summary.message_count;
        source_entry.input_tokens = source_entry
            .input_tokens
            .saturating_add(computed.stats.input_tokens);
        source_entry.output_tokens = source_entry
            .output_tokens
            .saturating_add(computed.stats.output_tokens);

        let model_name = computed
            .stats
            .dominant_model
            .unwrap_or_else(|| "unknown".to_string());
        *model_map.entry(model_name).or_insert(0) += 1;

        let day_entry = day_map.entry(day_start).or_insert(DayStatsAggregate {
            sessions: 0,
            messages: 0,
            input_tokens: 0,
            output_tokens: 0,
            session_refs: Vec::new(),
        });
        day_entry.sessions += 1;
        day_entry.messages += summary.message_count;
        day_entry.input_tokens = day_entry
            .input_tokens
            .saturating_add(computed.stats.input_tokens);
        day_entry.output_tokens = day_entry
            .output_tokens
            .saturating_add(computed.stats.output_tokens);
        day_entry.session_refs.push(summary);
    }

    let mut project_ranking: Vec<HistoryStatsProjectItem> = project_map.into_values().collect();
    project_ranking.sort_by(|a, b| {
        b.sessions
            .cmp(&a.sessions)
            .then(b.messages.cmp(&a.messages))
            .then(a.project_key.cmp(&b.project_key))
    });

    let mut model_distribution: Vec<HistoryStatsModelItem> = model_map
        .into_iter()
        .map(|(model, sessions)| HistoryStatsModelItem {
            model,
            sessions,
            ratio: if total_sessions == 0 {
                0.0
            } else {
                sessions as f64 / total_sessions as f64
            },
        })
        .collect();
    model_distribution.sort_by(|a, b| b.sessions.cmp(&a.sessions).then(a.model.cmp(&b.model)));

    let mut source_distribution: Vec<HistoryStatsSourceItem> = source_map.into_values().collect();
    source_distribution.sort_by(|a, b| {
        b.sessions
            .cmp(&a.sessions)
            .then(b.messages.cmp(&a.messages))
            .then(a.source.cmp(&b.source))
    });

    let mut project_efficiency: Vec<HistoryStatsProjectEfficiencyItem> = project_ranking
        .iter()
        .map(|item| HistoryStatsProjectEfficiencyItem {
            project_key: item.project_key.clone(),
            sessions: item.sessions,
            messages: item.messages,
            input_tokens: item.input_tokens,
            output_tokens: item.output_tokens,
            avg_messages_per_session: if item.sessions == 0 {
                0.0
            } else {
                item.messages as f64 / item.sessions as f64
            },
        })
        .collect();
    project_efficiency.sort_by(|a, b| {
        b.sessions
            .cmp(&a.sessions)
            .then_with(|| b.avg_messages_per_session.total_cmp(&a.avg_messages_per_session))
            .then(a.project_key.cmp(&b.project_key))
    });

    let hourly_activity: Vec<HistoryStatsHourlyActivityItem> = hourly_map
        .iter()
        .enumerate()
        .map(|(hour, agg)| HistoryStatsHourlyActivityItem {
            hour: hour as u8,
            sessions: agg.sessions,
            messages: agg.messages,
        })
        .collect();

    let max_day_sessions = day_map.values().map(|item| item.sessions).max().unwrap_or(0);
    let mut heatmap = Vec::with_capacity(range_days);
    let mut daily_series = Vec::with_capacity(range_days);
    for day_idx in 0..range_days {
        let day_start = start_day + day_idx as i64 * DAY_MS;
        if let Some(mut day) = day_map.remove(&day_start) {
            day.session_refs.sort_by(|a, b| {
                b.updated_at
                    .cmp(&a.updated_at)
                    .then(a.session_id.cmp(&b.session_id))
            });
            let level = calc_heat_level(day.sessions, max_day_sessions);
            heatmap.push(HistoryStatsHeatmapDay {
                day_start_utc: day_start,
                sessions: day.sessions,
                messages: day.messages,
                level,
                session_refs: day.session_refs,
            });
            daily_series.push(HistoryStatsDailySeriesItem {
                day_start_utc: day_start,
                sessions: day.sessions,
                messages: day.messages,
                input_tokens: day.input_tokens,
                output_tokens: day.output_tokens,
            });
        } else {
            heatmap.push(HistoryStatsHeatmapDay {
                day_start_utc: day_start,
                sessions: 0,
                messages: 0,
                level: 0,
                session_refs: Vec::new(),
            });
            daily_series.push(HistoryStatsDailySeriesItem {
                day_start_utc: day_start,
                sessions: 0,
                messages: 0,
                input_tokens: 0,
                output_tokens: 0,
            });
        }
    }

    Ok(HistoryStatsResponse {
        range_days,
        total_sessions,
        total_messages,
        total_input_tokens,
        total_output_tokens,
        project_ranking,
        model_distribution,
        heatmap,
        daily_series,
        source_distribution,
        project_efficiency,
        hourly_activity,
    })
}

fn get_stats_cache() -> &'static Mutex<SessionStatsCache> {
    SESSION_STATS_CACHE.get_or_init(|| Mutex::new(SessionStatsCache::default()))
}

fn get_files_cache() -> &'static Mutex<SessionFilesCache> {
    SESSION_FILES_CACHE.get_or_init(|| Mutex::new(SessionFilesCache::default()))
}

fn get_history_index() -> &'static RwLock<HistorySessionIndex> {
    HISTORY_SESSION_INDEX.get_or_init(|| RwLock::new(HistorySessionIndex::default()))
}

fn refresh_history_index() -> Vec<HistoryIndexEntry> {
    let now = now_millis();
    if let Ok(index) = get_history_index().read() {
        if index.refreshed_at > 0 && now - index.refreshed_at < HISTORY_SESSION_INDEX_TTL_MS {
            return index.entries.clone();
        }
    }

    let previous = get_history_index()
        .read()
        .ok()
        .filter(|index| index.refreshed_at > 0)
        .map(|index| index.clone());
    let next = build_history_index(now, previous);
    let entries = next.entries.clone();

    if let Ok(mut index) = get_history_index().write() {
        *index = next;
    }

    entries
}

fn build_history_index(now: i64, previous: Option<HistorySessionIndex>) -> HistorySessionIndex {
    let mut previous_entries: HashMap<String, HistoryIndexEntry> = previous
        .as_ref()
        .map(|index| {
            index
                .entries
                .iter()
                .cloned()
                .map(|entry| (path_to_key(&entry.file_ref.path), entry))
                .collect()
        })
        .unwrap_or_default();
    let previous_generation = previous.as_ref().map(|index| index.generation).unwrap_or(0);
    let files = collect_session_files(None);
    let mut entries = Vec::with_capacity(files.len());

    for file_ref in files {
        let path_key = path_to_key(&file_ref.path);
        let fingerprint = session_file_fingerprint(&file_ref.path);
        if let Some(mut existing) = previous_entries.remove(&path_key) {
            if existing.file_ref.source == file_ref.source
                && existing.file_ref.project_key == file_ref.project_key
                && can_reuse_session_scan(existing.fingerprint, fingerprint)
            {
                existing.file_ref = file_ref;
                existing.fingerprint = fingerprint;
                existing.computed.created_at = fingerprint.created_at;
                existing.computed.updated_at = fingerprint.updated_at;
                entries.push(existing);
                continue;
            }
        }

        let computed = scan_session_computation(
            &file_ref.path,
            fingerprint.created_at,
            fingerprint.updated_at,
        );
        entries.push(HistoryIndexEntry {
            file_ref,
            fingerprint,
            computed,
        });
    }

    entries.sort_by(|a, b| b.computed.updated_at.cmp(&a.computed.updated_at));

    let mut by_path = HashMap::with_capacity(entries.len());
    for (index, entry) in entries.iter().enumerate() {
        by_path.insert(path_to_key(&entry.file_ref.path), index);
    }

    HistorySessionIndex {
        entries,
        by_path,
        refreshed_at: now,
        generation: previous_generation.saturating_add(1),
    }
}

fn lookup_indexed_computation(file_ref: &SessionFileRef) -> Option<CachedSessionComputation> {
    let index = get_history_index().read().ok()?;
    let path_key = path_to_key(&file_ref.path);
    let entry_index = *index.by_path.get(&path_key)?;
    let entry = index.entries.get(entry_index)?;
    if entry.file_ref.source != file_ref.source
        || entry.file_ref.project_key != file_ref.project_key
    {
        return None;
    }

    let fingerprint = session_file_fingerprint(&file_ref.path);
    if !can_reuse_session_scan(entry.fingerprint, fingerprint) {
        return None;
    }

    let mut computed = entry.computed.clone();
    computed.created_at = fingerprint.created_at;
    computed.updated_at = fingerprint.updated_at;
    Some(computed)
}

fn can_reuse_session_scan(
    previous: SessionFileFingerprint,
    current: SessionFileFingerprint,
) -> bool {
    previous.updated_at == current.updated_at && previous.size == current.size
}

fn session_file_fingerprint(path: &Path) -> SessionFileFingerprint {
    let metadata = fs::metadata(path).ok();
    let updated_at = metadata
        .as_ref()
        .and_then(|m| m.modified().ok())
        .map(system_time_to_millis)
        .unwrap_or(0);
    let created_at = metadata
        .as_ref()
        .and_then(|m| m.created().ok())
        .map(system_time_to_millis)
        .unwrap_or(updated_at);
    let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);

    SessionFileFingerprint {
        created_at,
        updated_at,
        size,
    }
}

fn summary_from_computation(
    file_ref: &SessionFileRef,
    computed: &CachedSessionComputation,
) -> HistorySessionSummary {
    HistorySessionSummary {
        session_id: computed.session_id.clone(),
        source: file_ref.source.clone(),
        project_key: file_ref.project_key.clone(),
        title: computed.title.clone(),
        file_path: file_ref.path.to_string_lossy().to_string(),
        created_at: computed.created_at,
        updated_at: computed.updated_at,
        message_count: computed.message_count,
        branch: computed.branch.clone(),
    }
}

fn scan_session_computation(
    path: &Path,
    created_at: i64,
    updated_at: i64,
) -> CachedSessionComputation {
    let (summary_scan, stats) = scan_session_combined(path);
    let session_id = path
        .file_stem()
        .map(|v| v.to_string_lossy().to_string())
        .unwrap_or_else(|| "unknown-session".to_string());
    let title = summary_scan
        .first_user_message
        .or(summary_scan.first_message)
        .map(|text| excerpt(&text, 80))
        .filter(|text| !text.is_empty())
        .unwrap_or_else(|| session_id.clone());

    CachedSessionComputation {
        created_at,
        updated_at,
        session_id,
        title,
        message_count: summary_scan.message_count,
        branch: summary_scan.branch,
        stats,
    }
}

fn get_or_scan_session_computation(file_ref: &SessionFileRef) -> CachedSessionComputation {
    if let Some(computed) = lookup_indexed_computation(file_ref) {
        return computed;
    }

    let fingerprint = session_file_fingerprint(&file_ref.path);
    let key = path_to_key(&file_ref.path);

    if let Ok(cache) = get_stats_cache().lock() {
        if let Some(existing) = cache.entries.get(&key) {
            if can_reuse_session_scan(existing.fingerprint, fingerprint) {
                let mut computed = existing.computed.clone();
                computed.created_at = fingerprint.created_at;
                computed.updated_at = fingerprint.updated_at;
                return computed;
            }
        }
    }

    let computed = scan_session_computation(
        &file_ref.path,
        fingerprint.created_at,
        fingerprint.updated_at,
    );
    if let Ok(mut cache) = get_stats_cache().lock() {
        cache.entries.insert(
            key,
            CachedSessionCacheEntry {
                fingerprint,
                computed: computed.clone(),
            },
        );
    }
    computed
}

fn build_session_detail(file_ref: &SessionFileRef) -> Result<HistorySessionDetail, String> {
    let computed = get_or_scan_session_computation(file_ref);
    let messages = read_session_messages(&file_ref.path)?;
    Ok(HistorySessionDetail {
        session_id: computed.session_id,
        source: file_ref.source.clone(),
        project_key: file_ref.project_key.clone(),
        title: computed.title,
        file_path: file_ref.path.to_string_lossy().to_string(),
        created_at: computed.created_at,
        updated_at: computed.updated_at,
        message_count: messages.len(),
        branch: computed.branch,
        messages,
    })
}

fn collect_session_files(source_filter: Option<&str>) -> Vec<SessionFileRef> {
    let cache_key = source_filter
        .map(|v| v.to_lowercase())
        .unwrap_or_else(|| "*".to_string());
    let now = now_millis();

    if let Ok(cache) = get_files_cache().lock() {
        if let Some(entry) = cache.by_source.get(&cache_key) {
            if now - entry.timestamp_ms < SESSION_FILES_TTL_MS {
                return entry.files.clone();
            }
        }
    }

    let files = scan_session_files(source_filter);

    if let Ok(mut cache) = get_files_cache().lock() {
        cache.by_source.insert(
            cache_key,
            CachedSessionFiles {
                timestamp_ms: now,
                files: files.clone(),
            },
        );
    }

    files
}

fn scan_session_files(source_filter: Option<&str>) -> Vec<SessionFileRef> {
    let Some(home) = detect_home_dir() else {
        return Vec::new();
    };
    let mut files = Vec::new();
    let source_filter = source_filter.map(|v| v.to_lowercase());

    if source_filter
        .as_ref()
        .map(|v| v == "claude")
        .unwrap_or(true)
    {
        files.extend(collect_claude_session_files(&home));
    }
    if source_filter.as_ref().map(|v| v == "codex").unwrap_or(true) {
        files.extend(collect_codex_session_files(&home));
    }

    files
}

fn collect_claude_session_files(home: &Path) -> Vec<SessionFileRef> {
    let root = home.join(".claude").join("projects");
    if !root.exists() {
        return Vec::new();
    }

    let mut results = Vec::new();
    for entry in read_dir_entries(&root) {
        let path = entry.path();
        if path.is_dir() {
            let project_key = entry.file_name().to_string_lossy().to_string();
            let mut files = Vec::new();
            collect_files_recursive(&path, &mut files, &|file_path| is_jsonl(file_path));
            for file_path in files {
                results.push(SessionFileRef {
                    source: "claude".to_string(),
                    project_key: project_key.clone(),
                    path: file_path,
                });
            }
        } else if is_jsonl(&path) {
            results.push(SessionFileRef {
                source: "claude".to_string(),
                project_key: "default".to_string(),
                path,
            });
        }
    }

    results
}

fn collect_codex_session_files(home: &Path) -> Vec<SessionFileRef> {
    let root = home.join(".codex").join("sessions");
    if !root.exists() {
        return Vec::new();
    }

    let mut files = Vec::new();
    collect_files_recursive(&root, &mut files, &|file_path| {
        if !is_jsonl(file_path) {
            return false;
        }
        let name = file_path
            .file_name()
            .map(|v| v.to_string_lossy().to_string())
            .unwrap_or_default();
        name.starts_with("rollout-")
    });

    files
        .into_iter()
        .map(|path| {
            let project_key = path
                .parent()
                .and_then(|parent| parent.strip_prefix(&root).ok())
                .map(path_to_key)
                .filter(|v| !v.is_empty())
                .unwrap_or_else(|| "sessions".to_string());
            SessionFileRef {
                source: "codex".to_string(),
                project_key,
                path,
            }
        })
        .collect()
}

fn collect_files_recursive(
    dir: &Path,
    output: &mut Vec<PathBuf>,
    predicate: &dyn Fn(&Path) -> bool,
) {
    for entry in read_dir_entries(dir) {
        let path = entry.path();
        if path.is_dir() {
            collect_files_recursive(&path, output, predicate);
        } else if predicate(&path) {
            output.push(path);
        }
    }
}

fn read_dir_entries(dir: &Path) -> Vec<fs::DirEntry> {
    match fs::read_dir(dir) {
        Ok(iter) => iter.filter_map(Result::ok).collect(),
        Err(_) => Vec::new(),
    }
}

fn is_jsonl(path: &Path) -> bool {
    path.extension()
        .map(|v| v.to_string_lossy().eq_ignore_ascii_case("jsonl"))
        .unwrap_or(false)
}

fn detect_home_dir() -> Option<PathBuf> {
    env::var_os("USERPROFILE")
        .map(PathBuf::from)
        .or_else(|| env::var_os("HOME").map(PathBuf::from))
}

fn path_to_key(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

/// Single-pass scan that yields both summary and stats from one read.
fn scan_session_combined(path: &Path) -> (SessionSummaryScan, SessionStatsScan) {
    let file = match File::open(path) {
        Ok(file) => file,
        Err(_) => {
            return (
                SessionSummaryScan {
                    message_count: 0,
                    first_user_message: None,
                    first_message: None,
                    branch: None,
                },
                SessionStatsScan::default(),
            );
        }
    };

    let mut message_count = 0usize;
    let mut first_user_message: Option<String> = None;
    let mut first_message: Option<String> = None;
    let mut branch: Option<String> = None;
    let mut input_tokens = 0u64;
    let mut output_tokens = 0u64;
    let mut model_hits: HashMap<String, usize> = HashMap::new();

    for line in BufReader::with_capacity(READ_BUF_CAPACITY, file).lines().map_while(Result::ok) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };

        if branch.is_none() {
            branch = extract_branch(&value);
        }
        if let Some(msg) = parse_message(&value) {
            message_count += 1;
            if first_message.is_none() {
                first_message = Some(msg.content.clone());
            }
            if first_user_message.is_none() && msg.role == "user" {
                first_user_message = Some(msg.content);
            }
        }

        let (input, output) = extract_usage_tokens(&value);
        input_tokens = input_tokens.saturating_add(input);
        output_tokens = output_tokens.saturating_add(output);

        if let Some(model) = extract_model(&value) {
            *model_hits.entry(model).or_insert(0) += 1;
        }
    }

    let dominant_model = model_hits
        .into_iter()
        .max_by(|(left_model, left_hits), (right_model, right_hits)| {
            left_hits
                .cmp(right_hits)
                .then_with(|| right_model.cmp(left_model))
        })
        .map(|(model, _)| model);

    (
        SessionSummaryScan {
            message_count,
            first_user_message,
            first_message,
            branch,
        },
        SessionStatsScan {
            input_tokens,
            output_tokens,
            dominant_model,
        },
    )
}

/// Stream parsed messages from a session file. Callback returns `false` to break early.
fn iter_session_messages<F>(path: &Path, mut callback: F) -> Result<(), String>
where
    F: FnMut(usize, HistoryMessage) -> bool,
{
    let file = File::open(path).map_err(|err| err.to_string())?;
    let mut index = 0usize;
    for line in BufReader::with_capacity(READ_BUF_CAPACITY, file).lines().map_while(Result::ok) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };
        if let Some(msg) = parse_message(&value) {
            if !callback(index, msg) {
                return Ok(());
            }
            index += 1;
        }
    }
    Ok(())
}

/// 同 `iter_session_messages`，但在 JSON 解析前先用 byte-level memmem 预筛 lower-case query。
/// 适用于全文搜索热路径：可让大量"必然不命中"的行直接跳过昂贵的 `serde_json::from_str::<Value>`。
fn iter_session_messages_filtered<F>(
    path: &Path,
    lowercase_query: &str,
    mut callback: F,
) -> Result<(), String>
where
    F: FnMut(usize, HistoryMessage) -> bool,
{
    let file = File::open(path).map_err(|err| err.to_string())?;
    let mut index = 0usize;
    let finder = memmem::Finder::new(lowercase_query.as_bytes());
    for line in BufReader::with_capacity(READ_BUF_CAPACITY, file).lines().map_while(Result::ok) {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        // Fast path: raw bytes 直接命中（绝大多数小写场景）
        let mut maybe_match = finder.find(trimmed.as_bytes()).is_some();
        // Slow path: lower-case 整行后再找一次（mixed case 场景兜底）
        if !maybe_match {
            let lower = trimmed.to_lowercase();
            maybe_match = finder.find(lower.as_bytes()).is_some();
        }
        if !maybe_match {
            continue;
        }
        let Ok(value) = serde_json::from_str::<Value>(trimmed) else {
            continue;
        };
        if let Some(msg) = parse_message(&value) {
            if !callback(index, msg) {
                return Ok(());
            }
            index += 1;
        }
    }
    Ok(())
}

fn read_session_messages(path: &Path) -> Result<Vec<HistoryMessage>, String> {
    let mut messages = Vec::new();
    iter_session_messages(path, |_, msg| {
        messages.push(msg);
        true
    })?;
    Ok(messages)
}

fn extract_usage_tokens(value: &Value) -> (u64, u64) {
    let candidates = [
        Some(value),
        value.get("usage"),
        value.get("token_usage"),
        value.get("payload").and_then(|v| v.get("usage")),
        value.get("message").and_then(|v| v.get("usage")),
        value.get("response").and_then(|v| v.get("usage")),
    ];

    for candidate in candidates.into_iter().flatten() {
        let (input, output) = extract_usage_tokens_from_value(candidate);
        if input > 0 || output > 0 {
            return (input, output);
        }
    }
    (0, 0)
}

fn extract_usage_tokens_from_value(value: &Value) -> (u64, u64) {
    let Value::Object(map) = value else {
        return (0, 0);
    };

    let mut input = extract_u64_by_keys(
        map,
        &[
            "input_tokens",
            "inputTokens",
            "prompt_tokens",
            "promptTokens",
            "input_token_count",
            "inputTokenCount",
        ],
    )
    .unwrap_or(0);
    let output = extract_u64_by_keys(
        map,
        &[
            "output_tokens",
            "outputTokens",
            "completion_tokens",
            "completionTokens",
            "output_token_count",
            "outputTokenCount",
        ],
    )
    .unwrap_or(0);

    if input == 0 && output == 0 {
        if let Some(total) =
            extract_u64_by_keys(map, &["total_tokens", "totalTokens", "token_count"])
        {
            input = total;
        }
    }

    (input, output)
}

fn extract_u64_by_keys(
    map: &serde_json::Map<String, Value>,
    keys: &[&str],
) -> Option<u64> {
    keys.iter()
        .filter_map(|key| map.get(*key))
        .find_map(extract_positive_u64)
}

fn extract_positive_u64(value: &Value) -> Option<u64> {
    match value {
        Value::Null => None,
        Value::Bool(v) => Some(u64::from(*v)),
        Value::Number(v) => {
            if let Some(n) = v.as_u64() {
                return Some(n);
            }
            if let Some(n) = v.as_i64() {
                return (n >= 0).then_some(n as u64);
            }
            v.as_f64()
                .and_then(|n| (n.is_finite() && n >= 0.0).then_some(n as u64))
        }
        Value::String(v) => v.trim().parse::<u64>().ok(),
        _ => None,
    }
}

fn extract_model(value: &Value) -> Option<String> {
    let direct_candidates = [
        value.get("model").and_then(Value::as_str),
        value.get("model_name").and_then(Value::as_str),
        value.get("modelName").and_then(Value::as_str),
        value.get("model_slug").and_then(Value::as_str),
    ];
    for model in direct_candidates.into_iter().flatten() {
        let normalized = model.trim();
        if !normalized.is_empty() {
            return Some(normalized.to_string());
        }
    }

    let nested_candidates = [
        value.get("payload"),
        value.get("message"),
        value.get("response"),
        value.get("metadata"),
    ];
    for candidate in nested_candidates.into_iter().flatten() {
        let Some(model) = extract_model(candidate) else {
            continue;
        };
        if !model.trim().is_empty() {
            return Some(model);
        }
    }

    None
}

fn now_millis() -> i64 {
    system_time_to_millis(SystemTime::now())
}

fn day_start_utc(ts: i64) -> i64 {
    if ts <= 0 {
        return 0;
    }
    ts - (ts % DAY_MS)
}

fn hour_of_day_utc(ts: i64) -> usize {
    if ts <= 0 {
        return 0;
    }
    let normalized = ((ts % DAY_MS) + DAY_MS) % DAY_MS;
    (normalized / HOUR_MS) as usize
}

fn calc_heat_level(value: usize, max_value: usize) -> u8 {
    if value == 0 || max_value == 0 {
        return 0;
    }
    let ratio = value as f64 / max_value as f64;
    if ratio < 0.25 {
        1
    } else if ratio < 0.5 {
        2
    } else if ratio < 0.75 {
        3
    } else {
        4
    }
}

fn parse_message(value: &Value) -> Option<HistoryMessage> {
    if let Some(root_type) = value.get("type").and_then(Value::as_str) {
        if root_type == "response_item" {
            let payload = value.get("payload");
            let payload_type = payload
                .and_then(|v| v.get("type"))
                .and_then(Value::as_str)
                .unwrap_or_default();
            if payload_type == "message" {
                if let Some(payload_value) = payload {
                    return parse_message(payload_value);
                }
                return None;
            }

            if matches!(payload_type, "custom_tool_call" | "tool_call" | "function_call") {
                if let Some(payload_value) = payload {
                    if let Some(message) = parse_message(payload_value) {
                        if looks_like_patch(&message.content) {
                            return Some(message);
                        }
                    }
                }
            }
            return None;
        } else if root_type == "file-history-snapshot" {
            let content = extract_content(value)?;
            if !looks_like_patch(&content) {
                return None;
            }
            return Some(HistoryMessage {
                role: "tool".to_string(),
                content,
                timestamp: extract_timestamp(value),
            });
        } else if matches!(
            root_type,
            "event_msg"
                | "turn_context"
                | "session_meta"
                | "system"
                | "summary"
        ) {
            return None;
        }
    }

    if let Some(payload) = value.get("payload") {
        if let Some(message) = parse_message(payload) {
            return Some(message);
        }
    }

    let role = extract_role(value).unwrap_or_else(|| "assistant".to_string());
    let content = extract_content(value)?;
    if content.trim().is_empty() {
        return None;
    }
    let timestamp = extract_timestamp(value);

    Some(HistoryMessage {
        role,
        content,
        timestamp,
    })
}

fn extract_role(value: &Value) -> Option<String> {
    let candidates = [
        value.get("role").and_then(Value::as_str),
        value.get("type").and_then(Value::as_str),
        value
            .get("message")
            .and_then(|v| v.get("role"))
            .and_then(Value::as_str),
        value
            .get("author")
            .and_then(|v| v.get("role"))
            .and_then(Value::as_str),
    ];

    for role in candidates.into_iter().flatten() {
        let lower = role.to_lowercase();
        if lower.contains("user") {
            return Some("user".to_string());
        }
        if lower.contains("assistant") || lower == "model" {
            return Some("assistant".to_string());
        }
        if lower.contains("system") {
            return Some("system".to_string());
        }
        if lower.contains("tool") {
            return Some("tool".to_string());
        }
    }
    None
}

fn extract_content(value: &Value) -> Option<String> {
    let candidates = [
        value.get("content"),
        value.get("text"),
        value.get("prompt"),
        value.get("input"),
        value.get("output"),
        value.get("arguments"),
        value.get("message"),
    ];

    for candidate in candidates.into_iter().flatten() {
        if let Some(text) = extract_text_from_value(candidate) {
            let normalized = normalize_text(&text);
            if !normalized.is_empty() {
                return Some(normalized);
            }
        }
    }
    None
}

fn extract_text_from_value(value: &Value) -> Option<String> {
    match value {
        Value::Null => None,
        Value::Bool(v) => Some(v.to_string()),
        Value::Number(v) => Some(v.to_string()),
        Value::String(v) => Some(v.clone()),
        Value::Array(items) => {
            let parts: Vec<String> = items
                .iter()
                .filter_map(extract_text_from_value)
                .map(|v| normalize_text(&v))
                .filter(|v| !v.is_empty())
                .collect();
            if parts.is_empty() {
                None
            } else {
                Some(parts.join("\n"))
            }
        }
        Value::Object(map) => {
            let preferred_keys = [
                "text",
                "content",
                "prompt",
                "input_text",
                "output_text",
                "input",
                "output",
                "message",
                "arguments",
                "reasoning",
            ];
            for key in preferred_keys {
                if let Some(v) = map.get(key) {
                    if let Some(text) = extract_text_from_value(v) {
                        let normalized = normalize_text(&text);
                        if !normalized.is_empty() {
                            return Some(normalized);
                        }
                    }
                }
            }
            None
        }
    }
}

fn extract_timestamp(value: &Value) -> Option<String> {
    let candidates = [
        value.get("timestamp").and_then(Value::as_str),
        value.get("time").and_then(Value::as_str),
        value.get("created_at").and_then(Value::as_str),
        value.get("createdAt").and_then(Value::as_str),
        value
            .get("message")
            .and_then(|v| v.get("timestamp"))
            .and_then(Value::as_str),
    ];
    candidates
        .into_iter()
        .flatten()
        .next()
        .map(ToString::to_string)
}

fn extract_branch(value: &Value) -> Option<String> {
    let candidates = [
        value.get("branch").and_then(Value::as_str),
        value.get("git_branch").and_then(Value::as_str),
        value.get("gitBranch").and_then(Value::as_str),
        value
            .get("context")
            .and_then(|v| v.get("branch"))
            .and_then(Value::as_str),
    ];
    candidates
        .into_iter()
        .flatten()
        .find(|v| !v.trim().is_empty())
        .map(ToString::to_string)
}

fn normalize_text(text: &str) -> String {
    // 多数文本不含 \0，避免无意义的 replace 分配。
    if text.contains('\u{0000}') {
        text.replace('\u{0000}', "").trim().to_owned()
    } else {
        text.trim().to_owned()
    }
}

fn looks_like_patch(text: &str) -> bool {
    text.contains("*** Begin Patch")
        || text.contains("diff --git ")
        || (text.contains("@@") && (text.contains("+++ ") || text.contains("--- ")))
}

fn excerpt(text: &str, max_chars: usize) -> String {
    let trimmed = text.trim();
    // 每字符最多 4 字节（UTF-8）；预留稍微宽松一些避免临界 realloc。
    let mut out = String::with_capacity(max_chars.saturating_mul(4).saturating_add(4));
    for (idx, ch) in trimmed.chars().enumerate() {
        if idx >= max_chars {
            out.push_str("...");
            return out;
        }
        out.push(ch);
    }
    out
}

fn system_time_to_millis(time: SystemTime) -> i64 {
    time.duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}
