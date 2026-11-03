import type { RemoteConfig } from 'firebase-admin/remote-config';
import type { MinVersionSource } from './source.ts';
import { AppVersion } from './version.ts';

export interface RemoteConfigTemplateLike {
  parameters?: Record<string, {
    defaultValue?: { value?: string } | unknown;
  }>;
}

export interface RemoteConfigClientLike {
  getTemplate(): Promise<RemoteConfigTemplateLike>;
}

/**
 * Live min version source reading the `min_supported_version` parameter
 * from Firebase Remote Config (design §4.1). If the fetch fails, preserves the last good value.
 */
export class RemoteConfigMinVersionSource implements MinVersionSource {
  private readonly rc: RemoteConfigClientLike;
  private lastGood: string;

  constructor(rc: RemoteConfig | RemoteConfigClientLike, initialVersion = '0.1.0') {
    this.rc = rc as RemoteConfigClientLike;
    this.lastGood = initialVersion;
  }

  async getMinVersion(): Promise<string> {
    try {
      const template = await this.rc.getTemplate();
      const param = template.parameters?.['min_supported_version'];
      const def = param?.defaultValue;
      if (
        def &&
        typeof def === 'object' &&
        'value' in def &&
        typeof def.value === 'string' &&
        AppVersion.safeParse(def.value.trim()).success
      ) {
        this.lastGood = def.value.trim();
      }
    } catch {
      // If it fails, keep the last good value.
    }
    return this.lastGood;
  }
}

