import { useState } from 'react';
import { Shield, X } from 'lucide-react';
import {
  denyGA4Consent,
  getGA4Consent,
  grantGA4Consent,
  isGA4Configured,
  revokeGA4Consent,
  type GA4ConsentState,
} from '../services/ga4';

/**
 * GA4 consent banner (GDPR/CCPA-friendly).
 *
 * Behavior:
 *  - Renders nothing unless GA4 is actually configured (VITE_GA4_ENABLED &&
 *    a measurement ID). Your first-party analytics is unaffected by this.
 *  - While consent is pending, shows a blocking bottom banner.
 *  - Once answered/dismissed, a discreet "الخصوصية" pill stays available so
 *    the visitor can re-open the panel and revoke (or re-grant) at any time.
 *  - GA4 never loads (no Google request at all) until the visitor grants.
 */
export function AnalyticsConsentBanner() {
  const [consent, setConsent] = useState<GA4ConsentState>(getGA4Consent());
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  if (!isGA4Configured()) return null;

  const showBanner = consent === 'pending' && !bannerDismissed;

  const handleGrant = () => {
    grantGA4Consent();
    setConsent('granted');
    setBannerDismissed(true);
    setPanelOpen(false);
  };

  const handleDeny = () => {
    denyGA4Consent();
    setConsent('denied');
    setBannerDismissed(true);
    setPanelOpen(false);
  };

  const handleRevoke = () => {
    revokeGA4Consent();
    setConsent('denied');
    setPanelOpen(false);
  };

  return (
    <>
      {showBanner && (
        <div
          role="dialog"
          aria-live="polite"
          aria-label="إعدادات الخصوصية"
          className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-card text-card-foreground shadow-lg"
        >
          <div className="mx-auto max-w-7xl px-4 py-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Shield className="h-4 w-4" aria-hidden="true" />
              </span>
              <p className="text-sm leading-relaxed text-foreground">
                نستخدم <strong>تحليلات جوجل (Google Analytics)</strong> لتحسين
                تجربة الخدمة. البيانات مجهولة الهوية ولا تُستخدم للإعلانات.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleDeny}
                className="rounded-lg border border-border bg-muted px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                أرفض
              </button>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                className="rounded-lg border border-border bg-muted px-3.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                لاحقًا
              </button>
              <button
                type="button"
                onClick={handleGrant}
                className="rounded-lg bg-primary px-3.5 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                أوافق
              </button>
            </div>
          </div>
        </div>
      )}

      {!showBanner && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          aria-label="إعدادات الخصوصية"
          title="إعدادات الخصوصية"
          className="fixed bottom-4 left-4 z-[60] flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-muted-foreground shadow-md transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Shield className="h-4 w-4" aria-hidden="true" />
          <span>الخصوصية</span>
        </button>
      )}

      {!showBanner && panelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="إعدادات الخصوصية"
          className="fixed bottom-16 left-4 z-[60] w-72 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-xl"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold text-foreground">
              إعدادات الخصوصية
            </h2>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              aria-label="إغلاق"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {consent === 'granted'
              ? 'حاليًا، يسمح متصفحك بتحليلات جوجل لقياس الأداء. يمكنك إيقاف التتبع في أي وقت.'
              : 'تحليلات جوجل معطلة. يمكنك تفعيلها لمشاركة إحصائيات استخدام مجهولة الهوية لتحسين الخدمة.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {consent !== 'granted' ? (
              <button
                type="button"
                onClick={handleGrant}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                تفعيل التتبع
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRevoke}
                className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20"
              >
                إيقاف التتبع
              </button>
            )}
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </>
  );
}