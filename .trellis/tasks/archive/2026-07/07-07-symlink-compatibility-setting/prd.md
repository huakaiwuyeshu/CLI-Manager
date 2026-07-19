# 软连接兼容性开关

## Goal

在通用设置中新增默认关闭的“软连接兼容性”开关，只有开启后才在新建/编辑项目路径输入旁显示小号 WSL 软连接选择入口，减少低频功能对普通用户的干扰。

## Changelog Target

[TEMP]

## Requirements

* 设置项名称使用“软连接兼容性”。
* 默认关闭，旧用户没有该字段时也按关闭处理。
* 开启后显示当前已实现的小号 `WSL` 路径选择按钮。
* 关闭后隐藏该按钮，不改变普通“浏览”按钮和手动输入路径行为。
* WSL 选择器列表只展示目录软连接，不展示普通目录。
* WSL UNC 项目如果软连接到 `/mnt/<drive>/...` 的 Windows 工作区，Git 变更状态必须按 Windows/native Git 结果展示，避免 WSL Git 把所有文件误判为修改。
* 新增用户可见文案必须覆盖 `zh-CN` 与 `en-US`。

## Acceptance Criteria

* [ ] 新装或缺省设置下，新建项目路径旁不显示 `WSL` 按钮。
* [ ] 在“设置 -> 通用”开启“软连接兼容性”后，路径旁显示 `WSL` 按钮。
* [ ] 关闭开关后，`WSL` 按钮重新隐藏。
* [ ] 打开 WSL 选择器时，列表只显示目录软连接。
* [ ] `\\wsl.localhost\...\data\acGo` 这类指向 Windows 盘项目的软连接路径，不再在 Git 面板显示全量文件修改。
* [ ] `npx tsc --noEmit` 通过。

## Definition of Done

* 类型检查通过。
* 行为变更记录到 `CHANGELOG.md`。
* 产品功能变更记录到 `docs/功能清单.md`。

## Technical Approach

在 `settingsStore` 增加持久化 boolean 字段并在加载时校验；通用设置页用现有 `Switch` 卡片模式展示开关；`ConfigModal` 订阅该字段并条件渲染 `WSL` 小按钮；文案写入 `src/lib/i18n.ts`。Git 状态读取对 WSL UNC 先解析真实 Linux 路径，若落到 `/mnt/<drive>` 则转回 Windows 路径并走 native 状态收集。

## Decision

**Context**: WSL 软连接选择是低频兼容功能，常驻显示会干扰普通新建项目路径选择。

**Decision**: 默认隐藏，通过“软连接兼容性”设置显式开启。

**Consequences**: 普通用户界面更干净；需要使用 WSL 软连接的用户需先打开开关。

## Out of Scope

* 不更改后端 WSL 路径校验和列目录逻辑。
* 不改变项目数据库结构。
* 不改变原生“浏览”目录选择行为。

## Technical Notes

* 已检查 `settingsStore.ts` 的 primitive persisted setting 校验模式。
* 已检查 `GeneralSettingsPage.tsx` 的通用设置卡片和 Switch 写法。
* 已检查 `ConfigModal.tsx` 当前 WSL 小按钮位置。
* GitNexus 影响分析：`ConfigModal`、`GeneralSettingsPage`、`useSettingsStore` 均为 LOW。
