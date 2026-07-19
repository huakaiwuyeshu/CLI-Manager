# AI 会话 Replay 侧栏

## Goal

实现“当前 AI 开发会话实时录制 + 持久化回放 + 时间轴定位 + 代码快照回滚/Fork”的终端侧栏体验，并保留静态 HTML 原型作为设计参考。

## Requirements

- 时间轴必须显示绝对时间、相对时间，并支持滚动查看。
- 时间轴支持搜索和分类过滤。
- 顶部显示录制健康度，提示持久化状态。
- 点击时间轴事件后，底部动态显示选中事件详情。
- 代码快照不固定显示；只有选中快照事件时，详情区显示快照 diff、影响文件、查看、回滚、Fork。
- Replay 入口默认关闭，用户需要在设置的终端工具栏中手动开启。
- 工具、MCP、Skill、子任务、快照等事件使用彩色图标区分。
- 数据需要持久化到本地 SQLite，方便下次查看。

## Acceptance Criteria

- [ ] HTML 文件可直接用浏览器打开。
- [ ] 时间轴可滚动，事件显示时间。
- [ ] 搜索/过滤按钮有可见 UI。
- [ ] 录制健康度和持久化状态有可见 UI。
- [ ] 详情区随选中事件动态变化。
- [ ] 快照事件显示回滚相关操作，普通事件不显示固定快照模块。
- [ ] 新用户默认不显示 Replay toolbar，设置开启后才显示。
- [ ] 当前会话事件和代码快照写入本地数据库，下次打开可读回。

## Out of Scope

- 不启动开发服务。
- 不恢复“需求变更 / 首个快照 / 风险阻断”等固定入口。

## Technical Notes

- 原型文件：`replay-sidebar-ui.html`
- 当前采用静态 HTML/CSS/JS 和 Lucide CDN 图标。
- 应用实现：`src/components/terminal/SessionReplayPanel.tsx`
- 持久化：`src/stores/replayStore.ts` 中的 `ai_replay_sessions`、`ai_replay_events`
