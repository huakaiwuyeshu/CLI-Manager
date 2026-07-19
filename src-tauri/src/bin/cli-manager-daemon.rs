//! `cli-manager-daemon`：PTY 守护进程入口（Issue #123 Phase 2）。
//!
//! 由主应用按需拉起（detached），不接受手工参数；dev/安装版由编译期
//! `debug_assertions` 决定使用 `daemon.dev.json` / `daemon.json`，互不串扰。

use cli_manager_lib::app_paths::cli_manager_data_dir;
use cli_manager_lib::daemon::discovery::daemon_info_path;
use cli_manager_lib::daemon::server::{DaemonServer, DaemonServerConfig};
use cli_manager_lib::daemon::setup_process_governance;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if cli_manager_lib::ssh_proxy::is_helper_request(&args) {
        cli_manager_lib::ssh_proxy::run_helper_and_exit(&args);
    }
    if std::env::var_os("CLI_MANAGER_SSH_ASKPASS").is_some() {
        cli_manager_lib::ssh_askpass::run_helper_and_exit();
    }
    // 极简 stderr 日志：daemon 无窗口，detached 模式下 stderr 通常被丢弃，
    // 增量 2 接入文件日志（LogDir/cli-manager-daemon.log）。
    let _ = simple_stderr_logger::init();
    // Job Object 兜底必须最先执行：之后 spawn 的 PTY 子进程才会进 Job。
    setup_process_governance();

    let data_dir = match cli_manager_data_dir() {
        Ok(dir) => dir,
        Err(err) => {
            eprintln!("cli-manager-daemon: data dir unavailable: {err}");
            std::process::exit(1);
        }
    };
    let info_path = daemon_info_path(&data_dir, cfg!(debug_assertions));
    let config = DaemonServerConfig {
        info_path,
        version: env!("CARGO_PKG_VERSION").to_string(),
    };
    if let Err(err) = DaemonServer::run(config) {
        // 启动失败最常见原因：已有存活实例持有发现文件（单实例约束）。
        eprintln!("cli-manager-daemon: {err}");
        std::process::exit(1);
    }
}

mod simple_stderr_logger {
    use log::{Level, Metadata, Record};

    struct StderrLogger;

    impl log::Log for StderrLogger {
        fn enabled(&self, metadata: &Metadata) -> bool {
            metadata.level() <= Level::Info
        }
        fn log(&self, record: &Record) {
            if self.enabled(record.metadata()) {
                eprintln!("[{}] {}", record.level(), record.args());
            }
        }
        fn flush(&self) {}
    }

    static LOGGER: StderrLogger = StderrLogger;

    pub fn init() -> Result<(), log::SetLoggerError> {
        log::set_logger(&LOGGER).map(|_| log::set_max_level(log::LevelFilter::Info))
    }
}
