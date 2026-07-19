# 内置 ccstatusline-zh 可视化状态栏

## Goal

以 ccstatusline-zh v2.2.23 为基线，将状态栏运行时、完整组件能力和可视化配置迁入 CLI-Manager，使用户无需安装 Node/Bun/npm 包即可配置并运行 Claude Code 状态栏。

## Requirements

- 完整覆盖 v2.2.23 的组件、三行布局、样式、Powerline、终端宽度、缓存、Hook 与刷新间隔能力。
- 使用 CLI-Manager 可执行文件的隐藏子命令 `__statusline` 从 stdin 读取 Claude payload 并向 stdout 输出状态栏。
- 在设置页提供组件增删改、搜索、拖拽排序、实时预览、安装、卸载和状态检测。
- 配置保存到 `.cli-manager/statusline/settings.json`，使用版本化 schema、校验和原子写入。
- 支持一次性导入 `~/.config/ccstatusline/settings.json` 的 v1-v3 配置；导入后不再双向同步。
- 安装状态栏时保留 Claude `settings.json` 的其他字段，写入前备份，兼容 Windows、WSL、macOS 和 Linux。
- 所有用户可见文案同时支持 zh-CN 和 en-US。
- 保留 ccstatusline-zh 的 MIT 许可证、NOTICE 和来源说明。
- 不修改现有未跟踪 `server/` 目录。
- Claude Code 实际状态栏为数据组件增加中文短标签；Git 分支使用 `⎇` 图标，不追加冗余标签。
- 上下文进度条作为单个组件显示 16 格进度、已用上下文、上下文上限和百分比。
- Powerline 首个信息块左侧保留三个空格，其右侧和后续信息块保持单空格留白。

## Changelog Target

`[TEMP]`

## Acceptance Criteria

- [ ] 不安装 ccstatusline-zh、Node 或 Bun 时，Claude Code 可通过 CLI-Manager 状态栏正常运行。
- [ ] v2.2.23 全部已注册组件均可配置并通过固定 payload 对照测试。
- [ ] 编辑器预览与 `__statusline` 实际输出由同一 Rust 渲染引擎生成。
- [ ] v1/v2/v3 合法旧配置可导入，非法配置不会被覆盖。
- [ ] 安装和卸载只修改 CLI-Manager 管理的 `statusLine`，不破坏 Claude 其他配置。
- [ ] Windows、WSL、macOS、Linux 的配置路径和命令转义有测试覆盖。
- [ ] `npx tsc --noEmit`、`cargo check`、`cargo test` 和相关前端测试通过。
- [ ] CHANGELOG、功能清单、许可证归属同步更新。
- [ ] 实际状态栏可显示 `模型:`、`思考:`、`合计:`、`费用:`、`上下文:` 等中文短标签。
- [ ] 上下文组件按 `[进度条] 已用/上限 (百分比)` 输出，例如 `[░░░░░░░░░░░░░░░░] 0/200k (0%)`。
- [ ] Powerline 首组件左侧为三个空格，其他方向保持紧凑单空格留白。

## Out of Scope

- 自动跟随或执行 ccstatusline-zh 后续版本代码；后续仅按需人工同步。
- 自动卸载用户已有的全局 ccstatusline-zh npm/Bun 包。
- 保留原项目的 npm/Bun 安装与更新管理页面；由 CLI-Manager 自身更新机制替代。

## Notes

- 基线仓库：https://github.com/huangguang1999/ccstatusline-zh，版本 2.2.23，MIT。
- 现有 `main`、`run`、`SettingsModal`、`HookSettingsPage` GitNexus 初始影响分析均为 LOW；实际修改每个符号前仍需重新分析。
