import {
  LIGHT_SOURCE_DEFAULT_PAGE_SIZE,
  type LightSourceSearchQuery,
  type NumberRange,
} from '../../../domain/light-source';
import { LegacyFacade } from '../../../legacy/legacy.facade';
import { SEARCH_LIGHT_SOURCES_CONTRACT } from '../specs/light-source/search-light-sources.contract';
import type { AgentTool } from '../tool.types';
import { toolFromContract } from '../tool.types';

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
}

function asRange(value: unknown): NumberRange | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const rec = value as Record<string, unknown>;
  const min = rec.min == null || rec.min === '' ? undefined : Number(rec.min);
  const max = rec.max == null || rec.max === '' ? undefined : Number(rec.max);
  const out: NumberRange = {};
  if (min != null && Number.isFinite(min)) out.min = min;
  if (max != null && Number.isFinite(max)) out.max = max;
  return out.min == null && out.max == null ? undefined : out;
}

export class SearchLightSourcesTool implements AgentTool {
  readonly name: AgentTool['name'];
  readonly description: AgentTool['description'];
  readonly parameters: AgentTool['parameters'];
  readonly returns: AgentTool['returns'];
  readonly notes?: AgentTool['notes'];
  readonly upstream = SEARCH_LIGHT_SOURCES_CONTRACT.upstream;

    private readonly legacy: LegacyFacade
  constructor(
    legacy: LegacyFacade
  ) {
    this.legacy = legacy

    const base = toolFromContract(SEARCH_LIGHT_SOURCES_CONTRACT, (input) =>
      this.run(input),
    );
    this.name = base.name;
    this.description = base.description;
    this.parameters = base.parameters;
    this.returns = base.returns;
    this.notes = base.notes;
  }

  execute(input: Record<string, unknown>): Promise<unknown> {
    return this.run(input);
  }

  private run(input: Record<string, unknown>): Promise<unknown> {
    const sortRaw =
      input.sort && typeof input.sort === 'object' && !Array.isArray(input.sort)
        ? (input.sort as Record<string, unknown>)
        : undefined;
    const query: LightSourceSearchQuery = {
      keyword: input.keyword != null ? String(input.keyword).trim() : undefined,
      colors: asStringArray(input.colors),
      suppliers: asStringArray(input.suppliers),
      massProduction: asStringArray(input.massProduction),
      luminousAngles: asNumberArray(input.luminousAngles),
      models: asStringArray(input.models),
      consumePowerW: asRange(input.consumePowerW),
      productPowerW: asRange(input.productPowerW),
      fluxMaxLm: asRange(input.fluxMaxLm),
      fluxMinLm: asRange(input.fluxMinLm),
      fluxTypicalLm: asRange(input.fluxTypicalLm),
      lengthMm: asRange(input.lengthMm),
      widthMm: asRange(input.widthMm),
      heightMm: asRange(input.heightMm),
      maxTjC: asRange(input.maxTjC),
      recommendHost:
        input.recommendHost != null ? String(input.recommendHost).trim() : undefined,
      lampType: input.lampType === 'hl' || input.lampType === 'sl' ? input.lampType : undefined,
      market: input.market === 'out' || input.market === 'in' ? input.market : undefined,
      sort: sortRaw
        ? {
            field: sortRaw.field != null ? String(sortRaw.field) : undefined,
            order: sortRaw.order === 'asc' || sortRaw.order === 'desc' ? sortRaw.order : undefined,
            nulls:
              sortRaw.nulls === 'first' || sortRaw.nulls === 'last'
                ? sortRaw.nulls
                : undefined,
          }
        : undefined,
      page: Number(input.page) || 1,
      pageSize: Number(input.pageSize) || LIGHT_SOURCE_DEFAULT_PAGE_SIZE,
      includeP2pSiblings: Boolean(input.includeP2pSiblings),
      ctx: {},
    };
    return this.legacy.searchLightSources(query);
  }
}
