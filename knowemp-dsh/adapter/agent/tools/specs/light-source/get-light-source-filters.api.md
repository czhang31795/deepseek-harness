# Tool API: `get_light_source_filters`

获取光学光源库筛选项、数值范围、主机厂/供应商、侧栏厂商说明。

## Upstream

Adapter 一次调用，内部打 4 个 TDS mode：

| Path | Mode |
|---|---|
| `POST /tds/serve/lightSource` | `get_basic_filter_info` |
| 同上 | `get_apply_filter_info` |
| 同上 | `get_host_filter_info` |
| 同上 | `get_vendor_guide` |

## Request

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `includeVendorGuide` | `boolean` | 否 | 默认 `true` |

```json
{ "includeVendorGuide": true }
```

## Response

| 字段 | 说明 |
|---|---|
| `colors[]` | 光色。`options[].value` 传给 `search_light_sources.colors` |
| `ranges` | 功率/光通量/尺寸/Tj 的全局 min/max |
| `massProduction` | 是否已量产可选值 |
| `luminousAngles` | 发光角度可选值 |
| `hosts` | 主机厂名单 |
| `suppliers[]` | `{ name, category }`（已去掉冗长 hosts） |
| `vendorPolicy` | 场景政策包：`brands`（检索）+ `constraints`（可量化条件）+ `questions`（缺信息追问）+ `rules`（无法量化的原文）。LLM 抽取并缓存 |
| `vendorGuide[]` | `{ title, content, updateTime }` 侧栏原文，供核对 |
| `brandAliases` | 厂名身份对照（中文 → 库内名），**不是**优先级 |

> 机器可读契约：`get-light-source-filters.contract.ts`
