import { Logger } from '../../../nest-shim.ts'
import type { RequestContext } from '../../../common/types/request-context';
import {
  MATERIAL_DEFAULT_PAGE_SIZE,
  type MaterialSearchQuery,
} from '../../../domain/material';
import { LegacyFacade } from '../../../legacy/legacy.facade';
import { SEARCH_MATERIALS_CONTRACT } from '../specs/material/search-materials.contract';
import type { AgentTool } from '../tool.types';
import { toolFromContract } from '../tool.types';
import {
  materialSearchHasHits,
  materialSearchKey,
  relaxMaterialSearchQuery,
  rewriteMaterialSearchQuery,
} from './material-search-rewrite';

export class SearchMaterialsTool implements AgentTool {
  readonly name: AgentTool['name'];
  readonly description: AgentTool['description'];
  readonly parameters: AgentTool['parameters'];
  readonly returns: AgentTool['returns'];
  readonly notes?: AgentTool['notes'];
  readonly upstream = SEARCH_MATERIALS_CONTRACT.upstream;
  private readonly logger = new Logger(SearchMaterialsTool.name);

    private readonly legacy: LegacyFacade
  constructor(
    legacy: LegacyFacade
  ) {
    this.legacy = legacy

    const base = toolFromContract(SEARCH_MATERIALS_CONTRACT, (input, ctx) =>
      this.run(input, ctx),
    );
    this.name = base.name;
    this.description = base.description;
    this.parameters = base.parameters;
    this.returns = base.returns;
    this.notes = base.notes;
  }

  execute(input: Record<string, unknown>, ctx?: RequestContext): Promise<unknown> {
    return this.run(input, ctx);
  }

  private async run(
    input: Record<string, unknown>,
    ctx?: RequestContext,
  ): Promise<unknown> {
    let query: MaterialSearchQuery = {
      keyword: asTrimmed(input.keyword),
      rawType: asTrimmed(input.rawType),
      materialName: asTrimmed(input.materialName),
      spec: asTrimmed(input.spec),
      color: asTrimmed(input.color),
      page: Number(input.page) || 1,
      pageSize: Number(input.pageSize) || MATERIAL_DEFAULT_PAGE_SIZE,
      ctx: ctx ?? {},
    };
    if (query.rawType) {
      try {
        const filters = await this.legacy.getMaterialFilters({
          rawType: query.rawType,
          ctx: query.ctx,
        });
        query = rewriteMaterialSearchQuery(query, filters);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(`材料筛选项读取失败，按原条件检索：${message}`);
        query = rewriteMaterialSearchQuery(query);
      }
    } else {
      query = rewriteMaterialSearchQuery(query);
    }

    const seen = new Set<string>([materialSearchKey(query)]);
    let result = await this.legacy.searchMaterials(query);
    while (!materialSearchHasHits(result)) {
      const relaxed = relaxMaterialSearchQuery(query);
      if (!relaxed) break;
      const key = materialSearchKey(relaxed);
      if (seen.has(key)) break;
      this.logger.log(
        `材料检索放宽 ${materialSearchKey(query)} -> ${key}`,
      );
      seen.add(key);
      query = relaxed;
      result = await this.legacy.searchMaterials(query);
    }
    return result;
  }
}

function asTrimmed(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}
