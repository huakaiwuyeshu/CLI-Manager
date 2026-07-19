# Tauri 单实例方案调研

日期：2026-06-26

## 结论

推荐使用官方 `tauri-plugin-single-instance`。

原因：

* 这是 Tauri 官方插件页面给出的标准方案。
* 支持在二次启动被拦截时执行回调，可直接唤醒现有窗口。
* 文档明确要求该插件第一个注册，适合在当前 `run()` 启动入口最小改动接入。

## 关键要点

* 安装方式：在 `src-tauri/Cargo.toml` 添加 `tauri-plugin-single-instance`。
* 初始化方式：在 `lib.rs` 的 `run()` 中注册 `tauri_plugin_single_instance::init(...)`。
* 二次启动回调参数包含 `app`、`args`、`cwd`，当前需求只需要 `app`。
* 官方示例直接通过 `app.get_webview_window("main")` 聚焦现有窗口。
* 官方说明：Single Instance 插件必须最先注册。

## 与本仓库的映射

* 当前项目已经在托盘点击时通过 `get_webview_window("main")` + `show` + `unminimize` + `set_focus` 唤醒主窗口。
* 因此二次启动回调可以复用同样的窗口唤醒逻辑，不需要引入新的窗口管理抽象。

## 参考

* Tauri 官方文档：<https://v2.tauri.app/plugin/single-instance/>
* docs.rs：<https://docs.rs/tauri-plugin-single-instance/latest/tauri_plugin_single_instance/>
