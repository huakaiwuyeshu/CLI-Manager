# Technical Design

## Architecture

- Rust `statusline` 模块是配置校验和渲染的唯一权威实现。
- `cli-manager __statusline` 在 Tauri 初始化前执行，读取 stdin、加载配置、渲染并退出。
- Tauri commands 复用同一模块完成状态检测、配置读写、旧配置导入、预览、安装和卸载。
- React 设置页只维护编辑状态和交互，不复制组件渲染算法。

## Storage and Compatibility

- 内置配置路径：CLI-Manager 数据目录下 `statusline/settings.json`。
- schema 保持 ccstatusline v3 字段语义，并增加迁移来源元数据。
- 首次导入旧配置时先校验和迁移，再原子写入新路径；旧文件保持不变。
- Claude `settings.json` 修改采用读取、根对象校验、备份、临时文件替换。

## Runtime

- payload、配置、Widget、Powerline 和渲染上下文使用 serde 类型建模。
- Git/Jujutsu、JSONL、用量、缓存、自定义命令等能力按原行为移植；外部命令必须有超时并隐藏 Windows 窗口。
- 预览使用固定模拟 payload，通过 Tauri command 调用同一 renderer。

## UI

- 设置页新增独立 Statusline tab。
- 左侧组件库支持分类与搜索；中间为最多三行的拖拽布局；右侧为组件和全局属性编辑。
- 页面包含 ANSI/Powerline 实时预览、安装状态、导入旧配置和安装/卸载操作。
- 键盘操作、aria 标签、空状态和提示全部国际化。

## Licensing

- 移植代码保留原版权头；新增第三方许可证/NOTICE 记录 ccstatusline-zh 及其上游 ccstatusline。
