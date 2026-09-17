import type { RequestContext } from '../../common/types/request-context';
import type {
  HostRecommendInfo,
  LightSourceApplicationCase,
  LightSourceFilters,
  LightSourceP2pResult,
  LightSourceSearchQuery,
  LightSourceSearchResult,
} from '../../domain/light-source';

export type { LightSourceSearchQuery };

export interface LightSourcePort {
  readonly systemId: string;
  getFilters(
    query: { includeVendorGuide?: boolean; ctx: RequestContext },
  ): Promise<LightSourceFilters>;
  search(query: LightSourceSearchQuery): Promise<LightSourceSearchResult>;
  getP2p(query: {
    pinToPin: string;
    lightColor?: string;
    ctx: RequestContext;
  }): Promise<LightSourceP2pResult>;
  getApplicationCases(query: {
    model: string;
    ctx: RequestContext;
  }): Promise<{ list: LightSourceApplicationCase[] }>;
  getHostRecommendInfo(query: {
    host?: string;
    ctx: RequestContext;
  }): Promise<HostRecommendInfo>;
}

export const LIGHT_SOURCE_PORTS = Symbol('LIGHT_SOURCE_PORTS');
