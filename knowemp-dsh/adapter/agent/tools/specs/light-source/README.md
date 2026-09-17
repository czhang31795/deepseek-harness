# 光学光源库 AI Tools（待接入规格）

KnowEmp 给 Agent 用的 **5 个只读 Tool** 契约与实现。

已注册到 `ToolRegistry`，Agent 会按 function calling 选择调用。

## 文件

| 文件 | 用途 |
|---|---|
| `*.contract.ts` | 机器可读契约（parameters / returns），OpenAI tools 的数据源 |
| `*.api.md` | 人类可读说明 |
| `index.ts` | 导出 5 个契约 + `toLightSourceOpenAiTools()` |
| `openai-tools.json` | 可直接贴进其它 LLM 的 function calling 定义 |
| `tds-mapping.json` | Tool 参数 → TDS POST body 的翻译表 |
| `light-source-item.schema.ts` | 光源行白名单字段 |

## 五个工具

| name | 何时用 | 上游 |
|---|---|---|
| `get_light_source_filters` | 先拿光色/供应商/功率范围/主机厂 | `lightSource` 四个 mode 合并 |
| `search_light_sources` | 查光源列表 | `get_light_source_list`；推荐时再调 `get_host_recommend_info` |
| `get_light_source_p2p` | 查 PIN-TO-PIN 替代件 | `get_light_source_p2p_list` |
| `get_light_source_application_cases` | 查落地项目/实车图 | `get_application_case_by_code` |
| `get_host_recommend_info` | 某主机厂推荐哪些品牌 | `get_host_recommend_info` |

## 建议调用顺序

1. 用户问「有哪些光色/供应商/功率范围」或「出口/国内推荐厂商型号」→ `get_light_source_filters`（读本次抽取的 `vendorPolicy`）
2. 按匹配场景的 `vendorPolicy.brands[].supplier` + `rank` 用 `search_light_sources.suppliers` 列型号
3. 用户问「某主机厂前灯用哪家」→ `get_host_recommend_info`（主机厂白名单，不要和侧栏出口政策混用）
4. 列出具体型号也可带 `recommendHost` + `lampType`
5. 问兼容封装 → `get_light_source_p2p`（`pinToPin` 必须来自列表行）
6. 问用在哪个项目 → `get_light_source_application_cases`

## 接入 KnowEmp

实现位置：

- Adapter：`src/legacy/systems/tds/tds-light-source.adapter.ts`
- Tool：`src/agent/tools/light-source/*.tool.ts`
- 注册：`ToolRegistry` / `AgentModule`

**不要**把价格对比写入、config 写入、推荐表 CRUD 暴露给 Agent。

## 不要做的事

- 不要让模型直接拼 TDS `filters` 三元组（没有列名白名单，会进 SQL）。
- 不要把 `SELECT *` 整行回给模型，只用 `light-source-item.schema.ts`。
- `page_token` 是 offset：`page_token = (page - 1) * pageSize`。
