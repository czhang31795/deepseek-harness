import { Logger, ConfigService } from '../../../nest-shim.ts'

interface CachedToken {
  token: string;
  expireAt: number;
}

export class FeishuTokenService {
  private readonly logger = new Logger(FeishuTokenService.name);
  private cache?: CachedToken;

    private readonly config: ConfigService
  constructor(
    config: ConfigService
  ) {
    this.config = config
}

  get configured(): boolean {
    return Boolean(this.appId && this.appSecret);
  }

  async getTenantAccessToken(): Promise<string> {
    if (!this.appId || !this.appSecret) {
      throw new Error('未配置 FEISHU_APP_ID / FEISHU_APP_SECRET');
    }
    const now = Date.now();
    if (this.cache && this.cache.expireAt > now + 60_000) {
      return this.cache.token;
    }
    const res = await fetch(`${this.openBase}/open-apis/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        app_id: this.appId,
        app_secret: this.appSecret,
      }),
    });
    const json = (await res.json()) as {
      code?: number;
      msg?: string;
      tenant_access_token?: string;
      expire?: number;
    };
    if (json.code !== 0 || !json.tenant_access_token) {
      this.logger.warn(`飞书 tenant_access_token 失败 code=${json.code}`);
      throw new Error(json.msg || '获取飞书 tenant_access_token 失败');
    }
    const ttlSec = Number(json.expire) || 7200;
    this.cache = {
      token: json.tenant_access_token,
      expireAt: now + ttlSec * 1000,
    };
    return json.tenant_access_token;
  }

  private get appId(): string {
    return (this.config.get<string>('FEISHU_APP_ID') ?? '').trim();
  }

  private get appSecret(): string {
    return (this.config.get<string>('FEISHU_APP_SECRET') ?? '').trim();
  }

  private get openBase(): string {
    return (
      this.config.get<string>('FEISHU_OPEN_BASE_URL') ?? 'https://open.feishu.cn'
    ).replace(/\/$/, '');
  }
}
