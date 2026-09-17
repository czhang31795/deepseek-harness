# Agent Note: 能力占用隐藏编码 chrome

Status: implemented

[English](2026-09-16-capability-occupancy-hides-coding-chrome.md) | 中文

## Problem

问答 overlay 可以关掉编码插件，但若干会话控件仍留在屏幕上，因为拥有它们的 shell 总会渲染。输入框加号、hero 工作区 chip、按工作区分组的树、设置控件、右侧栏展开按钮都不读取对应能力是否存在，因此去掉命令、目录选择、设置页和页面 tab 类型的组合看起来仍像编码 IDE。

overlay YAML 里的 Client 插件 `config` 到不了浏览器：`bootClient` 把名单行构造成 `loader.create({ name })`，不带 config 对象。因此只靠 overlay 开关藏不住这些控件，除非改第一方 shell。

## Decision

**会话 chrome 跟随能力占用，而不是 kiosk 开关。** 官方编码组合仍显示同样的按钮。问答 overlay 通过不挂占用席位的插件来隐藏它们，外加一个宿主插件把 cwd 登记成工作区，好让「新会话」有目标。

输入框加号只在组合了 `toggleCommandMenu` 时渲染。关掉 `ui-commands` 以及每个 `commandUi` 消费方后，该回调为 undefined，InputBar 省略启动按钮。

hero 工作区行（chip、directory-flow 菜单、agent-preset 席位）只在 `conversation.hero.workspace.directoryFlow` 有占用者时渲染。`ui-conversation` 把该占用发布为 `hooks.canAddWorkspace`。关掉宿主 `directory-picker` 行后席位为空，因此 chip 不再出现，无 Session 的 composer 也不会变成工作区选择器。该席位为空时，ConversationContent 会接上已有 Workspace（最近活动，其次创建时间），好让输入框可以接收内容。KnowEmp overlay 插入 `knowemp-workspace`，调用 `workspaceRegistry.create(process.cwd())`，让「新会话」和这次自动连接有目标。

宿主 `watchNavigation` 在两份名单都已就绪但还没有 Workspace 时继续等待，而不是放弃；cwd 插件若在首次对账之后才写入名单，仍会收到初始连接。

`sidebar.workspaces.directoryFlow` 为空时，WorkspaceBrowser 渲染扁平 Session 列表并省略分组选项。它不改写已持久化的 `groupBy`，因此恢复目录选择器后会沿用保存的分组。

设置控件是 `sidebar.settings` 的占用者。关掉 `ui-settings-general` 后该席位为空，侧边栏底部不绘制控件。保留 `ui-settings`（领域底座）。关掉 `ui-settings-models` 和 `ui-settings-unarchive-sessions` 会去掉已不可达的页面。

右侧栏展开按钮只在已注册 tab 类型不是引导页时渲染。引导页必须留下，因为 `ui-chat` 注入 `sidebarRight`。关掉 `ui-sidebar-files`、`ui-sidebar-terminal` 和 `ui-sidebar-documentpreview` 后只剩引导页，ExpandButton 返回 null。

这些规则写在 `ui-conversation`、`ui-workspace`、`ui-sidebar` 与 `ui-sidebar-right`。KnowEmp overlay 列出关掉的行和 cwd 工作区插件；它不为 chrome 增加 Client YAML config。

## Alternatives considered

**增加 `hideWorkspaceChip` 这类 Client `Config` 开关。** 否决，因为 `bootClient` 不把 overlay config 传进浏览器名单，在改 loader 契约之前这些开关不会生效。

**关掉 `ui-sidebar-right` 或 `ui-workspace`。** 否决，因为 `ui-chat` 注入 `sidebarRight`，没有它整页不挂载，而且「新会话」仍需要一个工作区目标。

**关掉 `ui-settings`。** 否决，因为功能行仍会注入设置领域；只有 `sidebar.settings` 的占用者（`ui-settings-general`）绘制入口。

**改 `$DSH_HOME` 里的 `settings.agent-presets.modeSelectionEnabled`。** 否决，因为该文件与同一台机器上的编码 preset 共用。

**目录选择器仍在时由 ConversationContent 自动选中 Workspace。** 否决，因为选择器本身就是连接手势。directory-flow 席位为空时会自动连接，因为 composer 不再是选择器。

**directory-flow 席位为空时把持久化的 `groupBy` 改写成 `flat`。** 否决，因为之后再挂编码组合时应保留用户已保存的分组。

## Consequences

- 仍挂载命令、目录选择器、settings-general 或页面 tab 类型的编码组合会保留对应 chrome。
- 问答 overlay 必须关掉占用席位的插件并保证一个 cwd 工作区；只关工具会留下按钮。
- 上下文计量、侧栏新建会话 / 品牌、以及 DeepSeek 鱼标 hero 仍在；本次没有它们的占用信号。
- 关掉 `ui-settings-general` 也会去掉应用内断线恢复和设置面板；模型配置改走 `.env` / `$DSH_HOME/settings.yaml`。
- [右侧栏停靠](../feature/2026-09-04-right-sidebar-docking-infrastructure.zh.md) 仍拥有展开按钮的席位；本笔记拥有该席位何时不绘制。

## Testing

`ui-conversation` 在 `toggleCommandMenu` 为 undefined 时省略启动按钮，在 directory-flow 占用为 false 时隐藏 hero chip 并自动接上已有 Workspace，并在选择器占用席位之前报告 `canAddWorkspace` 为 false。`ui-workspace` 在侧边栏 directory-flow 席位为空时强制扁平 Session 列表并隐藏分组项，且不改持久化的 `groupBy`；初始导航仍会连接空就绪名单之后出现的 Workspace。`ui-sidebar-right` 的 ExpandButton 在只注册引导类型时为 null。
