# Tauri 2 Notification Plugin 调研

## 1. 基本用法

### 安装与配置

```bash
cargo tauri add notification
```

```rust
// src-tauri/src/lib.rs
tauri::Builder::default()
    .plugin(tauri_plugin_notification::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
```

### Rust 后端发送通知

```rust
use tauri::Emitter;

app_handle.notification()
    .builder()
    .title("标题")
    .body("正文内容")
    .show()?;
```

### 前端 JavaScript 发送通知

```typescript
import { sendNotification } from '@tauri-apps/plugin-notification';

await sendNotification({
  title: '标题',
  body: '正文内容',
});
```

## 2. 点击回调机制（关键发现）

### 桌面端限制

根据 Tauri 2 的设计，**桌面端（Windows/macOS/Linux）的系统通知点击事件没有直接的回调机制**。原因：

1. **Windows**: Toast Notification API 支持 action buttons，但点击主通知本身不会触发回调到应用
2. **macOS**: NSUserNotificationCenter 的点击事件需要应用是 Notification Center 的委托，且应用需要在前台
3. **Linux**: libnotify (D-Bus) 的点击事件支持不一致，取决于桌面环境

### 移动端支持

Android/iOS 有完整的 action/click 回调支持，但本项目不涉及。

### 替代方案：深度链接（Deep Link）

Tauri 的推荐方式是通过 **自定义 URI scheme** 实现通知点击后的应用唤醒：

```rust
app_handle.notification()
    .builder()
    .title("任务完成")
    .body("点击查看详情")
    // Windows/macOS 部分支持（需要注册 URI scheme）
    .action("cli-manager://open?tabId=abc123")
    .show()?;
```

然后应用注册监听 `deep-link` 事件：

```rust
use tauri_plugin_deep_link;

tauri::Builder::default()
    .plugin(tauri_plugin_deep_link::init())
    .setup(|app| {
        app.listen_any("deep-link://request", |event| {
            // 解析 URL，提取 tabId
        });
        Ok(())
    })
```

**问题**：需要用户首次安装时注册 URI scheme，且 Windows 需要写注册表，体验不够透明。

### 实用方案：窗口前置 + 应用内状态

由于桌面端系统通知的点击回调不可靠，更实用的做法是：

1. **系统通知仅用于提示**（标题 + 正文）
2. **用户点击系统通知 → 操作系统前置应用窗口**（系统默认行为，无需代码）
3. **应用内已有的 tab 状态指示器**（小圆点、颜色）引导用户点击对应 tab

这样避免了复杂的深度链接，用户体验也合理：
- 看到系统通知 → 点击 → 应用窗口出现 → 看到对应 tab 有状态标记 → 点击进入

## 3. 权限配置

### Capability 权限

需要在 `src-tauri/capabilities/default.json` 添加：

```json
{
  "permissions": [
    "notification:default"
  ]
}
```

或更细粒度：

```json
{
  "permissions": [
    "notification:allow-is-permission-granted",
    "notification:allow-request-permission",
    "notification:allow-notify"
  ]
}
```

### 各平台权限行为

| 平台 | 权限请求 | 说明 |
|------|---------|------|
| **Windows** | 无需运行时请求 | 用户在系统设置 → 通知 → 应用列表中控制 |
| **macOS** | 首次发送时弹授权 | 需要在 `Info.plist` 添加 `NSUserNotificationsUsageDescription` |
| **Linux** | 无需运行时请求 | 依赖 libnotify，桌面环境（GNOME/KDE）控制 |

### macOS Info.plist 配置

```xml
<key>NSUserNotificationsUsageDescription</key>
<string>CLI-Manager 需要发送通知以提醒您 Claude Code 和 Codex CLI 的任务状态</string>
```

## 4. 前端发送 vs 后端发送的取舍

### 当前项目架构

```
Rust (claude_hook.rs) 接收 hook
    ↓ emit("claude-hook-notification", payload)
前端 (App.tsx) 监听事件
    ↓ showClaudeHookToast() 弹应用内通知
```

### 方案 A：前端发送系统通知（推荐）

**优点**：
- 前端已有完整的 hook payload（包括 tabTitle）
- 应用内通知和系统通知逻辑在同一处，易于维护
- 前端可直接读取 `settingsStore` 的系统通知开关，无需 Rust ↔ 前端传递设置
- TypeScript 类型安全

**缺点**：
- 需要前端调用 Tauri 的 notification API（轻微异步开销）

**实现**：

```typescript
// App.tsx
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';

async function sendSystemNotification(payload: CliHookPayload, tabTitle: string) {
  const settings = useSettingsStore.getState();
  
  // 检查全局开关
  if (!settings.systemNotificationsEnabled) return;
  
  // 检查事件类型开关
  if (!settings.systemNotificationEvents[payload.event]) return;
  
  // 检查权限
  let permissionGranted = await isPermissionGranted();
  if (!permissionGranted) {
    const permission = await requestPermission();
    permissionGranted = permission === 'granted';
  }
  if (!permissionGranted) {
    console.warn('系统通知权限未授予');
    return;
  }
  
  // 发送通知
  const title = `${getCliHookSourceName(payload)} - ${getEventTypeLabel(payload.event)}`;
  const body = `${tabTitle}${payload.message ? ': ' + payload.message : ''}`;
  
  await sendNotification({ title, body });
}

// 在现有的 hook 监听处调用
listen<CliHookPayload>("claude-hook-notification", (event) => {
  const payload = event.payload;
  const tabId = payload.tabId;
  
  // 现有逻辑
  terminalStore.updateTabHookStatus(...);
  showClaudeHookToast(payload, tabId);
  
  // 新增：发送系统通知
  const tabTitle = terminalStore.sessions.find(s => s.id === tabId)?.title ?? 'CLI-Manager';
  void sendSystemNotification(payload, tabTitle);
});
```

### 方案 B：后端发送系统通知

**优点**：
- 通知发送更底层，理论上延迟更低
- Rust 侧统一处理所有平台差异（WSL 检测等）

**缺点**：
- 需要从前端传递设置到 Rust（通过新增 command `get_system_notification_settings`）
- 需要从 Rust 传递完整的 tabTitle 到通知（或在 Rust 侧从 `cwd` 提取项目名）
- 点击回调更复杂（需要 Rust emit 事件到前端）
- 代码分散在前后端两处

**实现**：

```rust
// claude_hook.rs
fn handle_stream(...) {
    // 现有逻辑
    app_handle.emit(EVENT_NAME, payload.clone())?;
    
    // 新增：发送系统通知
    let settings = get_system_notification_settings(&app_handle).await?;
    if settings.enabled && settings.events.get(&payload.event).unwrap_or(&false) {
        send_system_notification(&app_handle, &payload)?;
    }
}
```

### 推荐结论

**方案 A（前端发送）更适合本项目**，原因：

1. **点击跳转不可靠**：既然桌面端系统通知的点击回调本身就不可靠，前端发送和后端发送在这一点上没有差异
2. **代码内聚性**：前端已有完整的 hook 事件处理逻辑，在同一处加系统通知更清晰
3. **设置访问**：前端直接读取 `settingsStore`，无需跨 IPC 传递
4. **维护性**：应用内通知和系统通知的事件筛选逻辑可以共享

## 5. 窗口前置

当用户点击系统通知后，操作系统会**自动前置应用窗口**（Windows/macOS/Linux 默认行为）。

如果需要编程式前置（如深度链接回调），使用：

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window';

const window = getCurrentWindow();
await window.show();      // 显示窗口（若最小化）
await window.unminimize(); // 取消最小化
await window.setFocus();   // 获取焦点
```

但对于系统通知的点击，**不需要手动代码**，操作系统会自动处理。

## 6. 实现建议

### 最简可行方案（MVP）

1. **前端发送系统通知**（`App.tsx` 的 hook 监听处）
2. **不实现点击跳转**（依赖操作系统自动前置窗口 + 应用内 tab 状态指示器）
3. **设置页面**：全局开关 + 按事件类型开关
4. **WSL 检测**：从前端调用 Rust command `is_wsl()` 判断，若是 WSL 则调用 Rust command `send_notification_via_windows(title, body)`

### 进阶方案（可选）

如果未来需要点击跳转，考虑：
- 使用 `tauri-plugin-deep-link` + 自定义 URI scheme
- 或在通知正文中引导用户："查看 [项目名] 标签"

## 参考资料

- Tauri Notification Plugin 官方文档: https://v2.tauri.app/plugin/notification/
- Tauri Deep Link Plugin: https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/deep-link
- 搜索结果: [Notifications | Tauri](https://tauri.app/plugin/notification/)
