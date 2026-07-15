//! 主进程侧 daemon 客户端：发现/拉起 daemon、鉴权连接、请求-应答关联、
//! 推送帧 re-emit（`pty-output-{id}`/`pty-status-{id}`/`claude-hook-notification`）。
//!
//! 契约：daemon 不可用必须降级进程内 PTY，应用照常可用——因此本模块所有
//! 失败路径都只返回 Err/None，绝不 panic、不阻塞启动主链路。

use super::discovery::{
    daemon_info_path, is_pid_alive, read_daemon_info, remove_daemon_info, DaemonInfo,
};
use super::protocol::{
    decode_daemon_frame, encode_frame, ClientFrame, DaemonFrame, ProtocolError, SessionMeta,
    CAPABILITY_PTY_RESIZE_2X1, MAX_FRAME_BYTES,
};
use crate::pty::manager::PtyProcessStatus;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{SocketAddr, TcpStream};
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::mpsc::{sync_channel, SyncSender};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(1);
const AUTH_READ_TIMEOUT: Duration = Duration::from_secs(3);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
const SPAWN_RETRY_INTERVAL: Duration = Duration::from_millis(250);
const SPAWN_RETRY_MAX: usize = 20;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(target_os = "windows")]
fn windows_daemon_creation_flags() -> u32 {
    CREATE_NO_WINDOW
}

pub struct DaemonClient {
    info: DaemonInfo,
    daemon_version: String,
    protocol_revision: u32,
    capabilities: Vec<String>,
    writer: Mutex<TcpStream>,
    pending: Mutex<HashMap<u64, SyncSender<DaemonFrame>>>,
    next_id: AtomicU64,
    connected: Arc<AtomicBool>,
}

struct DaemonBridgeState {
    client: Option<Arc<DaemonClient>>,
    ready: bool,
}

/// Tauri managed state：daemon 客户端插槽。
/// None = daemon 不可用（降级进程内 PTY）。
pub struct DaemonBridge {
    inner: Mutex<DaemonBridgeState>,
}

impl DaemonBridge {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(DaemonBridgeState {
                client: None,
                ready: false,
            }),
        }
    }

    pub fn set(&self, client: Arc<DaemonClient>) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.client = Some(client);
            inner.ready = true;
        }
    }

    pub fn mark_unavailable(&self) {
        if let Ok(mut inner) = self.inner.lock() {
            inner.client = None;
            inner.ready = true;
        }
    }

    /// None means startup discovery is still running. Some(true) means the
    /// selected PTY host supports 2x1; Some(false) is a legacy daemon at 40x8.
    pub fn compact_resize_state(&self) -> Option<bool> {
        let mut inner = self.inner.lock().ok()?;
        if !inner.ready {
            return None;
        }
        match inner.client.as_ref() {
            Some(client) if client.is_connected() => Some(client.supports_compact_resize()),
            Some(_) => {
                inner.client = None;
                Some(true)
            }
            None => Some(true),
        }
    }

    /// 取存活的客户端；连接已断则清槽返回 None（后续命令自动降级）。
    pub fn get(&self) -> Option<Arc<DaemonClient>> {
        let mut inner = self.inner.lock().ok()?;
        match inner.client.as_ref() {
            Some(client) if client.is_connected() => Some(Arc::clone(client)),
            Some(_) => {
                inner.client = None;
                None
            }
            None => None,
        }
    }
}

impl DaemonClient {
    pub fn info(&self) -> &DaemonInfo {
        &self.info
    }

    pub fn is_connected(&self) -> bool {
        self.connected.load(Ordering::SeqCst)
    }

    /// 连接并完成鉴权握手；成功后启动推送分发线程。
    pub fn connect(info: DaemonInfo, app_handle: AppHandle) -> Result<Arc<Self>, String> {
        let addr = SocketAddr::from(([127, 0, 0, 1], info.port));
        let stream = TcpStream::connect_timeout(&addr, CONNECT_TIMEOUT)
            .map_err(|err| format!("daemon connect failed: {err}"))?;
        let _ = stream.set_nodelay(true);
        let mut writer = stream
            .try_clone()
            .map_err(|err| format!("daemon stream clone failed: {err}"))?;
        writer
            .write_all(
                encode_frame(&ClientFrame::Auth {
                    token: info.token.clone(),
                    client_version: env!("CARGO_PKG_VERSION").to_string(),
                })
                .as_bytes(),
            )
            .map_err(|err| format!("daemon auth write failed: {err}"))?;

        let _ = stream.set_read_timeout(Some(AUTH_READ_TIMEOUT));
        let mut reader = BufReader::new(stream);
        let first = read_line_bounded(&mut reader).ok_or("daemon auth read failed")?;
        let (daemon_version, protocol_revision, capabilities) = match decode_daemon_frame(&first) {
            Ok(DaemonFrame::AuthOk {
                daemon_version,
                protocol_revision,
                capabilities,
                ..
            }) => {
                if daemon_version != env!("CARGO_PKG_VERSION") {
                    log::warn!(
                        "daemon version mismatch: daemon={daemon_version}, app={}",
                        env!("CARGO_PKG_VERSION")
                    );
                }
                (daemon_version, protocol_revision, capabilities)
            }
            Ok(DaemonFrame::AuthErr { reason }) => {
                return Err(format!("daemon auth rejected: {reason}"));
            }
            other => return Err(format!("daemon auth unexpected reply: {other:?}")),
        };
        let _ = reader.get_ref().set_read_timeout(None);

        let client = Arc::new(DaemonClient {
            info,
            daemon_version,
            protocol_revision,
            capabilities,
            writer: Mutex::new(writer),
            pending: Mutex::new(HashMap::new()),
            next_id: AtomicU64::new(1),
            connected: Arc::new(AtomicBool::new(true)),
        });
        client.spawn_reader(reader, app_handle);
        Ok(client)
    }

    fn spawn_reader(self: &Arc<Self>, mut reader: BufReader<TcpStream>, app_handle: AppHandle) {
        let client = Arc::clone(self);
        std::thread::spawn(move || {
            while let Some(line) = read_line_bounded(&mut reader) {
                match decode_daemon_frame(&line) {
                    Ok(frame) => client.route_frame(frame, &app_handle),
                    Err(ProtocolError::UnknownType(kind)) => {
                        log::warn!("daemon pushed unknown frame type: {kind}");
                    }
                    Err(ProtocolError::Malformed(reason)) => {
                        log::warn!("daemon pushed malformed frame: {reason}");
                        break;
                    }
                }
            }
            client.connected.store(false, Ordering::SeqCst);
            // 唤醒所有等待中的请求（发送端 drop 即 RecvTimeoutError::Disconnected）。
            if let Ok(mut pending) = client.pending.lock() {
                pending.clear();
            }
            log::warn!("daemon connection lost");
        });
    }

    fn route_frame(&self, frame: DaemonFrame, app_handle: &AppHandle) {
        match frame {
            DaemonFrame::Output {
                session_id,
                data_base64,
            } => {
                // 与 TauriPtyEventSink 完全一致的事件与载荷，前端零感知。
                let _ = app_handle.emit(&format!("pty-output-{session_id}"), data_base64);
            }
            DaemonFrame::Exit {
                session_id,
                exit_code,
            } => {
                let _ = app_handle.emit(
                    &format!("pty-status-{session_id}"),
                    PtyProcessStatus {
                        status: "exited".to_string(),
                        exit_code,
                    },
                );
            }
            DaemonFrame::HookReport { payload } => {
                let _ = app_handle.emit("claude-hook-notification", payload);
            }
            DaemonFrame::Pong { id }
            | DaemonFrame::Ok { id }
            | DaemonFrame::Err { id, .. }
            | DaemonFrame::Sessions { id, .. }
            | DaemonFrame::Statuses { id, .. }
            | DaemonFrame::Reconciled { id, .. }
            | DaemonFrame::Attached { id, .. } => {
                let sender = self.pending.lock().ok().and_then(|mut p| p.remove(&id));
                if let Some(sender) = sender {
                    let _ = sender.send(frame);
                }
            }
            DaemonFrame::AuthOk { .. } | DaemonFrame::AuthErr { .. } => {
                log::warn!("daemon sent auth frame after handshake");
            }
        }
    }

    pub fn next_request_id(&self) -> u64 {
        self.next_id.fetch_add(1, Ordering::SeqCst)
    }

    /// 发请求并等待对应 id 的应答（超时/断连返回 Err）。
    pub fn request(&self, id: u64, frame: &ClientFrame) -> Result<DaemonFrame, String> {
        if !self.is_connected() {
            return Err("daemon disconnected".to_string());
        }
        let (tx, rx) = sync_channel(1);
        if let Ok(mut pending) = self.pending.lock() {
            pending.insert(id, tx);
        }
        {
            let mut writer = self
                .writer
                .lock()
                .map_err(|_| "daemon writer poisoned".to_string())?;
            writer
                .write_all(encode_frame(frame).as_bytes())
                .map_err(|err| {
                    self.connected.store(false, Ordering::SeqCst);
                    format!("daemon write failed: {err}")
                })?;
        }
        let reply = rx
            .recv_timeout(REQUEST_TIMEOUT)
            .map_err(|err| format!("daemon reply timeout: {err}"));
        if reply.is_err() {
            if let Ok(mut pending) = self.pending.lock() {
                pending.remove(&id);
            }
        }
        reply
    }

    fn expect_ok(&self, frame: &ClientFrame, id: u64) -> Result<(), String> {
        match self.request(id, frame)? {
            DaemonFrame::Ok { .. } => Ok(()),
            DaemonFrame::Err { message, .. } => Err(message),
            other => Err(format!("daemon unexpected reply: {other:?}")),
        }
    }

    pub fn create(
        &self,
        session_id: &str,
        cwd: Option<String>,
        env_vars: Option<HashMap<String, String>>,
        shell: Option<String>,
    ) -> Result<(), String> {
        let id = self.next_request_id();
        self.expect_ok(
            &ClientFrame::Create {
                id,
                session_id: session_id.to_string(),
                cwd,
                env_vars,
                shell,
            },
            id,
        )
    }

    pub fn write(&self, session_id: &str, data: &str) -> Result<(), String> {
        let id = self.next_request_id();
        self.expect_ok(
            &ClientFrame::Write {
                id,
                session_id: session_id.to_string(),
                data: data.to_string(),
            },
            id,
        )
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let id = self.next_request_id();
        self.expect_ok(
            &ClientFrame::Resize {
                id,
                session_id: session_id.to_string(),
                cols,
                rows,
            },
            id,
        )
    }

    pub fn close(&self, session_id: &str) -> Result<(), String> {
        let id = self.next_request_id();
        self.expect_ok(
            &ClientFrame::Close {
                id,
                session_id: session_id.to_string(),
            },
            id,
        )
    }

    pub fn close_all(&self) -> Result<(), String> {
        let id = self.next_request_id();
        self.expect_ok(&ClientFrame::CloseAll { id }, id)
    }

    pub fn list(&self) -> Result<Vec<SessionMeta>, String> {
        let id = self.next_request_id();
        match self.request(id, &ClientFrame::List { id })? {
            DaemonFrame::Sessions { sessions, .. } => Ok(sessions),
            DaemonFrame::Err { message, .. } => Err(message),
            other => Err(format!("daemon unexpected reply: {other:?}")),
        }
    }

    /// attach 会话：订阅输出推送并取得 ring buffer 回放（base64）。
    pub fn attach(&self, session_id: &str) -> Result<(String, SessionMeta), String> {
        let id = self.next_request_id();
        match self.request(
            id,
            &ClientFrame::Attach {
                id,
                session_id: session_id.to_string(),
            },
        )? {
            DaemonFrame::Attached {
                replay_base64,
                meta,
                ..
            } => Ok((replay_base64, meta)),
            DaemonFrame::Err { message, .. } => Err(message),
            other => Err(format!("daemon unexpected reply: {other:?}")),
        }
    }

    pub fn status_all(&self) -> Result<HashMap<String, PtyProcessStatus>, String> {
        let id = self.next_request_id();
        match self.request(id, &ClientFrame::Status { id })? {
            DaemonFrame::Statuses { statuses, .. } => Ok(statuses
                .into_iter()
                .map(|(session_id, status)| {
                    (
                        session_id,
                        PtyProcessStatus {
                            status: status.status,
                            exit_code: status.exit_code,
                        },
                    )
                })
                .collect()),
            DaemonFrame::Err { message, .. } => Err(message),
            other => Err(format!("daemon unexpected reply: {other:?}")),
        }
    }

    pub fn reconcile(&self, active_session_ids: Vec<String>) -> Result<serde_json::Value, String> {
        let id = self.next_request_id();
        match self.request(
            id,
            &ClientFrame::Reconcile {
                id,
                active_session_ids,
            },
        )? {
            DaemonFrame::Reconciled { summary, .. } => Ok(summary),
            DaemonFrame::Err { message, .. } => Err(message),
            other => Err(format!("daemon unexpected reply: {other:?}")),
        }
    }

    pub fn shutdown_if_idle(&self) -> Result<(), String> {
        let id = self.next_request_id();
        self.expect_ok(&ClientFrame::Shutdown { id }, id)
    }

    fn is_runtime_compatible(&self) -> bool {
        daemon_runtime_is_compatible(&self.daemon_version, &self.capabilities)
    }

    pub fn supports_compact_resize(&self) -> bool {
        self.capabilities
            .iter()
            .any(|capability| capability == CAPABILITY_PTY_RESIZE_2X1)
    }
}

fn daemon_runtime_is_compatible(daemon_version: &str, capabilities: &[String]) -> bool {
    daemon_version == env!("CARGO_PKG_VERSION")
        && capabilities
            .iter()
            .any(|capability| capability == CAPABILITY_PTY_RESIZE_2X1)
}

/// 发现或拉起 daemon 并建立连接。失败返回 Err（调用方降级进程内 PTY）。
pub fn connect_or_spawn(
    app_handle: AppHandle,
    data_dir: &Path,
    is_dev: bool,
) -> Result<Arc<DaemonClient>, String> {
    let info_path = daemon_info_path(data_dir, is_dev);

    // 1) 已有存活 daemon → 直接连。
    if let Some(info) = read_daemon_info(&info_path)? {
        if is_pid_alive(info.pid) {
            match DaemonClient::connect(info.clone(), app_handle.clone()) {
                Ok(client) => {
                    // Incompatible runtime and no live sessions: safely replace
                    // the daemon. Active sessions are never killed or migrated.
                    if !client.is_runtime_compatible() {
                        let no_alive = client
                            .list()
                            .map(|sessions| sessions.iter().all(|s| !s.alive))
                            .unwrap_or(false);
                        if no_alive && client.shutdown_if_idle().is_ok() {
                            std::thread::sleep(Duration::from_millis(500));
                            return spawn_and_connect(app_handle, &info_path);
                        }
                        log::warn!(
                            "incompatible daemon with active sessions, keeping it: version={}, protocol_revision={}, capabilities={:?}",
                            client.daemon_version,
                            client.protocol_revision,
                            client.capabilities,
                        );
                    }
                    return Ok(client);
                }
                Err(err) => {
                    log::warn!("daemon handshake with recorded instance failed: {err}");
                    // 握手不上视为僵尸：删残留文件走重拉（孤儿清扫契约）。
                    remove_daemon_info(&info_path);
                }
            }
        } else {
            log::info!("stale daemon info found (pid dead), removing");
            remove_daemon_info(&info_path);
        }
    }

    // 2) 拉起新 daemon 并重试连接。
    spawn_and_connect(app_handle, &info_path)
}

fn spawn_and_connect(app_handle: AppHandle, info_path: &Path) -> Result<Arc<DaemonClient>, String> {
    spawn_daemon_process()?;
    for _ in 0..SPAWN_RETRY_MAX {
        std::thread::sleep(SPAWN_RETRY_INTERVAL);
        if let Some(info) = read_daemon_info(info_path)? {
            match DaemonClient::connect(info, app_handle.clone()) {
                Ok(client) => return Ok(client),
                Err(_) => continue,
            }
        }
    }
    Err("daemon did not become ready in time".to_string())
}

fn daemon_executable_path() -> Result<std::path::PathBuf, String> {
    let current = std::env::current_exe().map_err(|err| format!("current_exe failed: {err}"))?;
    if current.is_file() {
        return Ok(current);
    }
    Err("main executable not found for daemon self-spawn".to_string())
}

fn spawn_daemon_process() -> Result<(), String> {
    let exe = daemon_executable_path()?;
    let mut command = std::process::Command::new(&exe);
    command
        .arg("__daemon")
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // 仅隐藏控制台窗口。不要创建 detached/new process group：ConPTY 收到 ETX
        // 后需要向兼容的控制台进程组投递 Ctrl+C，否则普通输入正常但运行任务无法中断。
        command.creation_flags(windows_daemon_creation_flags());
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        // 独立进程组：app 收到的 SIGINT/SIGTERM 组信号不波及 daemon（契约）。
        command.process_group(0);
    }
    command
        .spawn()
        .map(|_| ())
        .map_err(|err| format!("spawn daemon failed: {err}"))
}

/// 读一行并施加单帧字节上限（与 daemon 服务端同规则）。
fn read_line_bounded(reader: &mut BufReader<TcpStream>) -> Option<String> {
    let mut buf = Vec::new();
    let mut limited = reader.by_ref().take((MAX_FRAME_BYTES + 1) as u64);
    match limited.read_until(b'\n', &mut buf) {
        Ok(0) => None,
        Ok(_) => {
            if buf.last() != Some(&b'\n') {
                return None;
            }
            buf.pop();
            if buf.last() == Some(&b'\r') {
                buf.pop();
            }
            String::from_utf8(buf).ok()
        }
        Err(err) => {
            log::warn!("daemon client read failed: {err}");
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matching_version_requires_compact_resize_capability() {
        assert!(!daemon_runtime_is_compatible(
            env!("CARGO_PKG_VERSION"),
            &[],
        ));
        assert!(daemon_runtime_is_compatible(
            env!("CARGO_PKG_VERSION"),
            &[CAPABILITY_PTY_RESIZE_2X1.to_string()],
        ));
    }

    #[test]
    fn capability_does_not_hide_product_version_mismatch() {
        assert!(!daemon_runtime_is_compatible(
            "0.0.0",
            &[CAPABILITY_PTY_RESIZE_2X1.to_string()],
        ));
    }

    #[test]
    fn daemon_bridge_distinguishes_startup_from_in_process_fallback() {
        let bridge = DaemonBridge::new();
        assert_eq!(bridge.compact_resize_state(), None);
        bridge.mark_unavailable();
        assert_eq!(bridge.compact_resize_state(), Some(true));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_daemon_keeps_conpty_ctrl_c_process_group_compatible() {
        const DETACHED_PROCESS: u32 = 0x0000_0008;
        const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;

        let flags = windows_daemon_creation_flags();
        assert_eq!(flags, CREATE_NO_WINDOW);
        assert_eq!(flags & DETACHED_PROCESS, 0);
        assert_eq!(flags & CREATE_NEW_PROCESS_GROUP, 0);
    }
}
