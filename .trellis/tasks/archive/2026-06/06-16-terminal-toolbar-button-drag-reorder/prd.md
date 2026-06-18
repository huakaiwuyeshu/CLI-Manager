# 内部终端工具栏按钮拖动排序

## Goal

允许用户通过拖拽方式自定义终端标签栏右侧工具栏按钮的显示顺序，提升个性化体验。

## Decision (ADR-lite)

**拖拽入口**：选项 A — 直接在工具栏中拖动（用户已确认）。用户在终端右上角工具栏中直接拖动按钮调整顺序，无需进入设置页。需设置激活距离阈值（沿用现有 `distance: 5`）以区分点击与拖动。

**「统计」按钮处理**：选项 A — 新增 `stats` 显隐开关（用户已确认）。在 `TerminalToolbarVisibilitySettings` 新增 `stats: boolean` 字段（默认 `true`），让所有工具栏按钮统一可排序 + 可显隐。设置页「工具栏」区块新增「统计」开关。

**设置页职责**：选项 A — 设置页保持原样（用户已确认）。设置页「工具栏」区块只负责显隐开关，排序完全在工具栏操作。设置页不显示/编辑按钮顺序，保持职责单一。

**拖拽视觉反馈**：选项 A — 沿用终端标签拖拽风格（用户已确认）。原位置按钮半透明（`opacity: 0.4`），使用 `DragOverlay` 显示跟随鼠标的预览，插入位置视觉指示，光标 `grabbing`。与现有终端标签拖拽体验一致。

**「新建」按钮排序**：选项 B — 「新建」也可拖动排序（用户已确认）。所有 6 个按钮（new/templates/commandHistory/fullscreen/sessionHistory/stats）都可拖动排序，`terminalToolbarOrder` 包含 `"new"` 项。完全自由定制顺序。

## What I already know

* **工具栏位置**：`src/components/TerminalTabs.tsx` 第 1277-1352 行 `renderToolbarActions` 方法，包含多个按钮：
  - 新建终端（可拖动排序）
  - Templates（可隐藏）
  - 历史命令（可隐藏）
  - 全屏（可隐藏）
  - 会话历史（可隐藏）
  - 统计（需新增隐藏开关）
* **现有配置结构**：
  - `src/stores/settingsStore.ts` 中 `TerminalToolbarVisibilitySettings` 接口管理按钮显隐
  - 当前字段：`templates`、`commandHistory`、`fullscreen`、`sessionHistory`、`showText`
  - 设置页面：`src/components/settings/pages/GeneralSettingsPage.tsx` 第 796-838 行
* **拖拽基础设施**：项目已使用 `@dnd-kit` 库，`TerminalTabs.tsx` 已有终端标签拖拽实现（`DndContext`、`SortableContext`）。

## Requirements

### 数据层
* [ ] 在 `settingsStore.ts` 中新增 `terminalToolbarOrder: string[]` 字段，存储按钮顺序
* [ ] 默认顺序：`["new", "templates", "commandHistory", "fullscreen", "sessionHistory", "stats"]`
* [ ] 所有 6 个按钮都可拖动排序
* [ ] 在 `TerminalToolbarVisibilitySettings` 中新增 `stats: boolean` 字段（默认 `true`）
* [ ] 新增迁移函数 `migrateTerminalToolbarOrder`，处理新增/删除按钮场景

### UI 层 - 工具栏拖拽交互
* [ ] 在 `TerminalTabs.tsx` 中使用 `@dnd-kit/sortable` 实现按钮拖拽
* [ ] 所有按钮（包括「新建终端」）都可拖动排序
* [ ] 拖拽视觉反馈：
  - 拖动中：按钮显示半透明 (`opacity: 0.4`) + grabbing cursor
  - 拖动目标位置显示插入指示器
  - 使用 `DragOverlay` 显示跟随鼠标的预览
  - 保持与现有终端标签拖拽风格一致
* [ ] 拖拽完成后立即持久化顺序到 `settingsStore`
* [ ] 支持键盘无障碍：Space/Enter 激活拖动，方向键移动位置，Space/Enter 确认
* [ ] 被隐藏的按钮（`terminalToolbarVisibility[key] = false`）不渲染、不参与排序

### UI 层 - 设置页面增强
* [ ] 在「通用设置 - 工具栏」区块新增「统计」显隐开关
* [ ] 开关列表保持原有顺序（不按 `terminalToolbarOrder` 排序，保持设置页职责单一）
* [ ] 排序功能完全在工具栏中操作，设置页不涉及排序 UI

### 边界场景
* [ ] 新增按钮时（未来功能）：自动追加到 `terminalToolbarOrder` 末尾
* [ ] 删除按钮时：从 `terminalToolbarOrder` 中移除对应 key
* [ ] 用户配置缺失某个按钮 key 时：使用默认顺序补全

## Acceptance Criteria

* [ ] 在终端工具栏中拖动任意按钮（包括「新建终端」）后，顺序立即变化且持久化
* [ ] 刷新应用后，按钮顺序保持用户上次配置
* [ ] 隐藏按钮后，不出现在工具栏且不参与拖拽排序
* [ ] 「统计」按钮新增显隐开关，默认显示，关闭后立即隐藏
* [ ] 拖拽视觉反馈清晰（半透明、DragOverlay、插入指示器、cursor 变化）
* [ ] 键盘操作流畅（Tab 切换、Space/Enter 拖动、方向键排序）
* [ ] 激活距离阈值 5px 可正确区分点击与拖动
* [ ] 类型检查、lint 通过

## Definition of Done (team quality bar)

* 类型检查、lint 通过
* 手动验证：
  - 终端工具栏拖拽排序正常
  - 设置页拖拽列表与工具栏双向同步
  - 显示/隐藏开关与拖拽排序独立工作
  - 键盘无障碍操作流畅
  - 刷新应用后配置持久化正常
* 确保迁移逻辑兼容（旧版无 `terminalToolbarOrder` 时使用默认顺序）

## Out of Scope (explicit)

* 不涉及工具栏按钮功能变更（仅调整顺序与显隐）
* 不涉及设置页排序 UI（排序仅在工具栏操作）
* 不涉及设置页开关列表按 `terminalToolbarOrder` 重排（保持原有顺序）
* 不涉及其他区域（侧边栏、设置页导航）的拖拽排序
* 不涉及移动端适配（项目为桌面应用）

## Technical Notes

### 数据结构设计

```typescript
// settingsStore.ts
export interface TerminalToolbarVisibilitySettings {
  // ...existing fields
  stats: boolean; // 新增：统计按钮显隐
}

export interface Settings {
  // ...existing fields
  terminalToolbarOrder: string[]; // 新增：按钮顺序
}

export const DEFAULTS = {
  // ...existing defaults
  terminalToolbarVisibility: {
    templates: true,
    commandHistory: true,
    fullscreen: true,
    sessionHistory: true,
    showText: false,
    stats: true, // 新增
  },
  terminalToolbarOrder: ["new", "templates", "commandHistory", "fullscreen", "sessionHistory", "stats"], // 新增
};

export function migrateTerminalToolbarOrder(value: unknown): string[] {
  const defaults = DEFAULTS.terminalToolbarOrder;
  if (!Array.isArray(value)) return [...defaults];

  // 过滤掉不存在的 key，补全缺失的 key
  const validKeys = new Set(defaults);
  const filtered = value.filter((k): k is string => typeof k === "string" && validKeys.has(k));
  const missing = defaults.filter(k => !filtered.includes(k));
  return [...filtered, ...missing];
}
```

### 工具栏渲染逻辑

```typescript
// TerminalTabs.tsx - renderToolbarActions
const renderToolbarActions = useCallback(() => {
  const { order, visibility, showText } = terminalToolbar;

  const buttonMap = {
    new: <button onClick={handleNewTab}>...</button>,
    templates: <CommandTemplatePanel showText={showText} />,
    commandHistory: <CommandHistoryPanel compact showText={showText} />,
    fullscreen: <button onClick={onToggleFullscreen}>...</button>,
    sessionHistory: <button onClick={handleOpenHistoryTab}>...</button>,
    stats: <button onClick={handleToggleStatsPanel}>...</button>,
  };

  const visibleButtons = order
    .filter(key => key === "new" || visibility[key]) // "new" 始终可见（无 visibility 字段）
    .map(key => ({ id: key, element: buttonMap[key] }));

  return (
    <div className="ui-terminal-actions">
      <SortableContext items={visibleButtons.map(b => b.id)} strategy={horizontalListSortingStrategy}>
        {visibleButtons.map(btn => (
          <SortableToolbarButton key={btn.id} id={btn.id}>
            {btn.element}
          </SortableToolbarButton>
        ))}
      </SortableContext>
    </div>
  );
}, [terminalToolbar, handleNewTab, ...]);
```

### 设置页（仅新增统计开关）

```typescript
// GeneralSettingsPage.tsx - TERMINAL_TOOLBAR_OPTIONS 新增 stats
const TERMINAL_TOOLBAR_OPTIONS: { key: TerminalToolbarOptionKey; label: string }[] = [
  { key: "templates", label: "Templates" },
  { key: "commandHistory", label: "历史命令" },
  { key: "fullscreen", label: "全屏" },
  { key: "sessionHistory", label: "会话历史" },
  { key: "stats", label: "统计" }, // 新增
];
// 设置页不涉及排序 UI，仅渲染显隐开关
```

### 边界处理：DragOverlay 与 SortableContext

- 工具栏外层包裹 `DndContext`（独立于现有终端标签的 DndContext，避免冲突）
- 使用 `arrayMove` 处理拖拽后的顺序更新
- `onDragEnd` 回调中调用 `update("terminalToolbarOrder", newOrder)` 持久化

### 参考文件
- 拖拽实现参考：`src/components/TerminalTabs.tsx` 终端标签拖拽（第 1136-1275 行）
- 设置页结构参考：`src/components/settings/pages/GeneralSettingsPage.tsx` 工具栏区块（第 796-838 行）
- 状态管理参考：`src/stores/settingsStore.ts` 配置迁移逻辑

### 技术细节
- 使用 `@dnd-kit/sortable` 的 `useSortable` hook
- 拖拽 sensors：`PointerSensor`（鼠标）+ 可选 `KeyboardSensor`（键盘无障碍）
- 拖拽 strategy：`horizontalListSortingStrategy`（工具栏）
- 拖拽事件：`onDragEnd` 回调使用 `arrayMove` 更新 `terminalToolbarOrder` 并持久化
- 工具栏需要独立的 `DndContext`（避免与终端标签拖拽冲突）
- 激活距离：`{ activationConstraint: { distance: 5 } }`（沿用现有配置）

### 新增字段汇总
1. `Settings.terminalToolbarOrder: string[]` — 按钮顺序，默认 `["new", "templates", "commandHistory", "fullscreen", "sessionHistory", "stats"]`
2. `TerminalToolbarVisibilitySettings.stats: boolean` — 统计按钮显隐，默认 `true`
3. `TERMINAL_TOOLBAR_OPTIONS` 新增 `{ key: "stats", label: "统计" }`
