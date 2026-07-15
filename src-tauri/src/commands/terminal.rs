use crate::claude_hook::ClaudeHookBridge;
use crate::commands::ccswitch::{
    apply_codex_provider_launch_env, refresh_claude_provider_launch_settings,
    ClaudeProviderLaunchConfig, CodexProviderLaunchConfig,
};
use crate::daemon::client::DaemonBridge;
use crate::daemon::protocol::SessionMeta;
use crate::pty::manager::{
    PtyManager, PtyOrphanCleanupSummary, PtyProcessStatus, MIN_PTY_COLS, MIN_PTY_ROWS,
};
use crate::pty::tauri_sink::TauriPtyEventSink;
use log::{debug, error, info, warn};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use tauri::AppHandle;
use uuid::Uuid;

#[tauri::command]
pub async fn pty_create(
    app_handle: AppHandle,
    pty_manager: tauri::State<'_, PtyManager>,
    claude_hook_bridge: tauri::State<'_, ClaudeHookBridge>,
    daemon_bridge: tauri::State<'_, DaemonBridge>,
    cwd: Option<String>,
    env_vars: Option<HashMap<String, String>>,
    shell: Option<String>,
    hook_env_enabled: Option<bool>,
    claude_provider: Option<ClaudeProviderLaunchConfig>,
    codex_provider: Option<CodexProviderLaunchConfig>,
) -> Result<String, String> {
    let session_id = Uuid::new_v4().to_string();
    let mut env_vars = env_vars.unwrap_or_default();
    refresh_claude_provider_launch_settings(&app_handle, claude_provider).await?;
    apply_codex_provider_launch_env(&app_handle, codex_provider, shell.as_deref(), &mut env_vars)
        .await?;
    env_vars.insert("CLI_MANAGER_TAB_ID".to_string(), session_id.clone());

    // daemon 模式：hook 上报指向 daemon 的稳定端口（app 重启不失效，契约★）；
    // 进程内模式：沿用 app 自身 hook bridge。
    let daemon_client = daemon_bridge.get();
    if hook_env_enabled.unwrap_or(false) {
        match daemon_client.as_ref() {
            Some(client) => {
                let info = client.info();
                if info.hook_port > 0 {
                    env_vars.insert(
                        "CLI_MANAGER_NOTIFY_PORT".to_string(),
                        info.hook_port.to_string(),
                    );
                    env_vars.insert("CLI_MANAGER_NOTIFY_TOKEN".to_string(), info.token.clone());
                }
            }
            None => claude_hook_bridge.apply_env(&session_id, &mut env_vars),
        }
    }

    let env_count = env_vars.len();
    info!(
        "pty_create requested: session_id={}, cwd={:?}, shell={:?}, env_vars={}, daemon={}",
        session_id,
        cwd,
        shell,
        env_count,
        daemon_client.is_some()
    );

    if let Some(client) = daemon_client {
        client
            .create(&session_id, cwd.clone(), Some(env_vars), shell.clone())
            .map_err(|err| {
                error!(
                    "pty_create (daemon) failed: session_id={}, error={}",
                    session_id, err
                );
                err
            })?;
        // 立即 attach：订阅输出推送（新会话 replay 为空）。
        if let Err(err) = client.attach(&session_id) {
            warn!(
                "pty attach after create failed: session_id={}, error={}",
                session_id, err
            );
        }
        info!("pty_create succeeded (daemon): session_id={}", session_id);
        return Ok(session_id);
    }

    pty_manager
        .create(
            &session_id,
            cwd.as_deref(),
            Some(env_vars),
            shell.as_deref(),
            Arc::new(TauriPtyEventSink::new(app_handle)),
        )
        .map_err(|err| {
            error!(
                "pty_create failed: session_id={}, error={}",
                session_id, err
            );
            err
        })?;
    info!("pty_create succeeded: session_id={}", session_id);
    Ok(session_id)
}

#[tauri::command]
pub async fn pty_write(
    pty_manager: tauri::State<'_, PtyManager>,
    daemon_bridge: tauri::State<'_, DaemonBridge>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    if let Some(client) = daemon_bridge.get() {
        return client.write(&session_id, &data).map_err(|err| {
            error!(
                "pty_write (daemon) failed: session_id={}, error={}",
                session_id, err
            );
            err
        });
    }
    pty_manager.write(&session_id, &data).map_err(|err| {
        error!("pty_write failed: session_id={}, error={}", session_id, err);
        err
    })
}

#[tauri::command]
pub async fn pty_resize(
    pty_manager: tauri::State<'_, PtyManager>,
    daemon_bridge: tauri::State<'_, DaemonBridge>,
    session_id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    debug!(
        "pty_resize requested: session_id={}, cols={}, rows={}",
        session_id, cols, rows
    );
    if let Some(client) = daemon_bridge.get() {
        return client.resize(&session_id, cols, rows).map_err(|err| {
            error!(
                "pty_resize (daemon) failed: session_id={}, error={}",
                session_id, err
            );
            err
        });
    }
    pty_manager.resize(&session_id, cols, rows).map_err(|err| {
        error!(
            "pty_resize failed: session_id={}, error={}",
            session_id, err
        );
        err
    })
}

#[tauri::command]
pub async fn pty_close(
    pty_manager: tauri::State<'_, PtyManager>,
    daemon_bridge: tauri::State<'_, DaemonBridge>,
    session_id: String,
) -> Result<(), String> {
    info!("pty_close requested: session_id={}", session_id);
    if let Some(client) = daemon_bridge.get() {
        let result = client.close(&session_id).map_err(|err| {
            error!(
                "pty_close (daemon) failed: session_id={}, error={}",
                session_id, err
            );
            err
        });
        if result.is_ok() {
            info!("pty_close succeeded (daemon): session_id={}", session_id);
        }
        return result;
    }
    let result = pty_manager.close(&session_id).map_err(|err| {
        error!("pty_close failed: session_id={}, error={}", session_id, err);
        err
    });
    if result.is_ok() {
        info!("pty_close succeeded: session_id={}", session_id);
    }
    result
}

#[tauri::command]
pub async fn pty_close_all(
    pty_manager: tauri::State<'_, PtyManager>,
    daemon_bridge: tauri::State<'_, DaemonBridge>,
) -> Result<(), String> {
    info!("pty_close_all requested");
    if let Some(client) = daemon_bridge.get() {
        let result = client.close_all().map_err(|err| {
            error!("pty_close_all (daemon) failed: error={}", err);
            err
        });
        if result.is_ok() {
            info!("pty_close_all succeeded (daemon)");
        }
        return result;
    }
    let result = pty_manager.close_all().map_err(|err| {
        error!("pty_close_all failed: error={}", err);
        err
    });
    if result.is_ok() {
        info!("pty_close_all succeeded");
    }
    result
}

#[tauri::command]
pub async fn pty_reconcile_active_sessions(
    pty_manager: tauri::State<'_, PtyManager>,
    daemon_bridge: tauri::State<'_, DaemonBridge>,
    active_session_ids: Vec<String>,
) -> Result<PtyOrphanCleanupSummary, String> {
    debug!(
        "pty_reconcile_active_sessions requested: active_count={}",
        active_session_ids.len()
    );
    if let Some(client) = daemon_bridge.get() {
        let summary = client.reconcile(active_session_ids)?;
        return serde_json::from_value(summary)
            .map_err(|err| format!("daemon reconcile summary parse failed: {err}"));
    }
    Ok(pty_manager.reconcile_active_sessions(active_session_ids))
}

#[tauri::command]
pub async fn pty_status(
    pty_manager: tauri::State<'_, PtyManager>,
    daemon_bridge: tauri::State<'_, DaemonBridge>,
) -> Result<HashMap<String, PtyProcessStatus>, String> {
    debug!("pty_status requested");
    if let Some(client) = daemon_bridge.get() {
        return client.status_all();
    }
    Ok(pty_manager.status_all())
}

/// daemon 是否可用（前端"转入后台=真退出"分支判定）。
#[tauri::command]
pub async fn pty_daemon_active(
    daemon_bridge: tauri::State<'_, DaemonBridge>,
) -> Result<bool, String> {
    Ok(daemon_bridge.get().is_some())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyMinimumGridSize {
    pub cols: u16,
    pub rows: u16,
    pub ready: bool,
}

/// Report the effective minimum shared by xterm and the process hosting the PTY.
/// Older persistent daemons still clamp to 40x8, so the frontend must use the
/// same grid until those sessions are safely closed and the daemon is replaced.
#[tauri::command]
pub async fn pty_minimum_grid_size(
    daemon_bridge: tauri::State<'_, DaemonBridge>,
) -> Result<PtyMinimumGridSize, String> {
    Ok(match daemon_bridge.compact_resize_state() {
        None => PtyMinimumGridSize {
            cols: 40,
            rows: 8,
            ready: false,
        },
        Some(true) => PtyMinimumGridSize {
            cols: MIN_PTY_COLS,
            rows: MIN_PTY_ROWS,
            ready: true,
        },
        Some(false) => PtyMinimumGridSize {
            cols: 40,
            rows: 8,
            ready: true,
        },
    })
}

/// daemon 中的会话列表（启动恢复时优先 attach 的依据）。
#[tauri::command]
pub async fn pty_daemon_sessions(
    daemon_bridge: tauri::State<'_, DaemonBridge>,
) -> Result<Vec<SessionMeta>, String> {
    match daemon_bridge.get() {
        Some(client) => {
            let sessions = client.list()?;
            let alive_count = sessions.iter().filter(|session| session.alive).count();
            info!(
                "pty_daemon_sessions requested: count={}, alive_count={}",
                sessions.len(),
                alive_count
            );
            Ok(sessions)
        }
        None => {
            info!("pty_daemon_sessions requested: daemon unavailable");
            Ok(Vec::new())
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtyAttachResult {
    pub attached: bool,
    pub alive: bool,
    pub replay_base64: String,
    pub cwd: Option<String>,
    pub shell: Option<String>,
    pub created_at_ms: u64,
    pub task_status: Option<String>,
    pub task_updated_at_ms: Option<u64>,
}

/// attach daemon 中已存在的会话：订阅输出并返回 ring buffer 回放。
/// daemon 不可用或会话不存在 → attached=false（调用方走 resume 兜底）。
#[tauri::command]
pub async fn pty_attach(
    daemon_bridge: tauri::State<'_, DaemonBridge>,
    session_id: String,
) -> Result<PtyAttachResult, String> {
    let Some(client) = daemon_bridge.get() else {
        return Ok(PtyAttachResult {
            attached: false,
            alive: false,
            replay_base64: String::new(),
            cwd: None,
            shell: None,
            created_at_ms: 0,
            task_status: None,
            task_updated_at_ms: None,
        });
    };
    match client.attach(&session_id) {
        Ok((replay_base64, meta)) => Ok(PtyAttachResult {
            attached: true,
            alive: meta.alive,
            replay_base64,
            cwd: meta.cwd,
            shell: meta.shell,
            created_at_ms: meta.created_at_ms,
            task_status: meta.task_status,
            task_updated_at_ms: meta.task_updated_at_ms,
        }),
        Err(err) => {
            debug!("pty_attach miss: session_id={}, reason={}", session_id, err);
            Ok(PtyAttachResult {
                attached: false,
                alive: false,
                replay_base64: String::new(),
                cwd: None,
                shell: None,
                created_at_ms: 0,
                task_status: None,
                task_updated_at_ms: None,
            })
        }
    }
}
