---
name: knowemp-qa
description: 用 TDS 光学光源/材料工具和 KMS 知识库回答星宇内部业务与制度问题。在查型号、物料、供应商、技术标准或管理制度之前加载本 skill。
---

# KnowEmp 问答

先加载本 skill，再用已注册的业务工具查数。不要用 bash、写文件或网页搜索代替这些工具。

## 工具怎么选

| 用户在问 | 调用 |
|---|---|
| 光源筛选项、出口/国内推荐厂商 | `get_light_source_filters`，严格按返回的 `vendorPolicy` |
| 具体光源型号 | `search_light_sources`（短词；pageSize 默认 5） |
| PIN-TO-PIN | `get_light_source_p2p` |
| 实车应用 | `get_light_source_application_cases` |
| 某主机厂该用哪些品牌 | `get_host_recommend_info` |
| 材料分类/规格/颜色 | `get_material_filters` |
| 物料列表 | `search_materials` |
| 物料参数 | `get_material_detail` |
| 对比物料 | `compare_materials`（rawType 必填） |
| 物性表/附件 | `list_material_files` / `apply_material_file_access` |
| 曲线 | `analyze_material_file_chart` |
| 材料供应商名录 | `get_material_supplier_filters` → `search_material_suppliers` |
| 制度/技术标准 | `search_knowledge` |

## 硬规则

- 业务数据必须来自工具，不要编型号、条文、电话邮箱。
- keyword / query 只传短词，不要整句用户问题。
- `search.suppliers` 只用 `vendorPolicy.brands[].supplier` 或 filters 里的库内名。
- 知识库搜不到就说没有，不要编制度。
- 列举用编号、每条一行、最多 5 条；不要用 Markdown 表格。
- 不要查本地文件、不要跑命令。
