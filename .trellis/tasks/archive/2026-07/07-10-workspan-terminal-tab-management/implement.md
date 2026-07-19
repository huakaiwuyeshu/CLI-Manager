# Workspan 实施步骤

1. 收敛 `TerminalWorkspan` 纯函数：创建、查找、四向合并、删除、过滤、恢复 ID 映射。
2. 扩展 `sessionStore` 持久化并迁移 Workspan 数据。
3. 扩展 `terminalStore` 的活动镜像、前台布局动作、后台派生视图和启动恢复流程。
4. 在 `TerminalTabs` 增加顶层 Workspan 标签栏、排序、四向合并预览和无头 Pane 规则。
5. 补齐中英文文案和必要样式。
6. 新增 Workspan 纯函数测试，更新 `[TEMP]` Changelog 与功能清单。
7. 运行相关 Node 测试、`npx tsc --noEmit` 和 GitNexus/Serena 变更范围检查。
