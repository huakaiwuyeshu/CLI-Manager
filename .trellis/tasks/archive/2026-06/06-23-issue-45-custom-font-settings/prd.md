# issue-45-custom-font-settings

## Goal

实现 GitHub issue #45：允许用户在设置中分别自定义应用字体与终端字体，并从当前系统字体库中选择可用字体，降低手动输入字体名的成本，同时保留现有默认字体、即时预览与回退体验。

## Requirements

* 用户可以在设置页分别设置应用字体族与终端字体族。
* 字体选择器应可搜索，并合并内置推荐字体、当前自定义值、后端读取到的系统字体。
* 应用字体继续写入既有 `uiFontFamily` 设置并即时作用到主界面；终端字体继续写入既有 `fontFamily` 设置并即时作用到 xterm 与预览。
* 后端新增只读字体枚举命令，返回当前宿主系统可被 CSS/WebView 使用的字体 family 名称。
* 读取系统字体失败或返回为空时，设置页仍显示内置推荐字体和当前配置，不阻断用户修改。
* Windows 主机上的 WSL distro 字体不纳入 MVP；当应用运行在 Linux/WSL 环境时，Linux 字体目录会按宿主环境自然枚举。

## Acceptance Criteria

* [ ] 设置页可分别修改“应用字体”和“终端字体”。
* [ ] 字体选项包含内置推荐字体、当前自定义值，以及后端读取到的系统字体。
* [ ] 字体列表读取失败时仍能显示内置选项，并可继续使用当前配置。
* [ ] 修改应用字体后，主界面字体即时生效，且不覆盖终端 xterm 字体。
* [ ] 修改终端字体后，终端预览与新/现有终端使用对应字体。
* [ ] 前端类型检查通过：`npx tsc --noEmit`。
* [ ] Rust 编译检查通过：`cd src-tauri && cargo check`。

## Definition of Done

* Typecheck / cargo check green，或失败原因明确说明。
* 行为变化记录在任务说明中。
* 不主动 commit；等待用户明确要求。

## Technical Approach

* Rust 侧新增 `commands::fonts::list_system_fonts`，优先用 `fontdb::Database::load_system_fonts()` 枚举当前宿主系统字体，去重排序后返回轻量 family 列表。
* 前端设置页用 Mantine searchable `Select` 承载系统字体选项，并保留当前自定义值。
* 应用字体选择放到现有外观/主题设置页，与终端字体区分；保存仍沿用 `settingsStore.update()`，不新增持久化 schema。
* 字体 family 转 CSS value 时对包含空格/特殊字符的系统字体加引号，并为应用字体/终端字体追加各自 fallback。

## Decision (ADR-lite)

**Context**: issue 要求支持 Windows/WSL/macOS/Linux 系统字体库；项目已存在字符串型 `uiFontFamily` 与 `fontFamily`，但没有系统字体枚举能力。

**Decision**: MVP 使用 Rust `fontdb` 在当前宿主系统枚举字体目录/配置，前端以可搜索选择器消费，不额外扫描 Windows 主机上的 WSL distro 字体。

**Consequences**: 方案轻量、跨平台、无需外部命令；可能不如 Windows DirectWrite/macOS CoreText 完全贴合系统 API 视图，但对设置下拉列表足够稳定。额外枚举 WSL distro 字体留作后续增强，避免列出 Windows WebView 实际不可用字体。

## Out of Scope

* 不引入云端字体下载或字体安装功能。
* 不改变现有终端主题系统。
* 不做字体文件预览/管理器。
* 不在 Windows 主机中额外调用 `wsl.exe` 扫描每个 distro 的字体。

## Technical Notes

* Likely impacted files:
  * `src/components/settings/pages/ThemeSettingsPage.tsx`
  * `src-tauri/Cargo.toml`
  * `src-tauri/src/commands/mod.rs`
  * `src-tauri/src/lib.rs`
  * 新增 `src-tauri/src/commands/fonts.rs`
* Existing constraints:
  * 前端无 ESLint/测试框架，改完前端务必跑 `npx tsc --noEmit`。
  * 新增 Tauri command 必须注册到 `src-tauri/src/lib.rs` 的 `invoke_handler![]`。
  * 按项目规则，编辑符号前需要做 GitNexus impact analysis。

## Research References

* [`research/system-font-enumeration.md`](research/system-font-enumeration.md) — `fontdb` 是轻量跨平台 MVP 首选；Windows 主机 WSL distro 字体不应默认混入可用字体列表。
* [`research/font-selector-ui.md`](research/font-selector-ui.md) — Mantine searchable `Select` 适合系统字体列表；手动自定义需要保留当前值或额外输入入口。
