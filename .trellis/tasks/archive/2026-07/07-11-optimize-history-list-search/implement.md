# Implementation Plan

1. 修复 GitNexus 索引并对后端/前端目标符号执行 upstream impact 分析。
2. 增加独立 SQLite catalog 模块、schema、状态和增量同步。
3. 将列表与搜索命令切换到 catalog，保留旧签名和精确查询行为。
4. 增加索引状态命令与事件，接入前端状态、搜索请求时序和刷新流程。
5. 增加三字符提示、索引进度和中英文文案。
6. 补充 Rust 测试、CHANGELOG 和功能清单。
7. 执行 Rust 测试、cargo check、TypeScript 类型检查和 GitNexus 变更检测。
