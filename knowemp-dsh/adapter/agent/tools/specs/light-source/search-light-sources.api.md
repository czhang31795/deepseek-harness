# Tool API: `search_light_sources`

按短关键词 + 结构化条件检索光源列表。

## Upstream

| 项 | 值 |
|---|---|
| Path | `POST /tds/serve/lightSource` |
| Mode | `get_light_source_list` |
| 推荐 | 若传 `recommendHost`，先 `POST /tds/serve/lightSourceRecommend` `get_host_recommend_info` |

分页：`page_size = pageSize`，`page_token = (page - 1) * pageSize`。

## Request

常用字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `keyword` | `string` | TDS `target`，短词 |
| `colors` / `suppliers` / `massProduction` | `string[]` | `in` 过滤，取值来自 filters |
| `productPowerW` 等 | `{ min?, max? }` | `between` |
| `recommendHost` | `string` | 主机厂推荐过滤 |
| `lampType` | `hl` \| `sl` | 前灯 / 信号灯 |
| `market` | `out` \| `in` | 出口 / 国内 |
| `sort` | `{ field, order, nulls? }` | 见契约 enum |
| `page` / `pageSize` | `number` | 默认 1 / 5，pageSize ≤ 50 |
| `includeP2pSiblings` | `boolean` | 默认 false |

```json
{
  "keyword": "1515",
  "suppliers": ["OSRAM"],
  "productPowerW": { "min": 0.5, "max": 2 },
  "page": 1,
  "pageSize": 5
}
```

主机厂推荐示例：

```json
{
  "recommendHost": "某主机厂",
  "lampType": "hl",
  "market": "out",
  "pageSize": 20
}
```

## Response

`{ totals, page, pageSize, list, appliedRecommend? }`

`list[]` 字段见 `light-source-item.schema.ts`（camelCase 白名单）。

> 机器可读契约：`search-light-sources.contract.ts`  
> 字段翻译：`tds-mapping.json`
