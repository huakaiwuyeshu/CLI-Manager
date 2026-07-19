# 系统级别 Hook 通知（支持 Win/WSL/Mac/Linux）

## Goal

在现有 CLI-Manager 的 Claude/Codex hook 通知基础上，**并行**推送系统原生通知，使用户在其他应用中也能关注到 Claude Code / Codex CLI 的状态变化（Done/Failed/Attention/PermissionRequest 等）。保持现有应用内通知逻辑不变，仅增加系统通知层。

## What I already know

### 现有 hook 系统架构

**Rust 后端** (`src-tauri/src/claude_hook.rs`):
- TCP server 监听 `127.0.0.1:随机端口`，通过一次性 token 校验
- 接收 Claude/Codex 的 hook 上报（POST `/api/claude-hook`）
- 事件类型：`SessionStart` / `UserPromptSubmit` / `Notification` / `Stop` / `StopFailure` / `PermissionRequest`
- 验证后通过 `app_handle.emit("claude-hook-notification", payload)` 发送给前端

**前端** (`App.tsx` + `stores/terminalStore.ts`):
- 监听 `claude-hook-notification` 事件
- `App.tsx:119` 的 `showClaudeHookToast()` 根据 `settings.hookPopupNotificationsEnabled` 决定是否弹应用内通知
- 通知内容包括：事件类型、项目名（来自 `tabTitle`）、消息、点击跳转到对应 Tab

**设置项** (`settingsStore.ts` + `HookSettingsPage.tsx`):
- `hookPopupNotificationsEnabled`: 是否启用应用内通知（当前设置）
- `hookPopupAutoCloseEnabled`: 是否自动关闭
- `hookPopupAutoCloseSeconds`: 自动关闭秒数

**依赖** (`src-tauri/Cargo.toml`):
- 目前 **未** 引入 `tauri-plugin-notification`

### 技术约束

- **Tauri 2** 项目，`tauri` = "2" + 多个官方插件已集成
- **跨平台目标**: Windows / macOS / Linux，**需要支持 WSL**
- **IPC 边界**: 所有命令必须在 `src-tauri/src/lib.rs` 的 `invoke_handler![]` 注册
- **设置持久化**: 用户偏好走 `tauri-plugin-store`，由 `settingsStore.ts` 管理
- **通知权限**: 系统通知需要操作系统授权（macOS/Linux 首次会弹授权；Windows 在系统设置中控制）

### WSL 特殊性

- WSL 环境本身没有原生通知中心，需要通过 **Windows 主机** 发送通知
- Tauri 的 `tauri-plugin-notification` 是默认发送路径；仅当该路径不可用且运行环境确认为 WSL 时，才调用 Windows 侧 `powershell.exe` 桥接

## Requirements

### 功能需求

1. **系统通知触发**: 所有现有 hook 事件都发送系统通知（与应用内通知并行，不互斥）
   - `SessionStart`
   - `UserPromptSubmit`
   - `Notification`
   - `Stop`
   - `PermissionRequest`
   - `StopFailure`

2. **通知内容**: 显示事件类型 + 项目名（来自 `cwd` 或 `tabTitle`）
   - 标题：如 `"Claude Code - Done"` / `"Codex CLI - Failed"`
   - 正文：项目名 + 可选的 `message` 字段

3. **点击行为**: 用户点击系统通知后，操作系统自动前置 CLI-Manager 窗口
   - 依赖操作系统默认行为（Windows/macOS/Linux 点击通知会自动前置应用）
   - 用户看到应用内的 tab 状态指示器（小圆点），手动点击进入对应 tab

4. **用户控制**: 设置页面按事件类型分别控制是否发送系统通知
   - 全局开关：`systemNotificationsEnabled: boolean`
   - 分事件开关：`systemNotificationEvents: Record<HookEventType, boolean>`
   - UI 在 `HookSettingsPage.tsx` 新增"系统通知"区域

5. **WSL 支持**: 检测 WSL 环境，通过 Windows 主机发送通知
   - 运行时检测：读取 `/proc/version` 或环境变量 `WSL_DISTRO_NAME`
   - 通知发送：调用 `powershell.exe -Command "..."` 或 `wsl.exe --exec ...`

### 非功能需求

- **性能**: 系统通知发送为异步非阻塞，不影响 hook 事件处理速度
- **兼容性**: 不破坏现有应用内通知逻辑
- **优雅降级**: 若系统通知权限未授予或发送失败，不影响应用内通知和 hook 绑定

## Acceptance Criteria

- [ ] 所有 hook 事件（SessionStart/UserPromptSubmit/Notification/Stop/StopFailure/PermissionRequest）触发系统通知
- [ ] 通知内容包含事件类型 + 项目名
- [ ] 点击系统通知后，窗口自动前置（操作系统默认行为）
- [ ] 设置页面新增"系统通知"区域，支持全局开关 + 按事件类型分别控制
- [ ] Windows / macOS / Linux 系统通知正常工作
- [ ] WSL 环境下通过 Windows 主机发送通知
- [ ] 系统通知与应用内通知可独立开关，互不干扰
- [ ] 系统通知发送失败时，不影响应用内通知和 hook 事件处理

## Definition of Done

- `tauri-plugin-notification` 集成到 `Cargo.toml` 并在 `lib.rs` 注册
- 前端在 `App.tsx` 的 hook 监听处并行发送系统通知
- WSL 检测逻辑：运行时判断 WSL 环境并选择通知发送方式
- 前端设置项扩展：`systemNotificationsEnabled` / `systemNotificationEvents`
- `HookSettingsPage.tsx` UI 新增"系统通知"配置区域
- 点击系统通知的行为：依赖操作系统自动前置窗口（无需额外代码）
- 四平台手动测试通过（Windows / macOS / Linux / WSL）
- 代码 `tsc --noEmit` 通过，Rust `cargo check` 通过

## Technical Approach

### 1. 依赖集成

**Cargo.toml**:
```toml
[dependencies]
tauri-plugin-notification = "2"
```

**lib.rs** 的 `tauri::Builder::default()` 链式调用中加入:
```rust
.plugin(tauri_plugin_notification::init())
```

### 2. Rust 后端改造（仅 WSL 桥接）

**新增 commands** (`src-tauri/src/commands/system_notification.rs`):

```rust
#[tauri::command]
fn is_wsl() -> bool {
    std::fs::read_to_string("/proc/version")
        .map(|s| {
            let lower = s.to_lowercase();
            lower.contains("microsoft") || lower.contains("wsl")
        })
        .unwrap_or(false)
}

#[tauri::command]
async fn send_notification_via_windows(title: String, body: String) -> Result<(), String> {
    // 使用 WinRT Toast API（无需 BurntToast 模块）
    let xml = format!(
        r#"<toast><visual><binding template="ToastText02"><text id="1">{}</text><text id="2">{}</text></binding></visual></toast>"#,
        html_escape(&title),
        html_escape(&body)
    );
    
    let script = format!(
        r#"
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null;
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null;
        $xml = [Windows.Data.Xml.Dom.XmlDocument]::new();
        $xml.LoadXml('{}');
        $toast = [Windows.UI.Notifications.ToastNotification]::new($xml);
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('CLI-Manager').Show($toast);
        "#,
        xml.replace("'", "''") // PowerShell 单引号转义
    );
    
    std::process::Command::new("powershell.exe")
        .arg("-NoProfile")
        .arg("-Command")
        .arg(&script)
        .spawn()
        .map_err(|e| format!("Failed to spawn powershell: {}", e))?;
    
    Ok(())
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
```

**注册 commands** (`src-tauri/src/lib.rs`):
```rust
.invoke_handler(tauri::generate_handler![
    // ... 现有 commands
    commands::system_notification::is_wsl,
    commands::system_notification::send_notification_via_windows,
])
```

### 3. 前端改造

**settingsStore.ts**:
```typescript
interface Settings {
  // ... 现有字段
  systemNotificationsEnabled: boolean;
  systemNotificationEvents: {
    SessionStart: boolean;
    UserPromptSubmit: boolean;
    Notification: boolean;
    Stop: boolean;
    StopFailure: boolean;
    PermissionRequest: boolean;
  };
}

const DEFAULTS: Settings = {
  // ...
  systemNotificationsEnabled: true, // 默认开启（子事件按需控制）
  systemNotificationEvents: {
    SessionStart: false,        // 默认禁用（噪音）
    UserPromptSubmit: false,    // 默认禁用（噪音）
    Notification: true,         // 默认启用（关键）
    Stop: true,                 // 默认启用（关键）
    StopFailure: true,          // 默认启用（关键）
    PermissionRequest: true,    // 默认启用（关键）
  },
};
```

**App.tsx**:
- 在现有的 `listen<CliHookPayload>("claude-hook-notification", ...)` 监听处，新增系统通知发送逻辑
- 新增函数 `sendSystemNotification(payload, tabTitle)`:
  1. 检查 `settings.systemNotificationsEnabled` 和 `settings.systemNotificationEvents[payload.event]`
  2. 检查/请求权限（`isPermissionGranted` / `requestPermission`）
  3. 调用 `invoke('is_wsl')` 判断环境
  4. 若 WSL，调用 `invoke('send_notification_via_windows', { title, body })`
  5. 否则，调用 `sendNotification({ title, body })`（来自 `@tauri-apps/plugin-notification`）
- 通知内容：
  - 标题：`${getCliHookSourceName(payload)} - ${getEventTypeLabel(payload.event)}`
  - 正文：`${tabTitle}${payload.message ? ': ' + payload.message : ''}`

**HookSettingsPage.tsx**:
- 新增 UI 区域"系统通知"（在"应用内通知"之下）
- 全局开关 + 6 个事件类型的独立 Switch
- 说明文案：需要操作系统授权（首次发送通知时系统会弹授权）

### 4. 跨平台测试策略

| 平台 | 测试要点 |
|------|----------|
| **Windows** | 原生 Toast 通知、点击跳转、权限检查（系统设置 → 通知） |
| **macOS** | Notification Center、首次授权弹窗、点击跳转 |
| **Linux** | libnotify (D-Bus)、桌面环境兼容性（GNOME/KDE） |
| **WSL** | 检测逻辑、Windows 主机通知、`powershell.exe` 可用性 |

## Decisions

### 1. 默认启用策略 ✅

**决策**: 4 个关键事件默认启用，2 个噪音事件默认禁用

- ✅ `Stop` / `StopFailure` / `PermissionRequest` / `Notification` - 默认开启
- ❌ `SessionStart` / `UserPromptSubmit` - 默认关闭

**理由**: 用户在其他应用时最关心"任务完成/失败"和"需要处理"的通知，启动和提交是主动操作不需要被动通知。

### 2. 设置页面位置 ✅

**决策**: 在 `HookSettingsPage.tsx` 中新增"系统通知"区域（与"应用内通知"并列）

### 3. 项目名来源优先级 ✅

**决策**: 方案 A - `tabTitle` > `cwd` 最后一段目录名 > "未知项目"

**理由**: 与应用内通知保持一致，用户看到的名称统一；若 tab 标题被自定义则优先使用，否则回退到目录名。

### 4. WSL 通知方式 ✅

**决策**: 方案 A - PowerShell + WinRT Toast API（从 WSL 内调用 `powershell.exe`）

**理由**: 直接使用 Windows 原生 Toast API，无需用户安装额外依赖（如 wslu），也无需打包额外可执行文件。

### 5. 系统通知发送位置 + 点击跳转 ✅

**决策**: 方案 A - 前端发送通知，依赖系统自动前置窗口，无深度链接

**架构**:
- 系统通知从前端 `App.tsx` 的 hook 监听处发送（与应用内通知并列）
- 使用 `@tauri-apps/plugin-notification` 的 `sendNotification()` API
- 用户点击系统通知 → 操作系统自动前置 CLI-Manager 窗口
- 用户看到对应 tab 的状态小圆点（已有的 tab status indicator），手动点击进入

**理由**:
1. 桌面端系统通知的点击回调不可靠（Windows/macOS/Linux 差异大）
2. 前端已有完整 hook 事件处理逻辑，代码内聚性更好
3. 前端直接读取 `settingsStore`，无需跨 IPC 传递设置
4. 避免深度链接的 URI scheme 注册复杂度
5. 现有 tab 状态指示器已足够引导用户找到对应 tab

**WSL 特殊处理**: 前端优先使用 Tauri notification plugin；仅在该路径失败且 Rust `is_wsl()` 返回 true 时，才调用 `send_notification_via_windows(title, body)` 桥接到 Windows 主机。

### 6. 系统通知文案格式 ✅

**标题格式**: 固定为 `CLI-Manager`，让通知归属尽量显示为应用本身。

**正文格式**: `emoji + source + 项目名 + 事件语义 + 可选 message`

示例：
- `✅ Claude Code 在 CLI-Manager 的任务已完成`
- `⚠️ Codex CLI 在 CLI-Manager 执行失败，请查看详情：<message>`
- `🔔 Claude Code 需要你的关注哦~ 快来看看 CLI-Manager 吧!`

**事件正文映射**:
- `Stop` → `✅ {source} 在 {projectName} 的任务已完成`
- `StopFailure` → `⚠️ {source} 在 {projectName} 执行失败，请查看详情`
- `PermissionRequest` → `🔔 {source} 需要你的关注哦~ 快来看看 {projectName} 吧!`
- `Notification` → `🔔 {source} 在 {projectName} 有新的提醒`
- `SessionStart` → `🚀 {source} 在 {projectName} 的会话已启动`
- `UserPromptSubmit` → `💬 {source} 在 {projectName} 已提交新指令`

**Windows/WSL 来源名约束**: Windows 本机必须走 Tauri notification plugin，避免显示为 `Windows PowerShell`；仅真实 WSL/Linux 环境走 PowerShell 桥接，并在 Toast XML 中加入 `来自 CLI-Manager` attribution。

## 最终需求确认

### 核心功能
✅ **系统通知触发**: 所有 6 种 hook 事件都可配置是否发送系统通知  
✅ **默认启用**: Stop/StopFailure/PermissionRequest/Notification 默认开启  
✅ **通知内容**: `{source} - {事件类型}` + `{项目名}: {可选message}`  
✅ **用户控制**: 设置页面全局开关 + 按事件类型分别控制  
✅ **跨平台**: Windows/macOS/Linux 系统原生通知  
✅ **WSL 支持**: 通过 PowerShell + WinRT Toast API 桥接到 Windows 主机  
✅ **点击行为**: 依赖操作系统自动前置窗口 + 应用内 tab 状态指示器  

### 实现路径
✅ **前端发送**: `App.tsx` 的 hook 监听处调用 `@tauri-apps/plugin-notification`  
✅ **设置存储**: `settingsStore.ts` 扩展两个新字段  
✅ **UI 配置**: `HookSettingsPage.tsx` 新增"系统通知"区域  
✅ **WSL 检测**: 前端调用 Rust command 判断并桥接  

## Open Questions

（无待确认问题）

（无待确认问题）

## 实现计划

### Phase 1: 依赖集成与 WSL 检测（Rust 基础设施）

**目标**: 添加 `tauri-plugin-notification` 依赖，实现 WSL 检测和 Windows 通知桥接

**文件**:
- `src-tauri/Cargo.toml`: 添加 `tauri-plugin-notification = "2"`
- `src-tauri/src/lib.rs`: 
  - `.plugin(tauri_plugin_notification::init())`
  - 注册新 command: `is_wsl`, `send_notification_via_windows`
- `src-tauri/src/commands/system_notification.rs` (新增):
  - `is_wsl()`: 读取 `/proc/version` 检测 WSL
  - `send_notification_via_windows(title: String, body: String)`: PowerShell + WinRT Toast API
- `src-tauri/capabilities/default.json`: 添加 `"notification:default"` permission

**验收**:
- [ ] `cargo check` 通过
- [ ] WSL 环境下 `is_wsl()` 返回 `true`
- [ ] WSL 环境下手动调用 `send_notification_via_windows()` 能在 Windows 看到 Toast

### Phase 2: 前端设置扩展

**目标**: 扩展 `settingsStore` 和 `HookSettingsPage` UI

**文件**:
- `src/stores/settingsStore.ts`:
  - 添加 `systemNotificationsEnabled: boolean`
  - 添加 `systemNotificationEvents: Record<HookEventType, boolean>`
  - 更新 `DEFAULTS`
- `src/components/settings/pages/HookSettingsPage.tsx`:
  - 新增"系统通知"区域（在"应用内通知"下方）
  - 全局开关 Switch
  - 6 个事件类型的独立 Switch（带说明文案）
  - 权限提示文案："首次发送通知时，操作系统会弹出授权请求"

**验收**:
- [ ] `tsc --noEmit` 通过
- [ ] 设置页面能切换系统通知开关
- [ ] 设置持久化到 `tauri-plugin-store`

### Phase 3: 前端通知发送逻辑

**目标**: 在 `App.tsx` 的 hook 监听处集成系统通知发送

**文件**:
- `src/App.tsx`:
  - 导入 `@tauri-apps/plugin-notification` 的 `sendNotification`, `isPermissionGranted`, `requestPermission`
  - 导入 `invoke` 用于调用 `is_wsl` 和 `send_notification_via_windows`
  - 新增函数 `sendSystemNotification(payload, tabTitle)`:
    1. 检查全局开关和事件类型开关
    2. 检查权限（首次请求）
    3. 构造标题和正文
    4. 检测 WSL：若是则调用 `send_notification_via_windows`，否则调用 `sendNotification`
  - 在 `listen<CliHookPayload>("claude-hook-notification", ...)` 内调用 `sendSystemNotification`
- `src/lib/notification.ts` (可选，独立模块):
  - 抽取 `sendSystemNotification` 逻辑到独立文件，保持 `App.tsx` 简洁

**验收**:
- [ ] `tsc --noEmit` 通过
- [ ] 触发 hook 事件时，系统能弹出原生通知
- [ ] 通知内容符合文案格式
- [ ] 点击通知后窗口前置

### Phase 4: 跨平台测试

**目标**: 在四个平台验证功能

**测试矩阵**:

| 平台 | 通知显示 | 权限请求 | 点击前置窗口 | 文案正确 |
|------|---------|---------|------------|---------|
| Windows | ☐ | ☐ | ☐ | ☐ |
| macOS | ☐ | ☐ | ☐ | ☐ |
| Linux (GNOME) | ☐ | ☐ | ☐ | ☐ |
| WSL | ☐ | N/A | ☐ | ☐ |

**验收**:
- [ ] 所有平台系统通知正常显示
- [ ] macOS 首次发送时弹授权，授权后正常工作
- [ ] WSL 通过 Windows 主机发送 Toast
- [ ] 点击通知后应用窗口前置
- [ ] 应用内 tab 状态指示器配合良好

### Phase 5: 文档与收尾

**目标**: 更新文档，清理代码

**文件**:
- `CLAUDE.md`: 更新"架构要点"章节，说明系统通知机制
- `.trellis/tasks/06-22-hook-win-wsl-mac-linux/implementation-notes.md`: 记录实现细节、跨平台差异、已知问题

**验收**:
- [ ] `cargo check` 和 `tsc --noEmit` 通过
- [ ] 无 ESLint warnings（如有）
- [ ] 测试覆盖核心路径（WSL 检测、权限请求、通知发送）

## Out of Scope

- **通知历史记录**: 不在应用内维护系统通知的历史日志（依赖操作系统通知中心）
- **通知分组**: 不做通知分组优化（操作系统可能自动分组）
- **自定义通知音**: 使用系统默认通知音，不自定义音效
- **通知优先级**: 所有通知统一优先级，不按事件类型区分紧急度
- **Rich notification**: 不使用 action buttons（仅支持点击跳转）

## Technical Notes

### 文件清单（待修改/新增）

**Rust**:
- `src-tauri/Cargo.toml` (加依赖)
- `src-tauri/src/lib.rs` (注册插件 + 新增 command `get_system_notification_settings`)
- `src-tauri/src/claude_hook.rs` (系统通知发送逻辑)
- `src-tauri/src/commands/` (可能新增 `system_notification.rs` 独立模块)

**前端**:
- `src/stores/settingsStore.ts` (扩展设置项)
- `src/components/settings/pages/HookSettingsPage.tsx` (UI)
- `src/App.tsx` (监听 `notification-action` 事件)

### 相关文档

- Tauri Notification Plugin: https://v2.tauri.app/plugin/notification/
- WSL 检测: https://github.com/microsoft/WSL/issues/4555
- Windows Toast 通知: `BurntToast` PowerShell 模块（或原生 WinRT API）

### 风险与缓解

| 风险 | 缓解 |
|------|------|
| WSL 环境下 `powershell.exe` 不可用 | 检测失败时静默跳过系统通知，保持应用内通知 |
| 用户未授权系统通知 | 首次发送时捕获错误，提示用户去系统设置授权 |
| macOS 沙箱限制 | Tauri 2 默认配置应支持，测试时验证 `Info.plist` 权限 |
| 通知发送异步失败 | 不阻塞 hook 事件处理，记录 warn 日志 |
