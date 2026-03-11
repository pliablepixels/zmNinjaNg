import { WebPlugin } from '@capacitor/core';
import type { CertInfo, SSLTrustPlugin } from './definitions';

export class SSLTrustWeb extends WebPlugin implements SSLTrustPlugin {
  async enable(): Promise<void> {
    // No-op on web — browsers handle their own certificate validation
  }

  async disable(): Promise<void> {
    // No-op on web
  }

  async isEnabled(): Promise<{ enabled: boolean }> {
    return { enabled: false };
  }

  async setTrustedFingerprint(_options: { fingerprint: string | null }): Promise<void> {
    // No-op on web
  }

  async getServerCertFingerprint(_options: { url: string }): Promise<CertInfo> {
    throw new Error('Certificate fingerprint retrieval is not available on web');
  }
}
