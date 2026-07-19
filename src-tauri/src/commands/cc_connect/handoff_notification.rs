use super::handoff::send_handoff_notification;
use super::handoff_session::{load_handoff_record, PersistedHandoffRecord};
use super::*;
use crate::daemon::discovery::{daemon_info_path, is_pid_alive, read_daemon_info, DaemonInfo};
use log::{debug, warn};
use serde_json::Value;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::sync::mpsc::{sync_channel, Receiver, RecvTimeoutError, SyncSender, TrySendError};
use std::thread;
use std::time::Instant;

const HOOK_QUEUE_CAPACITY: usize = 64;
const DELIVERY_QUEUE_CAPACITY: usize = 64;
const SCHEDULER_TICK: Duration = Duration::from_secs(1);
const DEFAULT_PROGRESS_INTERVAL_MINUTES: u64 = 5;
const MIN_PROGRESS_INTERVAL_MINUTES: u64 = 1;
const MAX_PROGRESS_INTERVAL_MINUTES: u64 = 60;
const TASK_STALE_AFTER: Duration = Duration::from_secs(20 * 60);
const TASK_STALE_GRACE: Duration = Duration::from_secs(5 * 60);
const PERMISSION_DEDUP_WINDOW: Duration = Duration::from_secs(5);
const STATUS_FILE_NAME: &str = "handoff-notification-status.json";
const HOOK_ENV_KEYS: [&str; 3] = [
    "CLI_MANAGER_TAB_ID",
    "CLI_MANAGER_NOTIFY_PORT",
    "CLI_MANAGER_NOTIFY_TOKEN",
];

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CcConnectHandoffNotificationStatus {
    pub last_attempt_at_ms: Option<i64>,
    pub last_success_at_ms: Option<i64>,
    pub last_event: Option<String>,
    pub last_platform: Option<CcConnectPlatform>,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Copy)]
struct NotificationSettings {
    enabled: bool,
    completion_enabled: bool,
    permission_enabled: bool,
    progress_enabled: bool,
    progress_interval_minutes: u64,
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            completion_enabled: true,
            permission_enabled: true,
            progress_enabled: true,
            progress_interval_minutes: DEFAULT_PROGRESS_INTERVAL_MINUTES,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct HandoffIdentity {
    local_session_id: String,
    cli_session_id: String,
    platform: CcConnectPlatform,
    platform_session_key: String,
    started_at_ms: i64,
}

impl HandoffIdentity {
    fn from_record(record: &PersistedHandoffRecord) -> Self {
        Self {
            local_session_id: record.local_session_id.clone(),
            cli_session_id: record.cli_session_id.clone(),
            platform: record.platform,
            platform_session_key: record.platform_session_key.clone(),
            started_at_ms: record.started_at_ms,
        }
    }

    fn matches_record(&self, record: &PersistedHandoffRecord) -> bool {
        self == &Self::from_record(record)
    }
}

#[derive(Debug)]
struct RemoteHookEvent {
    tab_id: String,
    source: String,
    event: String,
    cli_session_id: Option<String>,
    permission_fingerprint: Option<u64>,
}

impl RemoteHookEvent {
    fn from_payload(payload: &Value) -> Option<Self> {
        let tab_id = string_field(payload, &["tabId", "tab_id"])?;
        let source = string_field(payload, &["source"])?;
        let event = string_field(payload, &["event"])?;
        let cli_session_id = string_field(payload, &["sessionId", "session_id"]);
        let fingerprint_source = string_field(payload, &["toolUseId", "tool_use_id", "message"]);
        let permission_fingerprint = fingerprint_source.map(|value| {
            let mut hasher = DefaultHasher::new();
            value.hash(&mut hasher);
            hasher.finish()
        });
        Some(Self {
            tab_id,
            source,
            event,
            cli_session_id,
            permission_fingerprint,
        })
    }

    fn belongs_to(&self, record: &PersistedHandoffRecord) -> bool {
        self.source == "codex"
            && self.tab_id == record.local_session_id
            && self
                .cli_session_id
                .as_deref()
                .is_none_or(|session_id| session_id == record.cli_session_id)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TaskPhase {
    Running,
    Attention,
    Terminal,
}

#[derive(Debug)]
struct TaskState {
    identity: HandoffIdentity,
    started_at: Instant,
    last_progress_at: Instant,
    phase: TaskPhase,
    terminal_kind: Option<NotificationKind>,
    terminal_enqueued: bool,
    last_permission_fingerprint: Option<u64>,
    last_permission_at: Option<Instant>,
}

impl TaskState {
    fn new(record: &PersistedHandoffRecord, now: Instant) -> Self {
        Self {
            identity: HandoffIdentity::from_record(record),
            started_at: now,
            last_progress_at: now,
            phase: TaskPhase::Running,
            terminal_kind: None,
            terminal_enqueued: false,
            last_permission_fingerprint: None,
            last_permission_at: None,
        }
    }

    fn is_duplicate_permission(&self, fingerprint: Option<u64>, now: Instant) -> bool {
        if fingerprint.is_some() {
            return fingerprint == self.last_permission_fingerprint;
        }
        self.last_permission_at
            .is_some_and(|last| now.duration_since(last) < PERMISSION_DEDUP_WINDOW)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum NotificationKind {
    Progress,
    Permission,
    Completed,
    Failed,
    TimedOut,
}

impl NotificationKind {
    fn key(self) -> &'static str {
        match self {
            Self::Progress => "progress",
            Self::Permission => "permission",
            Self::Completed => "completed",
            Self::Failed => "failed",
            Self::TimedOut => "timed_out",
        }
    }
}

#[derive(Debug)]
struct DeliveryJob {
    identity: HandoffIdentity,
    record: PersistedHandoffRecord,
    kind: NotificationKind,
    message: String,
}

enum SchedulerMessage {
    Hook(Value),
}

#[derive(Clone)]
pub struct RemoteHandoffNotifier {
    sender: SyncSender<SchedulerMessage>,
}

impl RemoteHandoffNotifier {
    pub fn start() -> Self {
        let (scheduler_sender, scheduler_receiver) =
            sync_channel::<SchedulerMessage>(HOOK_QUEUE_CAPACITY);
        let (delivery_sender, delivery_receiver) =
            sync_channel::<DeliveryJob>(DELIVERY_QUEUE_CAPACITY);
        thread::spawn(move || run_delivery_worker(delivery_receiver));
        thread::spawn(move || run_scheduler(scheduler_receiver, delivery_sender));
        Self {
            sender: scheduler_sender,
        }
    }

    pub fn try_enqueue(&self, payload: Value) {
        match self.sender.try_send(SchedulerMessage::Hook(payload)) {
            Ok(()) => {}
            Err(TrySendError::Full(_)) => {
                warn!("remote handoff notification hook queue full, dropping event");
            }
            Err(TrySendError::Disconnected(_)) => {
                warn!("remote handoff notification scheduler unavailable");
            }
        }
    }
}

pub(super) fn apply_hook_environment(command: &mut Command) {
    for key in HOOK_ENV_KEYS {
        command.env_remove(key);
    }
    let record = match load_handoff_record() {
        Ok(Some(record)) => record,
        Ok(None) => return,
        Err(err) => {
            warn!("remote handoff hook record unavailable: {err}");
            return;
        }
    };
    let data_dir = match crate::app_paths::cli_manager_data_dir() {
        Ok(path) => path,
        Err(err) => {
            warn!("remote handoff hook data path unavailable: {err}");
            return;
        }
    };
    let info = match read_daemon_info(&daemon_info_path(&data_dir, cfg!(debug_assertions))) {
        Ok(Some(info)) if info.hook_port > 0 && is_pid_alive(info.pid) => info,
        Ok(_) => {
            warn!("remote handoff hook daemon is unavailable");
            return;
        }
        Err(err) => {
            warn!("remote handoff hook daemon discovery failed: {err}");
            return;
        }
    };
    for (key, value) in hook_environment_values(&record, &info) {
        command.env(key, value);
    }
}

fn hook_environment_values(
    record: &PersistedHandoffRecord,
    info: &DaemonInfo,
) -> [(&'static str, String); 3] {
    [
        ("CLI_MANAGER_TAB_ID", record.local_session_id.clone()),
        ("CLI_MANAGER_NOTIFY_PORT", info.hook_port.to_string()),
        ("CLI_MANAGER_NOTIFY_TOKEN", info.token.clone()),
    ]
}

fn run_scheduler(receiver: Receiver<SchedulerMessage>, delivery_sender: SyncSender<DeliveryJob>) {
    let mut state: Option<TaskState> = None;
    loop {
        match receiver.recv_timeout(SCHEDULER_TICK) {
            Ok(SchedulerMessage::Hook(payload)) => {
                handle_hook_payload(payload, &mut state, &delivery_sender);
            }
            Err(RecvTimeoutError::Timeout) => {}
            Err(RecvTimeoutError::Disconnected) => break,
        }
        tick_scheduler(&mut state, &delivery_sender);
    }
}

fn handle_hook_payload(
    payload: Value,
    state: &mut Option<TaskState>,
    delivery_sender: &SyncSender<DeliveryJob>,
) {
    let Some(event) = RemoteHookEvent::from_payload(&payload) else {
        return;
    };
    let record = match load_handoff_record() {
        Ok(Some(record)) => record,
        Ok(None) => {
            *state = None;
            return;
        }
        Err(err) => {
            warn!("remote handoff notification record read failed: {err}");
            return;
        }
    };
    if !event.belongs_to(&record) {
        return;
    }
    let now = Instant::now();
    if state
        .as_ref()
        .is_some_and(|current| !current.identity.matches_record(&record))
    {
        *state = None;
    }
    match event.event.as_str() {
        "UserPromptSubmit" => {
            *state = Some(TaskState::new(&record, now));
        }
        "PermissionRequest" | "Notification" => {
            let current = state.get_or_insert_with(|| TaskState::new(&record, now));
            if current.is_duplicate_permission(event.permission_fingerprint, now) {
                return;
            }
            current.phase = TaskPhase::Attention;
            current.last_permission_fingerprint = event.permission_fingerprint;
            current.last_permission_at = Some(now);
            let settings = read_notification_settings();
            if settings.enabled && settings.permission_enabled {
                if enqueue_delivery(
                    delivery_sender,
                    &record,
                    NotificationKind::Permission,
                    now.duration_since(current.started_at),
                ) {
                    current.last_progress_at = now;
                }
            }
        }
        "Stop" | "StopFailure" => {
            let current = state.get_or_insert_with(|| TaskState::new(&record, now));
            if current.phase == TaskPhase::Terminal {
                return;
            }
            current.phase = TaskPhase::Terminal;
            current.terminal_kind = Some(if event.event == "StopFailure" {
                NotificationKind::Failed
            } else {
                NotificationKind::Completed
            });
            enqueue_terminal(current, &record, delivery_sender);
        }
        _ => {}
    }
}

fn tick_scheduler(state: &mut Option<TaskState>, delivery_sender: &SyncSender<DeliveryJob>) {
    let Some(current) = state.as_mut() else {
        return;
    };
    let record = match load_handoff_record() {
        Ok(Some(record)) if current.identity.matches_record(&record) => record,
        Ok(_) => {
            *state = None;
            return;
        }
        Err(err) => {
            debug!("remote handoff notification reconciliation skipped: {err}");
            return;
        }
    };
    if current.phase == TaskPhase::Terminal {
        enqueue_terminal(current, &record, delivery_sender);
        return;
    }
    let now = Instant::now();
    let elapsed = now.duration_since(current.started_at);
    let settings = read_notification_settings();
    let interval = Duration::from_secs(settings.progress_interval_minutes * 60);
    if elapsed >= task_stale_after(settings) {
        current.phase = TaskPhase::Terminal;
        current.terminal_kind = Some(NotificationKind::TimedOut);
        enqueue_terminal(current, &record, delivery_sender);
        return;
    }
    if !settings.enabled || !settings.progress_enabled {
        return;
    }
    if now.duration_since(current.last_progress_at) < interval {
        return;
    }
    if enqueue_delivery(
        delivery_sender,
        &record,
        NotificationKind::Progress,
        elapsed,
    ) {
        current.last_progress_at = now;
    }
}

fn task_stale_after(settings: NotificationSettings) -> Duration {
    if settings.progress_enabled {
        let interval = Duration::from_secs(settings.progress_interval_minutes * 60);
        TASK_STALE_AFTER.max(interval + TASK_STALE_GRACE)
    } else {
        TASK_STALE_AFTER
    }
}

fn enqueue_terminal(
    state: &mut TaskState,
    record: &PersistedHandoffRecord,
    delivery_sender: &SyncSender<DeliveryJob>,
) {
    if state.terminal_enqueued {
        return;
    }
    let Some(kind) = state.terminal_kind else {
        return;
    };
    let settings = read_notification_settings();
    if !settings.enabled || !settings.completion_enabled {
        state.terminal_enqueued = true;
        return;
    }
    state.terminal_enqueued = enqueue_delivery(
        delivery_sender,
        record,
        kind,
        Instant::now().duration_since(state.started_at),
    );
}

fn enqueue_delivery(
    sender: &SyncSender<DeliveryJob>,
    record: &PersistedHandoffRecord,
    kind: NotificationKind,
    elapsed: Duration,
) -> bool {
    let language = load_profile()
        .ok()
        .flatten()
        .map(|profile| profile.language)
        .unwrap_or(CcConnectLanguage::Zh);
    let job = DeliveryJob {
        identity: HandoffIdentity::from_record(record),
        record: record.clone(),
        kind,
        message: format_notification(record, kind, language, elapsed),
    };
    match sender.try_send(job) {
        Ok(()) => true,
        Err(TrySendError::Full(_)) => {
            warn!("remote handoff notification delivery queue full");
            false
        }
        Err(TrySendError::Disconnected(_)) => {
            warn!("remote handoff notification delivery worker unavailable");
            false
        }
    }
}

fn run_delivery_worker(receiver: Receiver<DeliveryJob>) {
    let mut cached_binary: Option<(Option<String>, DetectedBinary)> = None;
    while let Ok(job) = receiver.recv() {
        if !delivery_job_is_current(&job) {
            continue;
        }
        let mut status = read_notification_status().unwrap_or_default();
        status.last_attempt_at_ms = Some(now_millis());
        status.last_event = Some(job.kind.key().to_string());
        status.last_platform = Some(job.record.platform);
        status.last_error = None;
        let _ = write_notification_status(&status);

        let result = deliver(&job, &mut cached_binary);
        match result {
            Ok(()) => {
                status.last_success_at_ms = Some(now_millis());
                status.last_error = None;
            }
            Err(err) => {
                status.last_error = Some(sanitize_delivery_error(&err));
                warn!(
                    "remote handoff notification delivery failed: event={} platform={:?}",
                    job.kind.key(),
                    job.record.platform
                );
            }
        }
        let _ = write_notification_status(&status);
    }
}

fn delivery_job_is_current(job: &DeliveryJob) -> bool {
    load_handoff_record()
        .ok()
        .flatten()
        .is_some_and(|record| job.identity.matches_record(&record))
}

fn deliver(
    job: &DeliveryJob,
    cached_binary: &mut Option<(Option<String>, DetectedBinary)>,
) -> Result<(), String> {
    let profile =
        load_profile()?.ok_or_else(|| "cc-connect profile is not configured".to_string())?;
    let requested_path = profile.executable_path.clone();
    let binary = match cached_binary {
        Some((cached_path, binary)) if cached_path == &requested_path => binary.clone(),
        _ => {
            let binary = detect_binary_uncached(requested_path.as_deref())?;
            *cached_binary = Some((requested_path, binary.clone()));
            binary
        }
    };
    if !binary.compatible {
        return Err("cc_connect_version_unsupported".to_string());
    }
    send_handoff_notification(
        &binary.path,
        &job.record.project_name,
        &job.record.platform_session_key,
        &job.message,
    )
}

fn read_notification_settings() -> NotificationSettings {
    let path = match crate::app_paths::data_paths() {
        Ok(paths) => paths.settings_store_path,
        Err(err) => {
            debug!("remote handoff notification settings path unavailable: {err}");
            return NotificationSettings::default();
        }
    };
    let text = match fs::read_to_string(path) {
        Ok(text) => text,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            return NotificationSettings::default()
        }
        Err(err) => {
            debug!("remote handoff notification settings read failed: {err}");
            return NotificationSettings::default();
        }
    };
    match serde_json::from_str::<Value>(&text) {
        Ok(value) => notification_settings_from_value(&value),
        Err(err) => {
            warn!("remote handoff notification settings parse failed: {err}");
            NotificationSettings::default()
        }
    }
}

fn notification_settings_from_value(value: &Value) -> NotificationSettings {
    let defaults = NotificationSettings::default();
    let interval = value
        .get("remoteHandoffProgressIntervalMinutes")
        .and_then(Value::as_u64)
        .unwrap_or(defaults.progress_interval_minutes)
        .clamp(MIN_PROGRESS_INTERVAL_MINUTES, MAX_PROGRESS_INTERVAL_MINUTES);
    NotificationSettings {
        enabled: bool_setting(value, "remoteHandoffNotificationsEnabled", defaults.enabled),
        completion_enabled: bool_setting(
            value,
            "remoteHandoffCompletionNotificationsEnabled",
            defaults.completion_enabled,
        ),
        permission_enabled: bool_setting(
            value,
            "remoteHandoffPermissionNotificationsEnabled",
            defaults.permission_enabled,
        ),
        progress_enabled: bool_setting(
            value,
            "remoteHandoffProgressNotificationsEnabled",
            defaults.progress_enabled,
        ),
        progress_interval_minutes: interval,
    }
}

fn bool_setting(value: &Value, key: &str, fallback: bool) -> bool {
    value.get(key).and_then(Value::as_bool).unwrap_or(fallback)
}

fn string_field(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        value
            .get(*key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|item| !item.is_empty())
            .map(str::to_string)
    })
}

fn notification_status_path() -> Result<PathBuf, String> {
    Ok(remote_manager_dir()?.join(STATUS_FILE_NAME))
}

fn read_notification_status() -> Result<CcConnectHandoffNotificationStatus, String> {
    let path = notification_status_path()?;
    let raw = match fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(err) if err.kind() == std::io::ErrorKind::NotFound => {
            return Ok(CcConnectHandoffNotificationStatus::default())
        }
        Err(err) => return Err(format!("read handoff notification status failed: {err}")),
    };
    serde_json::from_str(&raw)
        .map_err(|err| format!("parse handoff notification status failed: {err}"))
}

fn write_notification_status(status: &CcConnectHandoffNotificationStatus) -> Result<(), String> {
    let payload = serde_json::to_vec_pretty(status)
        .map_err(|err| format!("serialize handoff notification status failed: {err}"))?;
    write_file_atomically(
        &notification_status_path()?,
        &payload,
        "handoff notification status",
    )
}

fn sanitize_delivery_error(error: &str) -> String {
    error.replace(['\r', '\n'], " ").chars().take(240).collect()
}

fn format_notification(
    record: &PersistedHandoffRecord,
    kind: NotificationKind,
    language: CcConnectLanguage,
    elapsed: Duration,
) -> String {
    let platform = platform_label(record.platform, language);
    let elapsed = elapsed_label(elapsed, language);
    let heading = match (language, kind) {
        (CcConnectLanguage::Zh, NotificationKind::Progress) => {
            "CLI-Manager 托管任务仍在进行"
        }
        (CcConnectLanguage::Zh, NotificationKind::Permission) => {
            "CLI-Manager 托管任务需要审批\n请在当前机器人会话中处理。"
        }
        (CcConnectLanguage::Zh, NotificationKind::Completed) => {
            "CLI-Manager 托管任务已完成"
        }
        (CcConnectLanguage::Zh, NotificationKind::Failed) => {
            "CLI-Manager 托管任务执行失败"
        }
        (CcConnectLanguage::Zh, NotificationKind::TimedOut) => {
            "CLI-Manager 托管任务长时间未收到结束事件\n当前状态未知，请检查机器人会话。"
        }
        (CcConnectLanguage::En, NotificationKind::Progress) => {
            "CLI-Manager managed task is still running"
        }
        (CcConnectLanguage::En, NotificationKind::Permission) => {
            "CLI-Manager managed task needs approval\nRespond in the current bot conversation."
        }
        (CcConnectLanguage::En, NotificationKind::Completed) => {
            "CLI-Manager managed task completed"
        }
        (CcConnectLanguage::En, NotificationKind::Failed) => {
            "CLI-Manager managed task failed"
        }
        (CcConnectLanguage::En, NotificationKind::TimedOut) => {
            "CLI-Manager has not received a completion event\nThe current state is unknown; check the bot conversation."
        }
    };
    match language {
        CcConnectLanguage::Zh => format!(
            "{heading}\n平台：{platform}\n项目：{}\nProvider：{}\ncliSessionId：{}\n工作目录：{}\n已用时间：{elapsed}",
            record.project_name,
            record.provider_name,
            record.cli_session_id,
            record.work_dir,
        ),
        CcConnectLanguage::En => format!(
            "{heading}\nPlatform: {platform}\nProject: {}\nProvider: {}\ncliSessionId: {}\nWorking directory: {}\nElapsed: {elapsed}",
            record.project_name,
            record.provider_name,
            record.cli_session_id,
            record.work_dir,
        ),
    }
}

fn platform_label(platform: CcConnectPlatform, language: CcConnectLanguage) -> &'static str {
    match (platform, language) {
        (CcConnectPlatform::Telegram, _) => "Telegram",
        (CcConnectPlatform::Feishu, CcConnectLanguage::Zh) => "飞书",
        (CcConnectPlatform::Feishu, CcConnectLanguage::En) => "Feishu",
        (CcConnectPlatform::Weixin, CcConnectLanguage::Zh) => "微信",
        (CcConnectPlatform::Weixin, CcConnectLanguage::En) => "Weixin",
        (CcConnectPlatform::Wecom, CcConnectLanguage::Zh) => "企业微信",
        (CcConnectPlatform::Wecom, CcConnectLanguage::En) => "WeCom",
    }
}

fn elapsed_label(elapsed: Duration, language: CcConnectLanguage) -> String {
    let total_minutes = elapsed.as_secs() / 60;
    let minutes = total_minutes.max(1);
    match language {
        CcConnectLanguage::Zh if minutes < 60 => format!("{minutes} 分钟"),
        CcConnectLanguage::Zh => {
            format!("{} 小时 {} 分钟", minutes / 60, minutes % 60)
        }
        CcConnectLanguage::En if minutes < 60 => format!("{minutes} min"),
        CcConnectLanguage::En => {
            format!("{} h {} min", minutes / 60, minutes % 60)
        }
    }
}

#[tauri::command]
pub fn cc_connect_handoff_notification_status() -> Result<CcConnectHandoffNotificationStatus, String>
{
    read_notification_status()
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn record() -> PersistedHandoffRecord {
        PersistedHandoffRecord {
            schema_version: 1,
            local_session_id: "local-session".to_string(),
            cli_session_id: "cli-session".to_string(),
            project_id: "project-1".to_string(),
            project_name: "CLI Manager".to_string(),
            worktree_id: None,
            worktree_name: None,
            work_dir: r"F:\repo".to_string(),
            provider_id: Some("provider-1".to_string()),
            provider_name: "Provider One".to_string(),
            provider_is_global: false,
            platform: CcConnectPlatform::Telegram,
            platform_session_key: "telegram:1:1".to_string(),
            cc_session_id: "cc-session".to_string(),
            session_file_path: r"F:\data\session.json".to_string(),
            previous_active_session_id: None,
            source_project_id: "source-project".to_string(),
            source_project_name: "Source".to_string(),
            source_project_path: r"F:\source".to_string(),
            started_at_ms: 100,
        }
    }

    #[test]
    fn notification_settings_default_and_clamp_interval() {
        let defaults = notification_settings_from_value(&json!({}));
        assert!(defaults.enabled);
        assert!(defaults.completion_enabled);
        assert!(defaults.permission_enabled);
        assert!(defaults.progress_enabled);
        assert_eq!(defaults.progress_interval_minutes, 5);

        let low =
            notification_settings_from_value(&json!({ "remoteHandoffProgressIntervalMinutes": 0 }));
        let high = notification_settings_from_value(
            &json!({ "remoteHandoffProgressIntervalMinutes": 600 }),
        );
        assert_eq!(low.progress_interval_minutes, 1);
        assert_eq!(high.progress_interval_minutes, 60);
        assert_eq!(task_stale_after(high), Duration::from_secs(65 * 60));
    }

    #[test]
    fn hook_event_must_match_the_handoff_owner() {
        let record = record();
        let event = RemoteHookEvent::from_payload(&json!({
            "tabId": "local-session",
            "source": "codex",
            "event": "Stop",
            "sessionId": "cli-session"
        }))
        .unwrap();
        assert!(event.belongs_to(&record));

        for payload in [
            json!({ "tabId": "other", "source": "codex", "event": "Stop", "sessionId": "cli-session" }),
            json!({ "tabId": "local-session", "source": "claude", "event": "Stop", "sessionId": "cli-session" }),
            json!({ "tabId": "local-session", "source": "codex", "event": "Stop", "sessionId": "other" }),
        ] {
            assert!(!RemoteHookEvent::from_payload(&payload)
                .unwrap()
                .belongs_to(&record));
        }
    }

    #[test]
    fn permission_events_are_deduplicated_without_storing_message_content() {
        let record = record();
        let now = Instant::now();
        let mut state = TaskState::new(&record, now);
        state.last_permission_fingerprint = Some(42);
        state.last_permission_at = Some(now);
        assert!(state.is_duplicate_permission(Some(42), now));
        assert!(!state.is_duplicate_permission(Some(99), now));
        assert!(state.is_duplicate_permission(None, now));
        assert!(!state.is_duplicate_permission(None, now + PERMISSION_DEDUP_WINDOW));
    }

    #[test]
    fn formatted_messages_use_safe_handoff_metadata_for_every_platform() {
        for platform in [
            CcConnectPlatform::Telegram,
            CcConnectPlatform::Feishu,
            CcConnectPlatform::Weixin,
            CcConnectPlatform::Wecom,
        ] {
            let mut record = record();
            record.platform = platform;
            let message = format_notification(
                &record,
                NotificationKind::Permission,
                CcConnectLanguage::Zh,
                Duration::from_secs(90),
            );
            assert!(message.contains("cli-session"));
            assert!(message.contains("Provider One"));
            assert!(message.contains("需要审批"));
            assert!(!message.contains("tool_input"));
        }
    }

    #[test]
    fn hook_environment_targets_the_daemon_and_local_session() {
        let record = record();
        let info = DaemonInfo {
            port: 1,
            ws_port: 2,
            hook_port: 3,
            token: "secret-token".to_string(),
            pid: 4,
            version: "test".to_string(),
            protocol_version: 1,
            binary_protocol_version: 1,
            features: Vec::new(),
        };
        assert_eq!(
            hook_environment_values(&record, &info),
            [
                ("CLI_MANAGER_TAB_ID", "local-session".to_string()),
                ("CLI_MANAGER_NOTIFY_PORT", "3".to_string()),
                ("CLI_MANAGER_NOTIFY_TOKEN", "secret-token".to_string()),
            ]
        );
    }
}
