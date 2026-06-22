# 修复实时统计多窗口数据隔离

## 问题描述

同一项目下开启两个 Claude Code/Codex 窗口（终端 A 和 B），实时统计面板会出现数据串显：
- A 窗口执行任务后，实时统计显示 A 的数据
- B 窗口执行任务后，A 和 B 的实时统计都变成 B 的数据
- 窗口之间的数据没有隔离

## 根因分析

1. 两个终端窗口有不同的 `tabId`（终端会话 ID）
2. 但它们操作同一个 Claude 项目目录，共享同一个 `cliSessionId`（CLI 会话 ID）
3. `TerminalStatsPanel` 按 `cliSessionId` 查询历史会话，导致查到最近更新的那个会话
4. Hook 事件到达时，两个窗口都会更新自己的 `cliSessionId`，但实际上指向同一个 CLI 会话

关键代码：
- `TerminalStatsPanel.tsx:232` - 按 `cliSessionId` 查询
- `historyStore.ts:525-531` - 按 `cliSessionId` 匹配会话
- `terminalStore.ts:515-523` - Hook 事件更新 `cliSessionId`

## 解决方案

### 核心思路

**按终端窗口的 `tabId` 隔离数据**，而不是按 `cliSessionId` 共享数据。

建立 `tabId` → `cliSessionId` 的严格映射：
1. 在前端内存中维护 `tabId` → 最近匹配的 `cliSessionId` 映射
2. 查询历史会话时，同时传入 `tabId` 和 `cliSessionId`
3. 只有当 `cliSessionId` 仍与该 `tabId` 绑定时，才展示对应的会话数据
4. 如果另一个窗口的 Hook 事件更新了同一个 `cliSessionId`，当前窗口应该忽略它

### 实现要点

#### 1. 修改 `TerminalStatsPanel.tsx`

- 传入 `tabId`（即 `activeSessionId`）给查询函数
- 在组件内维护 `tabId` → `cliSessionId` 的映射
- 切换 Tab 时清空旧数据，避免短暂展示错误数据

#### 2. 修改 `historyStore.ts`

`fetchLatestProjectSessionDetail` 函数：
- 新增 `tabId` 参数
- 内部维护静态映射 `Map<tabId, cliSessionId>`
- 查询逻辑：
  - 如果传入了 `cliSessionId`，检查它是否与 `tabId` 的映射一致
  - 如果一致，按 `cliSessionId` 查询
  - 如果不一致或未建立映射，建立/更新映射并查询
  - 返回结果时验证 `cliSessionId` 仍与 `tabId` 绑定

#### 3. 边界情况处理

- **同一 `cliSessionId` 被多个 `tabId` 使用**：最后绑定的 `tabId` 生效，其他 `tabId` 的映射失效
- **`tabId` 切换项目**：清空旧映射，建立新映射
- **`tabId` 关闭**：清理映射（可选，避免内存泄漏）
- **轮询时 `cliSessionId` 变化**：更新映射并重新查询

## 预期效果

1. A 窗口和 B 窗口的实时统计完全隔离
2. A 执行任务时，B 的统计不受影响
3. B 执行任务时，A 的统计不受影响
4. 切换 Tab 时立即清空旧数据，避免短暂串显

## 测试场景

1. **基本隔离**：同一项目下开两个 Claude Code 窗口，交替执行任务，验证统计不互相干扰
2. **快速切换**：同一窗口内快速切换 Tab，验证不会短暂展示其他 Tab 的数据
3. **项目切换**：同一 Tab 先在项目 A 执行任务，再切换到项目 B，验证统计正确切换
4. **窗口关闭**：关闭某个窗口，验证不影响其他窗口的统计
5. **无 Hook 环境**：未安装 Hook 的终端，验证回退到项目最近会话的逻辑仍然正常

## 影响范围

- **低风险**：仅修改实时统计面板的查询逻辑，不影响历史会话列表、分析看板等其他功能
- **向后兼容**：新增参数为可选，不影响其他调用方

## 非目标

- 不修改 Hook 事件上报逻辑
- 不修改 `cliSessionId` 的存储逻辑
- 不修改历史会话的查询和解析逻辑（除了隔离过滤）
