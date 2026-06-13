# 历史会话统计侧栏

## 目标

在历史会话详情区域右侧添加**可折叠的统计侧栏**，展示当前选中历史会话的：
- 文件夹/项目路径、Git 分支
- Token 用量（输入/输出/缓存/总计）、费用估算
- 模型信息
- 今日该项目的总用量
- 图形化进度条和美观卡片

## 数据来源（已确认）

**展示对象**：当前选中的历史会话（`HistorySessionDetail`）
**数据来源**：SQLite 历史日志已解析好的数据，纯静态展示，无需实时轮询
**缺失字段处理**：优雅降级显示 `—` 或隐藏对应区块

## 需求拆解

### R1：UI 布局改造

**现状**：`SessionDetailPane` 占据历史面板右侧全部空间
**目标**：右侧分裂为"会话详情区 + 统计侧栏"，布局类似：

```
[历史列表 | 会话详情 | [折叠按钮] 统计侧栏]
```

**交互**：
- 默认**折叠**（侧栏宽度 0，仅显示展开按钮）
- 点击按钮后展开，侧栏宽度固定 `280px`（参考设计图比例）
- 展开后按钮变为"收起"图标
- 侧栏宽度不可拖拽调整（固定宽度，避免复杂度）

**按钮位置**：
- 在会话详情区顶部工具栏右侧，与现有的"复制ID"、"Diff"、"Prompt"等按钮对齐
- 或者独立悬浮在会话详情区右上角

### R2：统计侧栏内容

从上到下展示：

#### 卡片 C1：会话基本信息
- 项目名称：`activeView.project_key`（或从 `file_path` 提取最后一级目录名）
- 文件夹路径：`activeView.file_path` 的父目录（最多显示 3 级，超出用 `...` 截断）
- Git 分支：`activeView.branch ?? "—"`（可能为空，降级显示）

#### 卡片 C2：当前会话 Token
- 输入 Token：`sum(messages[].input_tokens)`
- 输出 Token：`sum(messages[].output_tokens)`
- Cache Creation：`sum(messages[].cache_creation_tokens)`
- Cache Read：`sum(messages[].cache_read_tokens)`
- 总 Token：上述四项合计
- 费用估算：参考 `history.rs` 的 `calculate_usage_cost` 逻辑（需前端重新计算或从后端新增字段）

**视觉**：
- 使用进度条展示"输入 vs 输出"占比
- 主要数字大号显示，辅助数字小号灰色
- 参考 `StatsPanel.tsx` 的 `TokenCompositionStrip` 风格

#### 卡片 C3：模型信息
- 模型名称：从 `messages[]` 中推断主模型（取出现次数最多的 `model` 字段，若消息中无 model 字段则显示 `—`）
- 思考强度：**缺失字段**，显示 `—`（未来可从 model name 或 metadata 推断）

#### 卡片 C4：上下文使用情况
- 上下文使用率：**估算值**，取最后一条消息的 `input_tokens + cache_read_tokens + cache_creation_tokens`，除以模型上下文上限（从模型名推断，如 `opus-4-8` → 200K）
- 展示为百分比 + 进度条
- 若无法推断上限，显示 `—`

#### 卡片 C5：今日项目总用量
- 范围：今日（UTC 0 点到现在）所有该 `project_key` 的会话
- 数据来源：需调用 `history_get_stats` 并过滤今日 + 当前项目，或新增专用命令
- 展示：总 Token、总费用、会话数
- 若查询失败或无数据，显示 `—`

### R3：视觉设计要求

参考用户提供的设计图：
- 卡片间距紧凑，背景色与主题一致（`bg-bg-secondary`）
- 数字大号加粗，单位小号灰色
- 进度条使用渐变色（绿→橙）或主题色
- 图标：文件夹、分支、Token、模型、时间等，使用 `lucide-react`
- 整体风格简洁、信息密度高，像 IDE 的 statusline

## 技术方案

### 架构选择

**Option A：纯前端计算**
- 优点：简单，无需后端改动
- 缺点：C5（今日总用量）需前端遍历 `sessions` 并过滤，可能性能差

**Option B：新增后端命令**
- 新增 `history_get_session_stats(session_key)` 返回会话维度统计
- 新增 `history_get_today_project_stats(project_key)` 返回今日项目统计
- 优点：前端轻量，后端统一维护
- 缺点：需改动 Rust 代码

**推荐**：**Option A**（先纯前端实现 MVP），C5 若性能不够再优化为 Option B。

### 组件结构

```
SessionStatsPanel.tsx (新组件)
  ├── SessionInfoCard (C1: 基本信息)
  ├── TokenUsageCard (C2: Token 用量 + 进度条)
  ├── ModelInfoCard (C3: 模型信息)
  ├── ContextUsageCard (C4: 上下文进度条)
  └── TodayProjectCard (C5: 今日总用量)
```

### 状态管理

在 `HistoryWorkspace.tsx` 新增：
- `const [statsPanelOpen, setStatsPanelOpen] = useState(false);`
- 展开/收起按钮在 `SessionDetailPane` 顶部工具栏
- `SessionStatsPanel` 挂载在右侧，CSS 控制宽度 `statsPanelOpen ? '280px' : '0'`

### 数据流

1. `HistoryWorkspace` 将 `activeSession` 传给 `SessionStatsPanel`
2. `SessionStatsPanel` 内部计算统计数据（Token 合计、模型推断、今日汇总）
3. 若 `activeSession` 为 null，侧栏显示空状态

## 技术约束

- 历史日志解析已由 `history.rs` 完成，前端无需重新解析 JSONL
- `HistoryMessage` 类型中**没有** `model` 字段（见 `types.ts:124-127`），需从会话级 metadata 或后端扩展
- 上下文上限推断需维护模型名→上下文映射表（如 `MODEL_CONTEXT_LIMITS`）

## 已知信息补充

### 现有实现

1. **历史会话模块**：
   - `src/components/history/SessionDetailPane.tsx` 展示会话详情（消息列表、元数据编辑）
   - `src/stores/historyStore.ts` 管理会话数据、统计数据、搜索等
   - 历史会话已有统计面板 `StatsPanel.tsx`（全局维度的历史统计，以弹层形式呈现）

2. **数据来源**：
   - 会话详情从 SQLite `session_meta` 表获取（通过 Rust 命令 `history_get_session`）
   - `HistorySessionDetail` 包含 `messages[]`，每条消息包含 `input_tokens`、`output_tokens`、`cache_creation_tokens`、`cache_read_tokens` 字段
   - 会话 metadata 包含 `project_key`、`file_path`、`branch` 等字段

3. **UI 布局**：
   - `SessionDetailPane` 当前占据历史面板右侧全部空间
   - 需要在右侧分出固定宽度的统计面板，类似分屏布局

4. **技术栈**：
   - React 19 + TypeScript + Zustand
   - Tailwind CSS 4
   - ECharts 图表（已在 `StatsPanel.tsx` 中使用）
   - `HistorySessionDetail` 类型在 `src/lib/types.ts` 中定义

## 验收标准

- [x] 点击展开按钮，侧栏平滑展开至 280px
- [x] C1~C5 所有卡片正确展示数据，缺失字段显示 `—`
- [x] Token 进度条视觉正确（颜色、比例）
- [x] 上下文使用率百分比计算正确（若可推断）
- [x] 今日总用量数据正确（会话数展示，Token/费用待后端支持）
- [x] 切换会话后，侧栏数据实时更新
- [x] 视觉风格与设计图一致（紧凑、高级感、statusline 风格）
- [x] 费用估算功能完成（已实现 `calculateCost` 和 `MODEL_PRICING` 表）
- [ ] 模型推断功能（待后端在 `HistoryMessage` 中添加 `model` 字段）

## Out of Scope

- ❌ 当前活跃终端会话的实时统计（非历史会话）
- ❌ 侧栏宽度拖拽调整
- ❌ 图表可视化（仅进度条，不用 ECharts）
- ❌ 导出统计数据

## Decision (ADR-lite)

**Context**: 用户希望在历史会话详情区右侧添加统计面板，但"当前窗口"一词容易引发歧义：是展示"选中的历史会话"还是"正在运行的终端会话"？

**Decision**: 展示**选中的历史会话**统计（静态数据），而非活跃终端的实时数据。

**Consequences**: 
- ✅ 实现简单，数据全部来自 `HistorySessionDetail`，无需 IPC 或轮询
- ✅ 与历史工作区的定位一致（历史回顾，而非实时监控）
- ⚠️ 无法满足"实时监控当前终端 Token"的诉求（若需要，应在终端区实现）
- ⚠️ "思考强度"和"上下文使用率"需降级显示（历史日志可能缺失这些字段）
