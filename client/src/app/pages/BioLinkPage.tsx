import { useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  House,
  Presentation,
  Music,
  LayoutGrid,
  Images,
  BookOpen,
  Facebook,
  Youtube,
  Mail,
  Share2,
  Copy,
  ChevronLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import logoImg512 from '../../assets/church-logo-512.webp';
import { cn } from '../utils/cn';
import { trackEvent } from '../services/analytics';

const PAGE_DESCRIPTION =
  'روابط سريعة لجميع خدمات موقع خدمة الأرشيدياكون حبيب جرجس والتواصل معنا.';

// Static link data lives outside the component so it is never recreated on re-render.
const quickLinks = [
  { to: '/', icon: House, title: 'خدمة الأرشيدياكون حبيب جرجس', desc: 'الصفحة الرئيسية' },
  { to: '/liturgy', icon: Presentation, title: 'بوربوينت الليتورجية', desc: 'صلوات القداس والطقوس' },
  { to: '/hymns', icon: Music, title: 'مكتبة الترانيم', desc: 'كلمات وألحان مسيحية' },
  { to: '/various', icon: LayoutGrid, title: 'بوربوينت متنوعة', desc: 'شرائح متنوعة للعرض' },
  { to: '/images', icon: Images, title: 'مكتبة الصور', desc: 'مكتبة صور قبطية عالية الجودة' },
  { to: '/sayings', icon: BookOpen, title: 'أقوال الآباء', desc: 'حكم وأقوال روحية' },
] as const;

const socialLinks = [
  { href: 'https://www.facebook.com/archdeaconhabibgerges', icon: Facebook, label: 'فيسبوك' },
  { href: 'https://www.youtube.com/@archdeaconhabibgerges', icon: Youtube, label: 'يوتيوب' },
  { href: 'mailto:archdeaconhabibgerges@gmail.com', icon: Mail, label: 'البريد الإلكتروني' },
] as const;

// Mirror the existing Button focus-ring convention for custom interactive elements.
const focusRingClass =
  'outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background';

export function BioLinkPage() {
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';

  // Per-route metadata: reuse the existing meta description tag and restore it on leave.
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previous = meta?.getAttribute('content');
    meta?.setAttribute('content', PAGE_DESCRIPTION);
    return () => {
      if (meta && previous != null) meta.setAttribute('content', previous);
    };
  }, []);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
      throw new Error('clipboard-api-unavailable');
    } catch {
      // Legacy fallback for non-secure origins (e.g. LAN IP dev server) where
      // the Clipboard API is blocked.
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.top = '-9999px';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      const selection = document.getSelection();
      const prevRange =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      textArea.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      if (prevRange && selection) {
        selection.removeAllRanges();
        selection.addRange(prevRange);
      }
      document.body.removeChild(textArea);
      if (!ok) throw new Error('copy-failed');
    }
  }, []);

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: document.title,
          text: 'خدمة الأرشيدياكون حبيب جرجس للداتا شو',
          url,
        });
        trackEvent('card_share', { route: '/card', properties: { method: 'native' } });
        toast.success('تمت مشاركة الصفحة');
        return;
      } catch (error) {
        // user dismissed the native share sheet → nothing to do
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // share failed (non-HTTPS origin, desktop, etc.) → fall through to copy
      }
    }
    try {
      await copyToClipboard(url);
      trackEvent('card_copy_url', { route: '/card', properties: { method: 'share-fallback' } });
      toast.success('تم نسخ رابط الصفحة');
    } catch {
      toast.error('تعذر نسخ الرابط');
    }
  }, [copyToClipboard]);

  const handleCopyUrl = useCallback(async () => {
    try {
      await copyToClipboard(siteUrl);
      trackEvent('card_copy_url', { route: '/card' });
      toast.success('تم نسخ الرابط');
    } catch {
      toast.error('تعذر نسخ الرابط');
    }
  }, [copyToClipboard, siteUrl]);

  return (
    <div
      dir="rtl"
      className="relative min-h-screen overflow-x-hidden bg-background text-foreground"
    >
      {/* Subtle premium background built from existing theme tokens (light & dark safe) */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-24 right-1/2 h-72 w-72 translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -left-24 top-1/3 h-64 w-64 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-md px-5 py-10 sm:py-14">
        {/* Header */}
        <header className="flex flex-col items-center text-center">
          <img
            src={logoImg512}
            alt="شعار خدمة الأرشيدياكون حبيب جرجس"
            width={112}
            height={112}
            decoding="async"
            className="h-28 w-28 rounded-full border-4 border-border bg-card object-cover shadow-lg"
          />
          <h1 className="mt-5 text-xl font-bold leading-snug sm:text-2xl">
            خدمة الأرشيدياكون حبيب جرجس
          </h1>
          <p className="mt-2 text-sm font-medium text-muted-foreground sm:text-base">
            كنيسة السيدة العذراء مريم بالنزهة الجديدة
          </p>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground/80">
            مصدر موثوق للميديا الكنسية القبطية الأرثوذكسية
          </p>
        </header>

        {/* Quick access */}
        <main className="mt-10">
          <nav aria-label="روابط سريعة للخدمات" className="mt-4">
            <ul className="space-y-3">
              {quickLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={() =>
                        trackEvent('card_link_click', {
                          route: '/card',
                          properties: { target: item.to },
                        })
                      }
                      className={cn(
                        'group flex min-h-[60px] items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-all duration-300 hover:border-primary/40 hover:shadow-lg',
                        focusRingClass,
                      )}
                    >
                      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="flex-1 text-right">
                        <span className="block font-bold text-foreground whitespace-nowrap">{item.title}</span>
                        {item.desc && (
                          <span className="mt-0.5 block text-sm text-muted-foreground">
                            {item.desc}
                          </span>
                        )}
                      </span>
                      <ChevronLeft className="h-5 w-5 flex-shrink-0 text-muted-foreground transition-all duration-300 group-hover:-translate-x-1 group-hover:text-primary" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Contact */}
          <section className="mt-10" aria-label="التواصل معنا">
            <div className="h-px w-full bg-border" />
            <h2 className="mt-8 text-lg font-bold text-foreground text-center">تواصل معنا</h2>

            <div className="mt-4 flex items-center justify-center gap-4">
              {socialLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    title={item.label}
                    onClick={() =>
                      trackEvent('card_social_click', {
                        route: '/card',
                        properties: { platform: item.label },
                      })
                    }
                    className={cn(
                      'flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:text-primary hover:shadow-lg',
                      focusRingClass,
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </a>
                );
              })}
            </div>

            <div className="mt-8 space-y-4">
              <button
                type="button"
                onClick={handleShare}
                className={cn(
                  'flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary font-medium text-primary-foreground shadow-sm transition-all duration-300 hover:bg-primary/90 hover:shadow-lg',
                  focusRingClass,
                )}
              >
                <Share2 className="h-5 w-5" />
                مشاركة الصفحة
              </button>

              <div className="flex min-h-[52px] items-center gap-2 rounded-xl border border-border bg-card p-2 ps-4 shadow-sm">
                <span className="flex-1 truncate text-left text-sm text-muted-foreground" dir="ltr">
                  {siteUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  aria-label="نسخ الرابط"
                  title="نسخ الرابط"
                  className={cn(
                    'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors hover:bg-primary hover:text-primary-foreground',
                    focusRingClass,
                  )}
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="mt-12 border-t border-border pt-6 text-center">
          <p className="text-xs text-muted-foreground/70">© خدمة الأرشيدياكون حبيب جرجس</p>
        </footer>
      </div>
    </div>
  );
}
