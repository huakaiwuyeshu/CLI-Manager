# 给历史会话操作按钮添加颜色

## Goal

给历史会话详情顶部的操作按钮增加对应语义颜色，让“复制ID、复制定位、历史Prompt、Diff、收藏”更容易区分。

## What I already know

* 用户指定的按钮文案：复制ID、复制定位、历史Prompt、Diff、收藏。
* 按钮位于 `src/components/history/SessionDetailPane.tsx`。
* 现有按钮共用 `ui-flat-action ui-toolbar-button ui-toolbar-button-compact`。
* 收藏按钮已有已收藏态黄色 `var(--warning)` 和星标填充。
* 项目主题色通过 CSS 变量提供：`--primary`、`--accent`、`--success`、`--warning`、`--danger` 等。

## Requirements

* 给上述 5 个按钮添加可见的对应颜色。
* 保持现有布局、按钮尺寸、点击行为、toast 文案不变。
* 使用现有主题 CSS 变量，不引入新依赖。

## Acceptance Criteria

* [ ] 5 个按钮都有对应颜色。
* [ ] 收藏按钮保留未收藏/已收藏状态差异。
* [ ] 前端类型检查通过。

## Definition of Done

* Run `npx tsc --noEmit`.
* For runtime UI,人工检查历史会话详情顶部按钮颜色是否清晰且不影响点击。

## Out of Scope

* 不重构历史会话详情布局。
* 不新增设置项或自定义主题配置。
* 不修改后端历史数据或收藏逻辑。

## Technical Notes

* Relevant code: `src/components/history/SessionDetailPane.tsx`.
* Relevant specs: `.trellis/spec/frontend/component-guidelines.md`, `.trellis/spec/frontend/quality-guidelines.md`.
