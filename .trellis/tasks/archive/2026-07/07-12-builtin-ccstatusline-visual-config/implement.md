# Implementation Plan

1. 建立 Rust statusline 配置模型、文件存储、旧配置导入和 Claude 安装边界。
2. 增加 `__statusline` 子命令与 Tauri commands，完成基础渲染、ANSI、布局和 Powerline。
3. 按上游注册表完整迁移全部 Widget、共享工具、Git/Jujutsu、JSONL、用量与 Hook 行为。
4. 建立前端类型、状态栏设置页、组件库、拖拽编辑器、属性面板和后端实时预览。
5. 补齐安装状态、迁移提示、跨平台路径、国际化、许可证、CHANGELOG 和功能清单。
6. 运行组件对照测试、迁移/安装安全测试、TypeScript 检查、Rust 检查和测试。
