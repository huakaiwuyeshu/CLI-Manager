# README bilingual language switch

## Goal

把现有中文 `README.md` 调整为英文默认入口，并新增中文 README，让读者可以在英文和中文版本之间切换。

## What I already know

* 当前仓库只有 `README.md`。
* 当前 `README.md` 是中文版本，内容包含项目简介、特性、截图、技术栈、快速开始、快捷键、交流讨论和许可证。
* 用户要求：`README.md` 改成英文版本，并添加中文版本，可以进行切换。

## Assumptions

* `README.md` 作为 GitHub 默认入口使用英文。
* 新增中文版本使用常见命名 `README.zh-CN.md`。
* 语言切换通过两个 README 顶部互链完成，不引入额外站点、脚本或构建流程。

## Requirements

* `README.md` 改为英文内容。
* 新增 `README.zh-CN.md`，保留现有中文内容。
* 两个 README 顶部都提供语言切换链接。
* 保持现有截图、徽章、链接和文档结构可用。

## Acceptance Criteria

* [x] `README.md` 为英文版。
* [x] `README.zh-CN.md` 为中文版。
* [x] 两个文件可相互切换。
* [x] Markdown 链接和图片路径没有明显破坏。

## Definition of Done

* 只修改 README 相关文件和本任务 Trellis 记录。
* 使用文件检查或搜索确认双语入口存在。
* 不改代码、不改依赖、不改配置。

## Out of Scope

* 不新增 README 构建工具。
* 不调整项目功能描述的事实范围。
* 不重命名 `docs/` 下的中文图片或文档文件。

## Technical Notes

* 已读取 `README.md`。
* 已检查根目录 README 文件：当前只有 `README.md`。
* 已验证双语互链、本地 `docs/` 引用和尾随空白。
