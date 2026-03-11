import { useTranslation } from 'react-i18next';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import type { CertInfo } from '../lib/ssl-trust';

interface CertTrustDialogProps {
  open: boolean;
  certInfo: CertInfo | null;
  isChanged: boolean;
  onTrust: () => void;
  onCancel: () => void;
}

export function CertTrustDialog({ open, certInfo, isChanged, onTrust, onCancel }: CertTrustDialogProps) {
  const { t } = useTranslation();

  if (!open || !certInfo) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      data-testid="cert-trust-dialog"
    >
      <div className="w-full max-w-md mx-4 rounded-lg border bg-background p-6 shadow-lg">
        <div className="flex items-center gap-2 mb-3">
          {isChanged ? (
            <ShieldAlert className="h-5 w-5 text-orange-500" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-blue-500" />
          )}
          <h2 className="text-lg font-semibold">
            {isChanged ? t('ssl.trust_dialog_changed_title') : t('ssl.trust_dialog_title')}
          </h2>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {isChanged ? t('ssl.trust_dialog_changed_description') : t('ssl.trust_dialog_description')}
        </p>

        <div className="space-y-2 rounded-md bg-muted p-3 text-xs">
          <div>
            <span className="font-medium">{t('ssl.cert_subject')}:</span>{' '}
            <span className="text-muted-foreground">{certInfo.subject}</span>
          </div>
          <div>
            <span className="font-medium">{t('ssl.cert_issuer')}:</span>{' '}
            <span className="text-muted-foreground">{certInfo.issuer}</span>
          </div>
          <div>
            <span className="font-medium">{t('ssl.cert_expiry')}:</span>{' '}
            <span className="text-muted-foreground">{certInfo.expiry}</span>
          </div>
          <div>
            <span className="font-medium">{t('ssl.cert_fingerprint')}:</span>
            <p className="mt-1 font-mono text-[10px] break-all text-muted-foreground leading-relaxed">
              {certInfo.fingerprint}
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
            onClick={onCancel}
            data-testid="cert-trust-cancel"
          >
            {t('ssl.reject_button')}
          </button>
          <button
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
            onClick={onTrust}
            data-testid="cert-trust-confirm"
          >
            {t('ssl.trust_button')}
          </button>
        </div>
      </div>
    </div>
  );
}
