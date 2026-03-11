export interface CertInfo {
  fingerprint: string; // SHA-256, colon-separated uppercase hex
  subject: string;
  issuer: string;
  expiry: string;
}

export interface SSLTrustPlugin {
  enable(): Promise<void>;
  disable(): Promise<void>;
  isEnabled(): Promise<{ enabled: boolean }>;
  setTrustedFingerprint(options: { fingerprint: string | null }): Promise<void>;
  getServerCertFingerprint(options: { url: string }): Promise<CertInfo>;
}
