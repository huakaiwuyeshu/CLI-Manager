# 实施计划

1. `TerminalTabs.tsx`
   - 增加 Workspan drag-hover 自动激活与对称 cleanup。
   - 保留现有 collision、preview、merge Store 行为。
2. `XTermTerminal.tsx`、`useTerminalDisplay.ts`
   - 补齐可见性恢复的完整 viewport refresh 和 reveal barrier。
3. `sidebar/index.tsx`、`styles/components.css`
   - DOM width 实时预览，mouseup 提交 state。
   - 移除终端 Pane 几何动画。
4. 测试
   - Workspan hover activation/cleanup。
   - Tab 恢复完整 viewport。
   - resize debounce 与最终尺寸提交。
5. 验证
   - 相关 Node 测试。
   - `npx tsc --noEmit`。
   - `git diff --check` 与 GitNexus detect_changes。
