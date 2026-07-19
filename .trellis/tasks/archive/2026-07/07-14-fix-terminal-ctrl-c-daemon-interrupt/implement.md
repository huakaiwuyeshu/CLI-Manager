# Implementation Plan

1. 修改 Windows daemon creation flags 并补单元测试。
2. 精确撤回本任务在 `XTermTerminal` 的无效 Ctrl+C workaround，不触碰同文件其他并行改动。
3. 修正 `[TEMP]` Changelog 描述。
4. 运行前端类型检查、Rust 定向测试与 `cargo check`。
5. 运行 GitNexus detect changes，确认影响仅限 daemon 启动与终端输入相关符号。
