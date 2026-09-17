# Tool API: `get_light_source_application_cases`

按光源型号查应用项目实例。

## Upstream

| 项 | 值 |
|---|---|
| Path | `POST /tds/serve/lightSource` |
| Mode | `get_application_case_by_code` |
| Body | `target` ← `model`（`like %model%`） |

## Request

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `model` | `string` | 是 | 用列表返回的 `productModel` |

```json
{ "model": "A1VB-A588B" }
```

## Response

`list[]`：

| 字段 | 来源 |
|---|---|
| `hostManufacturer` | `host_manufacturer` |
| `projectName` | `project_name` |
| `projectCode` | `project_code` |
| `lightSourceModel` | `light_source_model` |
| `lightSourceModelCount` | `light_source_model_count` |
| `lightSourceFluxDetail` | `light_source_flux_detail` |
| `totalLuminousFlux` | `total_luminous_flux` |
| `carPics[]` | `{ token, fileName, fileUrl }` |

> 机器可读契约：`get-light-source-application-cases.contract.ts`
