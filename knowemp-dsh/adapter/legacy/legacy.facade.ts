import { NotFoundException } from '../nest-shim.ts'
import type { RequestContext } from '../common/types/request-context';
import type {
  HostRecommendInfo,
  LightSourceApplicationCase,
  LightSourceFilters,
  LightSourceP2pResult,
  LightSourceSearchQuery,
  LightSourceSearchResult,
} from '../domain/light-source';
import type {
  MaterialCompareQuery,
  MaterialCompareResult,
  MaterialDetailQuery,
  MaterialDetailView,
  MaterialFileApplyQuery,
  MaterialFileApplyResult,
  MaterialFileChartQuery,
  MaterialFileChartResult,
  MaterialFileListQuery,
  MaterialFileListResult,
  MaterialFilters,
  MaterialFiltersQuery,
  MaterialSearchQuery,
  MaterialSearchResult,
  MaterialSupplierFilters,
  MaterialSupplierFiltersQuery,
  MaterialSupplierSearchQuery,
  MaterialSupplierSearchResult,
} from '../domain/material';
import type {
  KnowledgeSearchQuery,
  KnowledgeSearchResult,
} from '../domain/knowledge';
import type { OrderView } from '../domain/order';
import {
  LIGHT_SOURCE_PORTS,
  type LightSourcePort,
} from './contracts/light-source.port';
import {
  MATERIAL_PORTS,
  type MaterialPort,
} from './contracts/material.port';
import {
  KNOWLEDGE_PORTS,
  type KnowledgePort,
} from './contracts/knowledge.port';
import { ORDER_PORTS, type OrderPort } from './contracts/order.port';
import { LegacyRegistry } from './registry';

export class LegacyFacade {
    private readonly registry: LegacyRegistry
  private readonly orderPorts: OrderPort[]
  private readonly lightSourcePorts: LightSourcePort[]
  private readonly materialPorts: MaterialPort[]
  private readonly knowledgePorts: KnowledgePort[]
  constructor(
    registry: LegacyRegistry,
    orderPorts: OrderPort[],
    lightSourcePorts: LightSourcePort[],
    materialPorts: MaterialPort[],
    knowledgePorts: KnowledgePort[]
  ) {
    this.registry = registry
    this.orderPorts = orderPorts
    this.lightSourcePorts = lightSourcePorts
    this.materialPorts = materialPorts
    this.knowledgePorts = knowledgePorts
}

  listSystems() {
    return this.registry.list();
  }

  async findOrder(
    orderNo: string,
    ctx: RequestContext = {},
  ): Promise<OrderView | null> {
    const ports = this.resolvePorts(this.orderPorts, ctx, 'order');
    for (const port of ports) {
      const hit = await port.findByOrderNo({ orderNo, ctx });
      if (hit) return hit;
    }
    return null;
  }

  async getLightSourceFilters(
    input: { includeVendorGuide?: boolean; ctx?: RequestContext } = {},
  ): Promise<LightSourceFilters> {
    const ctx = input.ctx ?? {};
    return this.lightSource(ctx).getFilters({
      includeVendorGuide: input.includeVendorGuide,
      ctx,
    });
  }

  async searchLightSources(
    query: LightSourceSearchQuery,
  ): Promise<LightSourceSearchResult> {
    return this.lightSource(query.ctx).search(query);
  }

  async getLightSourceP2p(query: {
    pinToPin: string;
    lightColor?: string;
    ctx?: RequestContext;
  }): Promise<LightSourceP2pResult> {
    const ctx = query.ctx ?? {};
    return this.lightSource(ctx).getP2p({
      pinToPin: query.pinToPin,
      lightColor: query.lightColor,
      ctx,
    });
  }

  async getLightSourceApplicationCases(query: {
    model: string;
    ctx?: RequestContext;
  }): Promise<{ list: LightSourceApplicationCase[] }> {
    const ctx = query.ctx ?? {};
    return this.lightSource(ctx).getApplicationCases({
      model: query.model,
      ctx,
    });
  }

  async getHostRecommendInfo(
    query: {
      host?: string;
      ctx?: RequestContext;
    } = {},
  ): Promise<HostRecommendInfo> {
    const ctx = query.ctx ?? {};
    return this.lightSource(ctx).getHostRecommendInfo({
      host: query.host,
      ctx,
    });
  }

  async getMaterialFilters(
    query: Omit<MaterialFiltersQuery, 'ctx'> & { ctx?: RequestContext } = {},
  ): Promise<MaterialFilters> {
    const ctx = query.ctx ?? {};
    return this.material(ctx).getFilters({
      rawType: query.rawType,
      materialName: query.materialName,
      spec: query.spec,
      color: query.color,
      ctx,
    });
  }

  async searchMaterials(query: MaterialSearchQuery): Promise<MaterialSearchResult> {
    return this.material(query.ctx).search(query);
  }

  async getMaterialDetail(query: MaterialDetailQuery): Promise<MaterialDetailView> {
    return this.material(query.ctx).getDetail(query);
  }

  async compareMaterials(query: MaterialCompareQuery): Promise<MaterialCompareResult> {
    return this.material(query.ctx).compare(query);
  }

  async listMaterialFiles(query: MaterialFileListQuery): Promise<MaterialFileListResult> {
    return this.material(query.ctx).listFiles(query);
  }

  async analyzeMaterialFileChart(
    query: MaterialFileChartQuery,
  ): Promise<MaterialFileChartResult> {
    return this.material(query.ctx).analyzeFileChart(query);
  }

  async applyMaterialFileAccess(
    query: MaterialFileApplyQuery,
  ): Promise<MaterialFileApplyResult> {
    return this.material(query.ctx).applyFileAccess(query);
  }

  async getMaterialSupplierFilters(
    query: Omit<MaterialSupplierFiltersQuery, 'ctx'> & { ctx?: RequestContext } = {},
  ): Promise<MaterialSupplierFilters> {
    const ctx = query.ctx ?? {};
    return this.material(ctx).getSupplierFilters({ ctx });
  }

  async searchMaterialSuppliers(
    query: MaterialSupplierSearchQuery,
  ): Promise<MaterialSupplierSearchResult> {
    return this.material(query.ctx).searchSuppliers(query);
  }

  async searchKnowledge(
    query: KnowledgeSearchQuery,
  ): Promise<KnowledgeSearchResult> {
    return this.knowledge(query.ctx).search(query);
  }

  private lightSource(ctx: RequestContext): LightSourcePort {
    return this.resolvePorts(this.lightSourcePorts, ctx, 'light_source')[0];
  }

  private material(ctx: RequestContext): MaterialPort {
    return this.resolvePorts(this.materialPorts, ctx, 'material')[0];
  }

  private knowledge(ctx?: RequestContext): KnowledgePort {
    return this.resolvePorts(this.knowledgePorts, ctx ?? {}, 'knowledge')[0];
  }

  private resolvePorts<T extends { systemId: string }>(
    ports: T[],
    ctx: RequestContext,
    capability: string,
  ): T[] {
    if (ctx.systemId) {
      const matched = ports.filter((p) => p.systemId === ctx.systemId);
      if (!matched.length) {
        throw new NotFoundException(
          `系统 ${ctx.systemId} 未注册 ${capability} 能力`,
        );
      }
      return matched;
    }

    const candidates = this.registry.findByCapability(capability);
    const allowed = new Set(candidates.map((c) => c.systemId));
    const resolved = ports.filter((p) => allowed.has(p.systemId));
    if (!resolved.length) {
      throw new NotFoundException(`没有可用的 ${capability} 数据源`);
    }
    return resolved;
  }
}
