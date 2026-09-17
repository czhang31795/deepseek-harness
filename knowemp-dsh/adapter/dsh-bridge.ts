import { ConfigService } from './nest-shim.ts'
import { LlmService } from './llm/llm.service'
import { VendorPolicyExtractor } from './agent/vendor-policy.extractor'
import { GetHostRecommendInfoTool } from './agent/tools/light-source/get-host-recommend-info.tool'
import { GetLightSourceApplicationCasesTool } from './agent/tools/light-source/get-light-source-application-cases.tool'
import { GetLightSourceFiltersTool } from './agent/tools/light-source/get-light-source-filters.tool'
import { GetLightSourceP2pTool } from './agent/tools/light-source/get-light-source-p2p.tool'
import { SearchLightSourcesTool } from './agent/tools/light-source/search-light-sources.tool'
import { AnalyzeMaterialFileChartTool } from './agent/tools/material/analyze-material-file-chart.tool'
import { ApplyMaterialFileAccessTool } from './agent/tools/material/apply-material-file-access.tool'
import { CompareMaterialsTool } from './agent/tools/material/compare-materials.tool'
import { GetMaterialDetailTool } from './agent/tools/material/get-material-detail.tool'
import { GetMaterialFiltersTool } from './agent/tools/material/get-material-filters.tool'
import { GetMaterialSupplierFiltersTool } from './agent/tools/material/get-material-supplier-filters.tool'
import { ListMaterialFilesTool } from './agent/tools/material/list-material-files.tool'
import { SearchMaterialSuppliersTool } from './agent/tools/material/search-material-suppliers.tool'
import { SearchMaterialsTool } from './agent/tools/material/search-materials.tool'
import { SearchKnowledgeTool } from './agent/tools/knowledge/search-knowledge.tool'
import { compactToolResultForLlm } from './agent/tools/compact-tool-result'
import { buildToolDescription, type AgentTool } from './agent/tools/tool.types'
import { KnowledgeQueryRewriter } from './legacy/systems/kms/knowledge-query.rewriter'
import { AilyKnowledgeClient } from './legacy/systems/kms/aily-knowledge.client'
import { FeishuTokenService } from './legacy/systems/kms/feishu-token.service'
import { KmsKnowledgeAdapter } from './legacy/systems/kms/kms-knowledge.adapter'
import { TdsClient } from './legacy/systems/tds/tds.client'
import { TdsLightSourceAdapter } from './legacy/systems/tds/tds-light-source.adapter'
import { TdsMaterialAdapter } from './legacy/systems/tds/tds-material.adapter'
import { LegacyFacade } from './legacy/legacy.facade'
import { LegacyRegistry } from './legacy/registry'
import type { RequestContext } from './common/types/request-context'

/** Duck-typed Nest ConfigService: KnowEmp clients only call `get(key)`. */
class EnvConfig {
  private readonly values: Record<string, string | undefined>

  constructor(values: Record<string, string | undefined> = {}) {
    this.values = values
  }

  get<T = string>(key: string): T | undefined {
    const value = this.values[key] ?? process.env[key]
    return (value === undefined || value === '' ? undefined : value) as T | undefined
  }
}

export interface KnowempBridgeTool {
  name: string
  description: string
  parameters: AgentTool['parameters']
  execute(input: Record<string, unknown>): Promise<unknown>
}

export interface KnowempBridgeOptions {
  env?: Record<string, string | undefined>
  requestContext?: RequestContext
}

/**
 * Wire KnowEmp's TDS/KMS adapters and 15 agent tools without booting Nest.
 * @param options - extra env values and the identity forwarded into TDS calls
 */
export function createKnowempBridge(options: KnowempBridgeOptions = {}): KnowempBridgeTool[] {
  const config = new EnvConfig(options.env) as unknown as ConstructorParameters<typeof TdsClient>[0]
  const requestContext: RequestContext = {
    userId: options.requestContext?.userId ?? process.env.TDS_UNION_ID,
    ...options.requestContext,
  }

  const tds = new TdsClient(config)
  const light = new TdsLightSourceAdapter(tds)
  const material = new TdsMaterialAdapter(tds)
  const tokens = new FeishuTokenService(config as never)
  const llm = new LlmService(config as never)
  const rewriter = new KnowledgeQueryRewriter(llm)
  const aily = new AilyKnowledgeClient(config as never, tokens, rewriter)
  const knowledge = new KmsKnowledgeAdapter(aily)

  const registry = new LegacyRegistry()
  registry.register({
    systemId: light.systemId,
    name: 'TDS数据系统',
    capabilities: ['light_source', 'material'],
  })
  registry.register({
    systemId: knowledge.systemId,
    name: 'KMS 知识管理系统',
    capabilities: ['knowledge'],
  })

  const facade = new LegacyFacade(registry, [], [light], [material], [knowledge])
  const vendorPolicy = new VendorPolicyExtractor(llm)
  const tools: AgentTool[] = [
    new GetLightSourceFiltersTool(facade, vendorPolicy),
    new SearchLightSourcesTool(facade),
    new GetLightSourceP2pTool(facade),
    new GetLightSourceApplicationCasesTool(facade),
    new GetHostRecommendInfoTool(facade),
    new GetMaterialFiltersTool(facade),
    new GetMaterialSupplierFiltersTool(facade),
    new SearchMaterialsTool(facade),
    new SearchMaterialSuppliersTool(facade),
    new GetMaterialDetailTool(facade),
    new CompareMaterialsTool(facade),
    new ListMaterialFilesTool(facade),
    new ApplyMaterialFileAccessTool(facade),
    new AnalyzeMaterialFileChartTool(facade),
    new SearchKnowledgeTool(facade),
  ]

  return tools.map((tool) => ({
    name: tool.name,
    description: buildToolDescription({
      description: tool.description,
      returns: tool.returns,
      notes: tool.notes,
      upstream: tool.upstream,
    }),
    parameters: tool.parameters,
    async execute(input: Record<string, unknown>) {
      const value = await tool.execute(input, requestContext)
      return toLosslessJson(compactToolResultForLlm(tool.name, value))
    },
  }))
}

/** Drop `undefined` and class instances so DSH can accept the value as lossless JSON. */
function toLosslessJson(value: unknown): unknown {
  if (value === undefined) return null
  try {
    return JSON.parse(JSON.stringify(value)) as unknown
  } catch (error) {
    return {
      error: 'tool_result_not_json',
      message: error instanceof Error ? error.message : String(error),
    }
  }
}
