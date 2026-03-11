import type { CertInfo } from './ssl-trust';

export interface PendingCertTrust {
  profileId: string;
  certInfo: CertInfo;
}

type CertTrustListener = (pending: PendingCertTrust) => void;

let listener: CertTrustListener | null = null;

/**
 * Called by bootstrap when self-signed certs are enabled but no fingerprint is stored.
 * The UI component listens via onCertTrustRequest and shows the TOFU dialog.
 */
export function requestCertTrust(profileId: string, certInfo: CertInfo): void {
  listener?.({ profileId, certInfo });
}

/**
 * Register a listener for cert trust requests. Returns a cleanup function.
 */
export function onCertTrustRequest(fn: CertTrustListener): () => void {
  listener = fn;
  return () => { listener = null; };
}
