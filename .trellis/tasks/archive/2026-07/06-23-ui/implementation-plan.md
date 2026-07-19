# UI 优化逐步实现计划

## 背景

用户基于截图反馈：顶部边框/标题栏过宽，希望压缩，并希望继续优化截图中明显的 UI 问题。当前仓库存在多任务并行开发，必须避免触碰其他任务文件或覆盖其他 session 的改动。

## 并行开发保护规则

1. 每个阶段开始前运行 `git status --short`，确认已有 dirty 文件。
2. 只修改本任务相关文件：
   - `.trellis/tasks/06-23-ui/**`
   - `src/components/WindowTitleBar.tsx`
   - `src/styles/components.css`
   - 必要时仅限 `src/App.tsx` 中 Toaster/Hook toast 挂载相关代码
3. 不修改其他 Trellis 任务目录，尤其不碰当前已有 dirty 的 `06-22-cli-manager-agent` 文件。
4. 不做格式化全仓、不跑自动修复、不做 find-and-replace 大范围替换。
5. 每次源码修改后只检查本任务涉及文件 diff。
6. 不主动 commit；若需要提交，先展示计划并等待用户明确指令。

## 阶段 1：顶部标题栏压缩（已完成）

目标：减少窗口顶部标题栏高度，保留拖拽、双击最大化、窗口控制按钮。

已改文件：
- `src/components/WindowTitleBar.tsx`
- `src/styles/components.css`

验收：
- 标题栏从 `h-9` 压缩到 `h-[26px]`。
- 窗口按钮从 `44x32` 压缩到 `40x26`。
- `npx tsc --noEmit` 通过。

## 阶段 2：Hook 通知与右侧面板避让/降噪（已完成）

目标：解决截图中 Hook toast 覆盖右侧 Git 面板的问题，并降低通知视觉重量。

推荐实现（最小范围）：
- 仍保持 Hook 通知为 `top-right`。
- 通过 CSS 自适应：桌面宽屏时把 Hook toast 从最右侧向左偏移，避开常见右侧面板宽度；窄屏时保持原行为。
- 略微压缩 toast 宽度、padding、icon、close button，减少遮挡面积。

预计文件：
- `src/styles/components.css`

不做：
- 不改 Hook 事件逻辑。
- 不改 Git 面板数据/交互。
- 不引入 JS 测量右侧面板宽度，避免跨组件耦合。

## 阶段 3：终端标签栏轻量化（已完成）

目标：进一步减少顶部视觉厚度，但不影响分屏/拖拽。

推荐实现（CSS-only）：
- `ui-terminal-chrome` 全局 tab chrome 从 44px 视觉高度降到约 38px。
- pane chrome 保持或小幅从 40px 降到 38px。
- tab trigger 从 28px 降到 26px，scroll/list button 同步小幅压缩。

预计文件：
- `src/styles/components.css`
- 必要时 `src/components/TerminalTabs.tsx` 仅调整 Tailwind 高度 class（如果 CSS 覆盖不够稳定）。

不做：
- 不改 drag/drop 逻辑。
- 不改 pane tree 数据结构。

## 阶段 4：右侧操作区和 Git 面板视觉层级建议落地（已完成）

目标：降低右侧 Git 面板和操作侧栏的边框/按钮噪声。

推荐实现（CSS-only）：
- 弱化右侧 action sidebar 边框和渐变强度。
- Git 面板 header/button 只做密度/边框轻量化，不改行为。

预计文件：
- `src/styles/components.css`
- 如 Git 面板使用大量 inline class，可能涉及 `src/components/git/GitChangesPanel.tsx`，需先做影响分析。

## 回归修复：设置页顶部黑边（已完成）

问题：标题栏从 `36px` 收窄到 `26px` 后，设置页 overlay 仍使用旧的 `top-9` 偏移，导致标题栏与设置内容之间暴露黑色缝隙。

修复：将 `src/components/SettingsModal.tsx` 的 fixed overlay 顶部偏移同步为 `top-[26px]`，与压缩后的标题栏高度对齐。

验收：
- 设置页顶部不再出现黑色横条。
- 保留设置页滚动、关闭按钮和标题栏交互。
- `npx tsc --noEmit` 通过。

## 验证计划

每阶段后：
1. `git diff -- <涉及文件>` 检查范围。
2. `npx tsc --noEmit` 做前端类型检查。
3. 如用户要求再运行 app 视觉验证；默认按既有记忆由用户做 UI/build 验证。

## 当前建议顺序

1. 阶段 2：先处理通知遮挡右侧面板，收益最大且 CSS-only。
2. 阶段 3：再压缩终端标签栏视觉厚度。
3. 阶段 4：最后视截图反馈决定是否继续微调右侧面板。
