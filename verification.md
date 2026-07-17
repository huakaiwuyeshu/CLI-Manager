# cc-connect 首版验证

日期：2026-07-15

## 通过

- `cc-connect.exe --version`：v1.4.1，commit `5d4c96dd`。
- 本机 EXE SHA-256：`D3F7B0C673A4D5539A461639C98ECA054D18B1FA38FC1AFC6422A7BBF3A2B18D`，与上游 v1.4.1 `checksums.txt` 的 Windows amd64 值一致。
- 用包含 Agent 空密钥覆盖、完整命令限制和 Telegram 平台配置的临时 TOML 执行 `cc-connect config format --config ...` 成功；临时文件已删除。
- `tsc --noEmit` 全量通过。
- `npm run build` 通过：Vite 完成 6595 个模块转换并生成生产包；仅有既有的动态/静态混合导入和大 chunk 警告。
- 为恢复原有终端路径调用链，补回了上游 master 已存在的 `src/lib/terminalOscPath.ts`。
- Rust stable 已安装到 `F:\rust`：`cargo 1.97.0`、`rustc 1.97.0`、`rustfmt 1.9.0`、`clippy 0.1.97`。
- 新增 Rust 文件已执行 rustfmt，针对 `cc_connect.rs` 与 `credential_store.rs` 的格式检查通过。
- `cargo check` 已通过。
- `cargo test cc_connect::tests --lib` 已通过：5 项通过、0 项失败，覆盖版本/哈希、白名单、安全配置、日志脱敏，以及 Windows 普通路径、`\\?\` 扩展路径和 UNC 路径。
- 真实 Telegram 链路已验证：代理连接、Bot 鉴权、用户白名单、消息接收及 Codex 回复链路均已跑通。
- 修复 Windows 扩展路径泄漏：Agent `work_dir` 从 `//?/F:/...` 规范化为 `F:/...`，界面中的 cc-connect 可执行文件路径不再展示 `\\?\` 前缀。
- `git diff --check` 通过，仅输出工作区既有的 LF/CRLF 转换提示。
- 两轮后端并发/Windows API/安全审查及一轮前端审查完成，发现的高风险二进制信任、命令绕过、凭证继承和操作竞态已做本地缓解。

## 未完成或未执行

- 飞书真实账号链路尚未验证。
- 尚未启动 Tauri 窗口手动切换中英文；新增中英文键已由全量 TypeScript 检查与生产构建覆盖。
- Windows 路径修复后的安装包尚未重新生成，等待用户明确提出“打包”后执行。

## 代理与日志开关增量验证（2026-07-16）

- cargo test cc_connect::tests --lib 通过：12 项通过、0 项失败。
- 新增覆盖：旧配置缺少开关字段、代理关闭时忽略手动地址和本地端口、清理继承代理环境、关闭时暂不校验保留的代理地址。
- cargo check 通过。
- npm run build 通过；仅有既有的动态/静态混合导入和大 chunk 警告。
- git diff --check 通过，仅有工作区既有的 LF/CRLF 转换提示。
- 尚未启动 Tauri 窗口手动检查开关交互与中英文切换；本次未打包。

## 远程项目切换增量验证（2026-07-16）

- 新增 /cli_manager_list（兼容连字符写法），输出托管配置生成时 CLI-Manager 已登记的项目、路径、当前项目及不可用路径状态。
- 修复 Telegram 菜单展开全部项目的问题：托管配置只注册一个 `/cli_manager_switch <序号>` 命令，不再为每个项目生成 `cli-manager-switch-N` 命令或 alias。
- 单一切换命令调用 CLI-Manager 生成的参数校验脚本；脚本按与项目列表相同的快照将序号映射为项目 ID 摘要令牌，再请求已运行的 CLI-Manager 更新 profile/config 并延迟重启受管 cc-connect。
- 切换请求使用独立请求 ID 返回结果，避免并发切换复用同一结果文件；脚本严格拒绝缺参、零、负数、非数字、额外参数、越界序号及 PowerShell 注入形式。
- 切换参数不接受任意路径；/dir、/shell、/commands 等高风险命令仍保持禁用。
- 未修改 cc-connect 源码、全局 npm 包或可执行文件，仅使用其 v1.4.1 原生自定义命令参数能力。
- cargo test cc_connect::tests --lib 通过：17 项通过、0 项失败；包含真实 cc-connect v1.4.1 配置格式验证、Windows PowerShell UTF-8 清单输出、参数边界及 here-string + Base64 参数隔离验证。
- cargo check 通过。
- npm run build 通过；仅有既有的动态/静态混合导入和大 chunk 警告。
- 未执行真实 Telegram/飞书消息下的单实例回调与受管进程重启冒烟；需使用新构建安装包验证。

## 远程项目目录与 Provider 标识增量验证（2026-07-16）

- `/cli_manager_list` 按 CLI-Manager `groups.parent_id` 目录树输出项目，保留多级目录；没有有效目录的项目统一进入“未分组 / Ungrouped”。
- 每个项目固定显示 Agent 和 Provider：项目级 `provider_overrides` 优先；未覆盖时读取 cc-switch 当前 Claude/Codex 全局 Provider；cc-switch 不可用时安全回退为“跟随全局”。
- 同名项目可通过目录、Agent、Provider 和路径区分；当前项目标题也同步包含 Agent 与 Provider，不再只显示名称。
- 项目序号和切换脚本使用同一份树形排序快照，保证 `/cli_manager_switch <序号>` 与列表展示严格一致；项目 ID 摘要令牌算法未变。
- 新增中文/英文、嵌套目录、未分组、孤立目录、重复名称、项目级 Provider、全局 Provider 与 Provider 名称回退测试。
- `cargo test cc_connect::tests --lib` 通过：20 项通过、0 项失败。
- `cargo check` 通过。
- `npm run build` 通过；仅有既有的动态/静态混合导入和大 chunk 警告。
- 本次未修改 cc-connect 源码、全局 npm 包或可执行文件，且未打包安装包。

## 桌面宠物首版验证（2026-07-16）

- 已从最新主分支创建并在 feat/Desktop-pets 开发，功能提交为 feat: add downloadable desktop pets。
- 新增独立透明桌宠窗口、设置入口、双击会话跳转、后台 daemon 状态聚合、位置恢复、置顶、尺寸、状态气泡、全屏隐藏和位置锁定。
- 新增公开宠物中心、远端/缓存/随包三级目录降级、下载与 SHA-256 校验、更新、切换、卸载和本地 .clipet 导入。
- 三只首版宠物包及预览已随应用提供；Rust 测试校验目录哈希与实际内嵌包完全一致。
- 宠物包限制为 manifest.json、PNG、WebP 和安全 SVG；路径穿越、符号链接、HTML、JavaScript、可执行文件、危险 SVG、超大压缩包和解压膨胀均会被拒绝。
- 已安装宠物固定保存到 ~/.cli-manager/pets，不使用版本化 Tauri 数据目录，覆盖安装或重新安装应用不会主动清理。
- npx tsc --noEmit：通过。
- npm run build：通过，Vite 完成 6617 个模块转换；仅保留既有的大 chunk 警告。
- cargo check：通过。
- cargo test desktop_pet --lib：5 项通过、0 项失败。
- rustfmt --check src/commands/desktop_pet.rs --edition 2021：通过。
- 全量 cargo fmt --check 被本次拉取的上游文件 git_worktree.rs、daemon/server.rs、lib.rs 既有格式差异阻断；未为了本功能改写这些无关上游文件。
- 已拉取并合并 origin/master 的 2402c72，同时保留上游 cc-connect 设置与本次桌宠设置入口。
- 尚未启动 Tauri 窗口手动检查透明背景、拖动位置和中英文切换；本次未打包安装包。

## 桌面宠物启动修复验证（2026-07-17）

### 根因与修复范围

- 主程序启动失败位于 React StrictMode 生命周期与 Tauri Store 插件边界：不可取消的初始化会在 StrictMode 探测阶段重复启动，多个 Store 又并发读取，导致真实用户数据下启动 I/O 竞争并卡在初始化页。
- 设置、会话和同步 Store 的 load() 已增加 single-flight 合并；基础启动改为设置、会话、同步、项目串行完成后再开放首屏、请求日志同步、桌宠协调器和延迟任务。
- 桌宠透明空窗位于运行时 WebView 创建与前端入口路由边界，不是宠物 CSS 或素材问题；改为由 Tauri 配置预创建隐藏的 desktop-pet WebView，并使用原生窗口 label 选择桌宠入口。
- 桌宠位置只在用户开始拖拽后持久化；程序自动放置到右下角不会把默认位置误写成固定坐标。

### 验证结果

- npm run build：通过，Vite 完成 6618 个模块转换；仅有既有的大 chunk 警告。
- cargo check：通过。
- cargo test desktop_pet：5 项通过、0 项失败。
- npm run tauri build -- --no-bundle：通过，生成 src-tauri/target/release/cli-manager.exe。
- 使用真实数据目录冷启动最终 release：设置阶段 18.3 ms、Store 阶段 371.4 ms、项目阶段 18.8 ms，均未超时；首屏约 495.4 ms。
- 最终 release 同时存在可响应的主窗口和 190x210 透明桌宠窗口；使用 Windows PrintWindow 抓取窗口本体，确认状态气泡与宠物像素均已绘制。
- 旧动态窗口对照测试在 PrintWindow 中为全透明，静态窗口方案在相同方式下正常渲染。
- 自动放置后 desktopPet.position 保持 null；测试结束后用户设置已恢复到测试前 SHA-256 F18933890B0FA134857E70637D5538F5F219C817DA29F157765276B0FF047112。
- git diff --check：通过，仅输出工作区既有的 LF/CRLF 转换提示。
- 已刷新 codebase-memory 索引并执行变更影响检测；变更限定在启动编排、三个 Store 加载、桌宠协调/入口/窗口配置和本验证记录。

## Codex Pets 兼容验证（2026-07-17）

- 保留 `.clipet` 导入、在线目录、更新和卸载链路，同时新增 `pet.json + spritesheet.webp` 的 Codex Pets ZIP 解析。
- V1：支持省略 `spriteVersionNumber` 的 1536×1872、9 行精灵图。
- V2：支持 `spriteVersionNumber: 2` 的 1536×2288、11 行精灵图；已核对用户提供的 `shinobu-q.codex-pet.zip` 为 VP8L V2 文件头。
- 启动设置页与“重新扫描”都会读取宿主机 `~/.codex/pets`；外部宠物标为只读，不允许 CLI-Manager 删除。
- 手动导入的 `.codex-pet.zip` 安装到 `~/.cli-manager/pets/installed`，同 ID 同时存在时自管副本优先，卸载后可回退到外部副本。
- ZIP 安全边界继续覆盖路径穿越、符号链接、未知文件、条目/压缩包/解压体积上限；Codex WebP 另外校验 20 MiB 上限和 V1/V2 精确尺寸。
- `cargo test desktop_pet --lib`：9 项通过、0 项失败。
- `.\\node_modules\\.bin\\tsc.cmd --noEmit`：通过。
- `npm run build`：通过，Vite 完成 6620 个模块转换；仅有既有的大 chunk 警告。
- `npm run lint`：项目未定义 lint script，无法执行。
- 本次未生成安装包；等待用户明确要求打包后再执行。

## 桌宠状态与多任务菜单修复验证（2026-07-17）

### 根因与触点

- 根因位于桌宠状态聚合边界：daemon 已保存打开会话的最新 Hook 任务状态，但 deriveDesktopPetSnapshot 对所有已打开会话直接跳过 daemon 数据，只读取前端瞬时状态；前端状态缺失时因此错误显示“空闲”。
- 右键菜单的数据契约只携带单个优先目标，且菜单固定在 190×210 窗口底部，无法表达多个会话，扩展后也会被透明窗口边界裁切。
- 已修改：src/lib/desktopPet.ts（状态合并、完整目标列表）、src/hooks/useDesktopPetCoordinator.ts（中英文菜单标签）、src/desktop-pet/DesktopPetApp.tsx（目标选择与事件发送）、src/desktop-pet/desktopPet.css（全窗口菜单、滚动与省略）、src/lib/i18n.ts（中英文文案）。
- 已确认复用且未修改：App.tsx 的 handleActivateHookNotificationTarget，继续负责关闭历史视图、切换项目/Worktree scope、激活对应 Workspan/分屏会话并恢复/聚焦主窗口。
- 已确认无须修改：terminalStore Hook/Shell 状态机、Rust daemon Hook 状态生产、PTY 生命周期和桌宠原生窗口尺寸；本次只修复桌宠消费与展示层的丢失契约。

### 验证结果

- 纯逻辑场景验证通过：打开会话的前端状态缺失时采用较新的 daemon running；较新的前端 done 不被旧 daemon 状态覆盖；daemon-only 会话仍进入目标列表；多目标按既有优先级选择主状态。
- .\node_modules\.bin\tsc.cmd --noEmit：通过。
- npm run build：通过，Vite 完成 6620 个模块转换；仅有既有的大 chunk 警告。
- 190×210 固定窗口样式验证：8 个任务时菜单完整落在窗口内，任务区出现纵向滚动，项目名、会话名、状态和“当前”标记可见，底部三个操作按钮不被裁切。
- 本次未打包；尚需在真实 Tauri 窗口手动覆盖同 Workspan、跨 Workspan、分屏深层会话、主窗口最小化/托盘及中英文切换。
