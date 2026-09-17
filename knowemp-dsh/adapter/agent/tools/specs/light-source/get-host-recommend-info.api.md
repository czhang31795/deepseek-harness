# Tool API: `get_host_recommend_info`

查主机厂前灯 / 信号灯、出口 / 国内的推荐品牌和额外推荐型号。

## Upstream

| 项 | 值 |
|---|---|
| Path | `POST /tds/serve/lightSourceRecommend` |
| Mode | `get_host_recommend_info` |
| 兜底 | `get_light_source_recommend_list`（原始串需 Adapter 解析，不要回给模型） |

## Request

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `host` | `string` | 否 | 不传返回全部；传了则 Adapter 做包含匹配 |

```json
{ "host": "某主机厂" }
```

## Response

```ts
{
  hosts: string[];
  list: Array<{
    no?: number;
    host: string;
    hl: { out: Side; in: Side }; // 前灯
    sl: { out: Side; in: Side }; // 信号灯
  }>;
}

type Side = {
  brands: string[];
  extraModels: Array<{ brand: string; models: string[] }>;
};
```

`out` = 出口，`in` = 国内。

拿到品牌后可用 `search_light_sources`：`recommendHost` + `lampType` + `market`。

> 机器可读契约：`get-host-recommend-info.contract.ts`
