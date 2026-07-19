# Implementation Plan

1. 新增 Rust 多配置模型、`profiles.json` 存储、版本校验、revision 和原子写入测试。
2. 抽取 Claude/Codex “读取实际配置”和“应用实际配置”内部函数，复用现有保存与备份逻辑。
3. 实现首次采纳、配置 CRUD、切换事务、active 删除保护和外部漂移检测。
4. 实现整库导出、两阶段导入、逐项冲突决策和 revision 并发保护。
5. 增加前端强类型、Claude/Codex 独立配置栏、未保存切换确认和外部配置提示。
6. 增加公共导入/导出 UI、冲突处理弹窗及中英文文案。
7. 补齐 Rust 单元测试、TypeScript 检查、CHANGELOG、功能清单和状态栏契约文档。
