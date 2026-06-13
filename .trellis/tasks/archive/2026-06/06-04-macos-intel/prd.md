# 取消 macOS Intel 打包

## Goal

取消 GitHub Actions release workflow 中的 macOS Intel / x86_64-apple-darwin 构建，避免发布流程继续等待或生成不再支持的 Intel Apple 安装包。

## What I already know

* 用户要求取消 Intel CPU 的 Apple 打包，不再兼容该架构。
* 用户要求完成后提交。
* `.github/workflows/release.yml` 当前 matrix 同时包含 `macos-14` 的 `aarch64-apple-darwin` 和 `macos-13` 的 `x86_64-apple-darwin`。
* 发布说明表格当前仍列出 `macOS (Intel)`。

## Requirements

* 移除 release workflow matrix 中的 `macos-13` / `x86_64-apple-darwin` 构建项。
* 移除 release body 中的 `macOS (Intel)` 安装包说明。
* 保留 Windows、macOS Apple Silicon、Linux 构建。
* 完成变更后创建 git commit。

## Acceptance Criteria

* [x] `.github/workflows/release.yml` 不再包含 `x86_64-apple-darwin`。
* [x] `.github/workflows/release.yml` 不再包含 `macos-13` Intel 构建项。
* [x] release body 不再声明 macOS Intel 安装包。
* [x] git diff 仅包含预期 workflow 文案/矩阵变更。
* [x] 变更已提交到当前分支。

## Definition of Done

* 读取相关 Trellis 规范。
* 修改 release workflow。
* 用搜索和 git diff 验证影响范围。
* 创建一次新的 git commit。

## Out of Scope

* 不修改应用版本号。
* 不修改 Tauri/Rust/前端源码。
* 不改变 Apple Silicon、Windows、Linux 的构建配置。

## Technical Notes

* `python ./.trellis/scripts/get_context.py --mode packages` 在当前环境段错误退出，已退回到直接读取共享规范。
* 已读取 `.trellis/spec/guides/index.md`、`.trellis/spec/guides/version-update-checklist.md`、`.trellis/spec/guides/code-reuse-thinking-guide.md`。
* 已读取 `.github/workflows/release.yml`。
* 搜索结果显示 `x86_64-apple-darwin`、`macos-13`、`macOS (Intel)` 只出现在 `.github/workflows/release.yml`。
