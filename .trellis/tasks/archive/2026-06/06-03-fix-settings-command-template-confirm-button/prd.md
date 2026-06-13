# 修复设置命令模板确认按钮缺失

## Goal

修复设置页“命令模板”管理界面中确认操作缺失或不可见的问题，让用户能明确完成新建/编辑/删除模板操作，避免误操作或无法保存。

## What I already know

* 用户反馈：设置中的命令模板缺失了确认按钮。
* `src/components/settings/pages/TemplateSettingsPage.tsx` 是设置页命令模板管理入口。
* 该页面当前已有底部 `保存` 按钮，用于新建/编辑模板。
* 该页面当前编辑模式有 `删除` 按钮，但删除会直接执行，没有二次确认。
* `SettingsLayout` 的内容区为 `overflow-y-auto`，底部按钮不是固定操作栏。
* GitNexus impact：`TemplateSettingsPage` upstream 风险 LOW，直接上游影响为 0。

## Assumptions (temporary)

* 问题可能有两种含义：
  * 新建/编辑表单缺少可见的“确认/保存”操作；或
  * 删除模板缺少二次确认按钮/确认态。
* MVP 应优先做最小局部修复，不引入新组件或全局交互改造。

## Open Questions

* None.

## Requirements

* 设置页命令模板新建/编辑表单必须有明确、可见的保存确认操作。
* 编辑模式删除模板时必须有二次确认，不能点击一次就直接删除。
* 保持命令模板现有新建、编辑、删除能力。
* 修复目标应局限在设置页命令模板管理区域。

## Acceptance Criteria

* [x] 用户能在设置页命令模板表单中明确点击保存完成新建/编辑。
* [x] 用户点击删除后，需要再次确认才会删除模板。
* [x] 用户可以取消删除确认并回到编辑状态。
* [x] 修复不影响模板列表选择、搜索、新建、编辑、删除的原有数据流。
* [x] TypeScript 检查通过。

## Definition of Done (team quality bar)

* Tests/checks run where practical.
* Typecheck green or documented blocker.
* UI golden path manually verified if app can be launched.
* No unrelated refactor or dependency/config changes.

## Out of Scope (explicit)

* 不重构命令模板数据层。
* 不改变模板变量语法。
* 不新增依赖或全局确认弹窗框架。

## Technical Notes

* Relevant files inspected:
  * `src/components/settings/pages/TemplateSettingsPage.tsx`
  * `src/components/CommandTemplatePanel.tsx`
  * `src/stores/templateStore.ts`
  * `src/components/SettingsModal.tsx`
  * `src/components/settings/SettingsLayout.tsx`
  * `.trellis/spec/frontend/quality-guidelines.md`
  * `.trellis/spec/guides/index.md`
* Existing command template popover uses `保存/取消` for creation, and settings page uses shared form with `保存`.
