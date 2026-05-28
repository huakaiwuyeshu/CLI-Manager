use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::{Arc, Mutex, RwLock};
use std::thread::JoinHandle;
use tauri::{AppHandle, Emitter};
use log::{debug, error, info};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;

use crate::pty::boundary::safe_emit_boundary;

/// Reader 累积阈值：达到该阈值或下游显式没有更多数据时才 emit，避免高吞吐时
/// 每次 read 都触发一次 IPC + Base64 编码。
const READER_FLUSH_THRESHOLD: usize = 32 * 1024;
const READER_BUF_SIZE: usize = 16 * 1024;
const MIN_PTY_COLS: u16 = 40;
const MIN_PTY_ROWS: u16 = 8;

pub struct PtySession {
    writer: Box<dyn Write + Send>,
    master: Box<dyn MasterPty + Send>,
    child: Arc<Mutex<Box<dyn portable_pty::Child + Send + Sync>>>,
    diagnostics: Arc<Mutex<PtySessionDiagnostics>>,
    reader_handle: Option<JoinHandle<()>>,
}

#[derive(Clone)]
struct PtySessionDiagnostics {
    session_id: String,
    shell: String,
    exe: String,
    cwd: Option<String>,
    last_resize_cols: Option<u16>,
    last_resize_rows: Option<u16>,
}

#[derive(Clone, Serialize)]
pub struct PtyProcessStatus {
    pub status: String,
    pub exit_code: Option<i32>,
}

pub struct PtyManager {
    sessions: RwLock<HashMap<String, Arc<Mutex<PtySession>>>>,
    statuses: Arc<Mutex<HashMap<String, PtyProcessStatus>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            sessions: RwLock::new(HashMap::new()),
            statuses: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    fn resolve_shell(shell: &str) -> (&'static str, Option<&'static str>) {
        match shell {
            "cmd" => ("cmd.exe", Some("/Q")),
            "pwsh" => ("pwsh.exe", Some("-NoLogo")),
            "wsl" => ("wsl.exe", None),
            "bash" => ("bash.exe", None),
            _ => ("powershell.exe", Some("-NoLogo")),
        }
    }

    pub fn create(
        &self,
        session_id: &str,
        cwd: Option<&str>,
        env_vars: Option<HashMap<String, String>>,
        shell: Option<&str>,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        let env_count = env_vars.as_ref().map(|vars| vars.len()).unwrap_or(0);
        info!(
            "pty session create: id={}, shell={:?}, cwd={:?}, env_vars={}",
            session_id, shell, cwd, env_count
        );
        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: 24,
                cols: 80,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| {
                error!("pty openpty failed: id={}, error={}", session_id, e);
                e.to_string()
            })?;

        let (exe, arg) = Self::resolve_shell(shell.unwrap_or("powershell"));
        let mut cmd = CommandBuilder::new(exe);
        if let Some(a) = arg {
            cmd.arg(a);
        }

        if let Some(dir) = cwd {
            cmd.cwd(dir);
        }
        if let Some(vars) = env_vars {
            for (k, v) in vars {
                cmd.env(k, v);
            }
        }

        let child = pair.slave.spawn_command(cmd).map_err(|e| {
            error!(
                "pty spawn failed: id={}, exe={}, error={}",
                session_id, exe, e
            );
            e.to_string()
        })?;
        drop(pair.slave);

        let writer = pair.master.take_writer().map_err(|e| {
            error!("pty take_writer failed: id={}, error={}", session_id, e);
            e.to_string()
        })?;
        let mut reader = pair.master.try_clone_reader().map_err(|e| {
            error!("pty clone_reader failed: id={}, error={}", session_id, e);
            e.to_string()
        })?;

        let child = Arc::new(Mutex::new(child));
        let diagnostics = Arc::new(Mutex::new(PtySessionDiagnostics {
            session_id: session_id.to_string(),
            shell: shell.unwrap_or("powershell").to_string(),
            exe: exe.to_string(),
            cwd: cwd.map(str::to_string),
            last_resize_cols: None,
            last_resize_rows: None,
        }));
        let output_event = format!("pty-output-{session_id}");
        let status_event = format!("pty-status-{session_id}");
        let status_map = self.statuses.clone();
        let child_for_thread = child.clone();
        let diagnostics_for_thread = diagnostics.clone();
        let session_id_owned = session_id.to_string();

        self.statuses.lock().unwrap().insert(
            session_id.to_string(),
            PtyProcessStatus {
                status: "running".to_string(),
                exit_code: None,
            },
        );

        let reader_handle = std::thread::spawn(move || {
            let mut buf = [0u8; READER_BUF_SIZE];
            let mut pending: Vec<u8> = Vec::with_capacity(READER_FLUSH_THRESHOLD * 2);
            let mut reader_end_reason = "eof".to_string();
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        pending.extend_from_slice(&buf[..n]);
                        // 动态批量：buffer 被读满意味着可能还有更多数据，先累积；
                        // 反之或累计已超阈值就立即 emit，避免延迟。
                        let likely_more = n == buf.len();
                        if !likely_more || pending.len() >= READER_FLUSH_THRESHOLD {
                            // 关键：仅 emit 处于 UTF-8 + ANSI 序列边界的安全前缀，
                            // 残尾保留到下一轮拼接，避免前端 xterm 把残字节解读为 SGR 参数。
                            let safe = safe_emit_boundary(&pending);
                            if safe > 0 {
                                let encoded = STANDARD.encode(&pending[..safe]);
                                let _ = app_handle.emit(&output_event, encoded);
                                pending.drain(..safe);
                            } else if pending.len() > READER_FLUSH_THRESHOLD * 8 {
                                // 极端兜底：未终结序列超 256KB（远大于任何正常 OSC/CSI），
                                // 说明源端格式异常，强制 emit 避免内存无限增长。
                                debug!(
                                    "pty pending buffer overflowed boundary protection: id={}, len={}",
                                    session_id_owned, pending.len()
                                );
                                let encoded = STANDARD.encode(&pending);
                                let _ = app_handle.emit(&output_event, encoded);
                                pending.clear();
                            }
                        }
                    }
                    Err(e) => {
                        reader_end_reason = format!("read_error: {e}");
                        break;
                    }
                }
            }
            // 进程退出，把剩余数据全部发出去（不再保护边界，最后一帧）
            if !pending.is_empty() {
                let encoded = STANDARD.encode(&pending);
                let _ = app_handle.emit(&output_event, encoded);
                pending.clear();
            }

            // Process exited — check exit status
            let (new_status, child_exit_status, child_exit_code_raw, child_wait_error) =
                match child_for_thread.lock().unwrap().try_wait() {
                    Ok(Some(exit)) => {
                        let exit_code = exit.exit_code();
                        (
                            PtyProcessStatus {
                                status: "exited".to_string(),
                                exit_code: Some(exit_code as i32),
                            },
                            Some(format!("{exit:?}")),
                            Some(exit_code),
                            None,
                        )
                    }
                    Ok(None) => (
                        PtyProcessStatus {
                            status: "exited".to_string(),
                            exit_code: None,
                        },
                        None,
                        None,
                        None,
                    ),
                    Err(e) => (
                        PtyProcessStatus {
                            status: "error".to_string(),
                            exit_code: None,
                        },
                        None,
                        None,
                        Some(e.to_string()),
                    ),
                };
            let diagnostics = diagnostics_for_thread.lock().unwrap().clone();
            info!(
                "pty reader ended: reason={}, id={}, status={}, exit_code={:?}, child_exit_status={:?}, child_exit_code_raw={:?}, shell={}, exe={}, cwd={:?}, last_resize_cols={:?}, last_resize_rows={:?}, child_wait_error={:?}",
                reader_end_reason,
                diagnostics.session_id,
                new_status.status,
                new_status.exit_code,
                child_exit_status,
                child_exit_code_raw,
                diagnostics.shell,
                diagnostics.exe,
                diagnostics.cwd,
                diagnostics.last_resize_cols,
                diagnostics.last_resize_rows,
                child_wait_error
            );

            if let Ok(mut statuses) = status_map.lock() {
                if let Some(entry) = statuses.get_mut(&session_id_owned) {
                    *entry = new_status.clone();
                }
            }

            let _ = app_handle.emit(&status_event, new_status);
        });

        let session = Arc::new(Mutex::new(PtySession {
            writer,
            master: pair.master,
            child,
            diagnostics,
            reader_handle: Some(reader_handle),
        }));
        self.sessions
            .write()
            .unwrap()
            .insert(session_id.to_string(), session);
        info!("pty session ready: id={}", session_id);
        Ok(())
    }

    pub fn write(&self, session_id: &str, data: &str) -> Result<(), String> {
        let session_arc = {
            let sessions = self.sessions.read().unwrap();
            sessions.get(session_id).cloned()
        }
        .ok_or_else(|| {
            let msg = format!("Session {session_id} not found");
            error!("pty write failed: {}", msg);
            msg
        })?;
        let mut session = session_arc.lock().unwrap();
        session
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| {
                error!("pty write failed: session_id={}, error={}", session_id, e);
                e.to_string()
            })?;
        session.writer.flush().map_err(|e| {
            error!("pty flush failed: session_id={}, error={}", session_id, e);
            e.to_string()
        })?;
        Ok(())
    }

    pub fn resize(&self, session_id: &str, cols: u16, rows: u16) -> Result<(), String> {
        let session_arc = {
            let sessions = self.sessions.read().unwrap();
            sessions.get(session_id).cloned()
        }
        .ok_or_else(|| {
            let msg = format!("Session {session_id} not found");
            error!("pty resize failed: {}", msg);
            msg
        })?;
        let session = session_arc.lock().unwrap();
        let cols = cols.max(MIN_PTY_COLS);
        let rows = rows.max(MIN_PTY_ROWS);
        debug!(
            "pty resize: session_id={}, cols={}, rows={}",
            session_id, cols, rows
        );
        if let Ok(mut diagnostics) = session.diagnostics.lock() {
            diagnostics.last_resize_cols = Some(cols);
            diagnostics.last_resize_rows = Some(rows);
        }
        session
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| {
                error!("pty resize failed: session_id={}, error={}", session_id, e);
                e.to_string()
            })
    }

    pub fn close(&self, session_id: &str) -> Result<(), String> {
        let session_arc = {
            let mut sessions = self.sessions.write().unwrap();
            sessions.remove(session_id)
        };
        if let Some(session_arc) = session_arc {
            // Kill child first, take reader handle out, then drop the Arc.
            // Dropping the last Arc releases the master PTY, which causes the
            // reader thread to observe EOF and exit promptly.
            let reader_handle = {
                let mut session = session_arc.lock().unwrap();
                let _ = session.child.lock().unwrap().kill();
                session.reader_handle.take()
            };
            drop(session_arc);
            if let Some(handle) = reader_handle {
                let _ = handle.join();
            }
            info!("pty session killed: id={}", session_id);
        } else {
            debug!("pty close requested for missing session: id={}", session_id);
        }
        self.statuses.lock().unwrap().remove(session_id);
        Ok(())
    }

    pub fn status_all(&self) -> HashMap<String, PtyProcessStatus> {
        self.statuses.lock().unwrap().clone()
    }
}
