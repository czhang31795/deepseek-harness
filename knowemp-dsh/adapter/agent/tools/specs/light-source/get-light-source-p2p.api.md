# Tool API: `get_light_source_p2p`

按 PIN-TO-PIN 编码查封装兼容 / 近似光源。

## Upstream

| 项 | 值 |
|---|---|
| Path | `POST /tds/serve/lightSource` |
| Mode | `get_light_source_p2p_list` |
| Body | `p2p` ← `pinToPin`；可选 `PRODUCTLIGHTCOLOR` ← `lightColor` |

## Request

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `pinToPin` | `string` | 是 | 来自 `search_light_sources` 行的 `pinToPin` |
| `lightColor` | `string` | 否 | 按光色再过滤 |

```json
{ "pinToPin": "XXXX-1" }
```

## Response

| 字段 | 说明 |
|---|---|
| `list[]` | 同光源白名单，另含 `p2pMatch`：`1` 完全相同，`2` 近封装 |
| `colors[]` | 这些行里出现过的光色 |

> 机器可读契约：`get-light-source-p2p.contract.ts`
