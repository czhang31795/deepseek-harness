
/** 业务系统注册信息；后续可改为配置驱动 */
export interface LegacySystemMeta {
  systemId: string;
  name: string;
  capabilities: string[];
}

export class LegacyRegistry {
  private readonly systems = new Map<string, LegacySystemMeta>();

  register(meta: LegacySystemMeta): void {
    this.systems.set(meta.systemId, meta);
  }

  get(systemId: string): LegacySystemMeta | undefined {
    return this.systems.get(systemId);
  }

  list(): LegacySystemMeta[] {
    return [...this.systems.values()];
  }

  findByCapability(capability: string): LegacySystemMeta[] {
    return this.list().filter((s) => s.capabilities.includes(capability));
  }
}
