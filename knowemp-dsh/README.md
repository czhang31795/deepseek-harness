# KnowEmp → DeepSeek Harness

公司内部问答 preset。**KnowEmp Nest 不用开**。适配层、15 个只读工具、vendorPolicy 抽取都在本目录 `adapter/`，由 Harness 进程内调用 TDS MCP 和飞书 Aily。

本 overlay 面向把问答助手交给其他用户：只挂 KnowEmp preset，并关掉编码 IDE 那一层界面。对话与会话列表保留；设置入口关掉。

## 启动

1. 本机 **TDS MCP** 已开（默认 `http://127.0.0.1:3988/mcp`）。这是 TDS 的 MCP，不是 KnowEmp。
2. 把环境变量写进仓库根目录 **`.env`**（或 `$DSH_HOME/.env`）。`dsh` 只读这两个文件，**不会**读 `.env.dev` / `.env.prod`。本地可先写好那两份模板，再用的时候拷成 `.env`。
3. 在 `deepseek-harness` 根目录：

```sh
# 开发（打开编码界面）：把 .env.dev 拷成 .env
# 上线（关掉编码界面）：把 .env.prod 拷成 .env
pnpm dsh web --patch ./knowemp-dsh/cordis.patch.yml
```

PowerShell 示例：

```powershell
Copy-Item .env.dev .env -Force
pnpm dsh web --patch ./knowemp-dsh/cordis.patch.yml
```

改完 patch 或 `.env` 后要重启这条命令，再强制刷新浏览器。`DEV_CHROME` 不是 `1` 时，新建会话只用 **KnowEmp 问答**。已经用标准/创造模式建过的会话仍带着当时的工具，让那些用户开新会话。

若本机以前在设置里把默认 preset 写成「标准模式」，新建会话会找不到它。打开 `$DSH_HOME/settings.yaml`（默认 `~/.dsh/settings.yaml`），删掉 `agent-presets.default`，或改成 `knowemp`。

## 环境变量

| 变量 | 说明 |
|---|---|
| `TDS_MCP_URL` | 默认 `http://127.0.0.1:3988/mcp` |
| `TDS_UNION_ID` | TDS 身份 |
| `FEISHU_APP_ID` / `FEISHU_APP_SECRET` / `AILY_APP_ID` / `AILY_SKILL_ID` | 知识库 |
| `AILY_FILE_BASE_URL` | 可选，切片里的 `file_` 转成图片地址 |
| `QWEN_BASE_URL` / `QWEN_MODEL` | vendorPolicy 抽取与检索词改写 |
| `DEV_CHROME` | 设为 `1` 时打开编码界面和官方 preset。`0`、不设或其它值都是上线形态。必须出现在 `.env` 里才会被读到 |

对话模型写在仓库根 `.env` 或 `$DSH_HOME/settings.yaml`。上线时应用内没有设置面板。

## 关掉的界面

| 关掉 | 原因 |
|---|---|
| 模式芯片、Agent Preset 设置页 | 不能切回标准/创造，也不能复制 preset |
| 文件树、终端、文档预览、Open in… | 工作区编码壳与右侧栏页面类型 |
| 目录选择器 | 不能再「添加工作区」；overlay 会把 cwd 登记成工作区；侧栏改成会话列表 |
| `/` `@` 斜杠命令、Skill、引用 | `/plan` `/model` `/permission` 等 |
| 权限档、Plan、Goal、Jobs、Subagent、Cordis、产物、Trajectory | 编码/编排表面 |
| 通用 / 模型 / 归档恢复、插件配置、插件清单 | 设置入口与内部页 |

KnowEmp 的 skill 仍由 preset 自动加载，只是输入框不再弹出 Skill 菜单。

关掉命令菜单后输入框加号消失。关掉目录选择器后，侧栏按会话列表显示（不再按文件夹分组），hero 工作区芯片也不会出现；打开页面会自动接上已有工作区，输入框可直接提问。关掉通用设置后底部「设置」消失。关掉文件树 / 终端 / 文档预览后，右侧栏展开按钮消失（引导页仍注册，因为 `ui-chat` 依赖 `sidebarRight`）。

右侧栏插件必须留着：`ui-chat` 依赖 `sidebarRight`，关掉会整页无对话。工作区浏览器也必须留着：侧栏会话列表由它渲染。

仍会看到：左侧新建会话 / 品牌、输入框上下文计量、DeepSeek 鱼标 hero。

## 结构

```text
knowemp-dsh/
  cordis.patch.yml
  ensure-workspace.ts         # 把 process.cwd() 登记成工作区
  sync-adapter.mjs            # 从 KnowEmp/server/src 再同步 adapter（可选）
  adapter/                    # Nest 已剥掉的 TDS/KMS 适配层与工具
  presets/knowemp/
    plugin.ts                 # defineTool 注册 15 个工具
    persona.txt
    skills/knowemp-qa/
```

KnowEmp 仓库有工具/映射改动时，在本目录执行 `node knowemp-dsh/sync-adapter.mjs`（可用 `KNOWEMP_ROOT` 指向 KnowEmp 路径）。

## 开发 / 上线界面

仓库根目录可以放 `.env.dev`（`DEV_CHROME=1`）和 `.env.prod`（`DEV_CHROME=0`）。启动前拷成 `.env`，`dsh` 才会读。改完后重启 `dsh web` 并强制刷新。

浏览器读不到 overlay 里的 Client `config`，所以用启动时的 `disabled: !!js` 开关插件名单。
