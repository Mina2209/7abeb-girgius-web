import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Loader2, AlertTriangle, ExternalLink, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';
import { getPreviewUrl } from '../services/s3Upload';
import { downloadFile } from '../utils/download';
import './pptx-viewer.css';

const OFFICE_EMBED_URL = 'https://view.officeapps.live.com/op/embed.aspx?src=';

interface PptxViewerProps {
  /** Raw streaming URL of the pptx/ppsx bytes (result of getDocumentFetchUrl). */
  src?: string;
  title?: string;
}

type OfficeBuild = 'loading' | 'ready' | 'error';
type IframeState = 'pending' | 'loaded' | 'failed';

/**
 * Silent auto-routing:
 * - localhost  -> the in-browser pptx-preview renderer (Microsoft cannot
 *                 reach a local dev host), started immediately with no
 *                 intermediate UI.
 * - production -> Microsoft Office Online iframe, shown immediately.
 */
function isLocalhost(): boolean {
  if (typeof window === 'undefined') return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

export function PptxViewer({ src, title }: PptxViewerProps) {
  const isLocal = isLocalhost();
  if (isLocal) {
    return <LocalPowerPointPreview src={src} title={title} />;
  }
  return <OfficeOnlinePreview src={src} title={title} />;
}

/* =============================== Production: Office Online =============================== */

function OfficeOnlinePreview({ src, title }: PptxViewerProps) {
  const [officeBuild, setOfficeBuild] = useState<OfficeBuild>('loading');
  const [officeUrl, setOfficeUrl] = useState('');
  const [iframeState, setIframeState] = useState<IframeState>('pending');
  const [iframeKey, setIframeKey] = useState(0);
  const filename = (title || '').trim() || 'presentation.pptx';
  const officePage = officeUrl ? `${OFFICE_EMBED_URL}${encodeURIComponent(officeUrl)}` : '';

  // Build the public Office-online URL from the stored key.
  useEffect(() => {
    let cancelled = false;
    setOfficeBuild('loading');
    setIframeState('pending');
    (async () => {
      if (!src) {
        setOfficeBuild('error');
        return;
      }
      try {
        const u = await getPreviewUrl(src);
        if (cancelled) return;
        if (u.includes('/api/uploads/office/')) {
          // The Office embed requires an HTTPS source.
          setOfficeUrl(u.replace(/^http:\/\//, 'https://'));
          setOfficeBuild('ready');
        } else {
          setOfficeBuild('error');
        }
      } catch {
        if (!cancelled) setOfficeBuild('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  // If Office never finishes loading (network blocker, missing backend route),
  // escalate to the failure panel with a prominent download button.
  useEffect(() => {
    if (officeBuild !== 'ready' || iframeState !== 'pending') return;
    const t = window.setTimeout(() => setIframeState('failed'), 9000);
    return () => window.clearTimeout(t);
  }, [officeBuild, iframeState, iframeKey]);

  const handleIframeLoad = useCallback(() => setIframeState('loaded'), []);

  const retryIframe = useCallback(() => {
    setIframeState('pending');
    setIframeKey((k) => k + 1);
  }, []);

  const download = useCallback(() => {
    downloadFile(src ?? '', filename, { contentName: filename });
  }, [src, filename]);

  return (
    <div className="w-full flex flex-col gap-3">
      <div
        dir="ltr"
        className="pptx-preview-scope relative w-full h-[58vh] sm:h-[64vh] lg:h-[68vh] max-h-[74vh] overflow-hidden rounded-lg border border-border bg-black"
      >
        {officeBuild === 'loading' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/90 text-background-foreground pointer-events-none">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm text-muted-foreground">جاري تجهيز المعاينة...</p>
          </div>
        )}

        {officeBuild === 'ready' && iframeState !== 'failed' && (
          <iframe
            key={iframeKey}
            src={officePage}
            onLoad={handleIframeLoad}
            className="w-full h-full border-0"
            allowFullScreen
            title={title || 'PowerPoint Preview'}
          />
        )}

        {officeBuild === 'ready' && iframeState === 'pending' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/80 text-background-foreground pointer-events-none">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm text-muted-foreground">فتح المعاينة عبر Microsoft...</p>
          </div>
        )}

        {(officeBuild === 'error' || iframeState === 'failed') && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/90 p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-yellow-500" />
            <div className="space-y-1">
              <p className="font-bold">تعذر فتح المعاينة عبر Microsoft</p>
              <p className="text-sm text-muted-foreground">
                يمكن أن تكون الشبكة المانعة أو الروابط مقيّدة — حمّل الملف مباشرة.
              </p>
            </div>
            <button
              type="button"
              onClick={download}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg text-base font-bold"
            >
              <Download className="w-5 h-5" />
              تحميل الملف
            </button>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={retryIframe}
                className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-secondary rounded-lg text-sm font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                إعادة المحاولة
              </button>
              {officePage && (
                <a
                  href={officePage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-secondary rounded-lg text-sm font-medium"
                >
                  <ExternalLink className="w-4 h-4" />
                  فتح في علامة تبويب جديدة
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center">
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          تحميل الملف
        </button>
      </div>
    </div>
  );
}

/* =============================== Local: in-browser renderer =============================== */

type PptxPreviewer = {
  slideCount: number;
  pptx?: { width: number; height: number };
  wrapper?: HTMLElement;
  load(file: ArrayBuffer): Promise<unknown>;
  renderSingleSlide(index: number): void;
  destroy(): void;
};

const LOCAL_LOGICAL_WIDTH = 1000;
const LOCAL_INITIAL_HEIGHT = Math.round((LOCAL_LOGICAL_WIDTH * 9) / 16);

/**
 * In-browser HTML renderer used automatically on localhost. The heavy
 * pptx-preview (echarts) chunk is lazily imported here, so production
 * bundles never load it. The `.local-ppt-arabic` wrapper applies best-effort
 * RTL + Arabic font overrides to keep Arabic text readable and aligned.
 */
function LocalPowerPointPreview({ src, title }: PptxViewerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const previewerRef = useRef<PptxPreviewer | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [stage, setStage] = useState({ w: LOCAL_LOGICAL_WIDTH, h: LOCAL_INITIAL_HEIGHT });
  const [scale, setScale] = useState(1);
  const filename = (title || '').trim() || 'presentation.pptx';

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!src) {
        setStatus('error');
        return;
      }
      setStatus('loading');
      setTotal(0);
      setCurrent(0);
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        if (cancelled) return;

        const canvas = canvasRef.current;
        if (!canvas) throw new Error('viewer container missing');
        canvas.innerHTML = '';
        if (previewerRef.current) {
          try {
            previewerRef.current.destroy();
          } catch {
            /* ignore */
          }
          previewerRef.current = null;
        }

        const { init } = await import('pptx-preview');

        let pre = init(canvas, { width: LOCAL_LOGICAL_WIDTH, height: LOCAL_INITIAL_HEIGHT, mode: 'slide' });
        await pre.load(buf);

        const deckW = pre.pptx?.width || LOCAL_LOGICAL_WIDTH;
        const deckH = pre.pptx?.height || Math.round(LOCAL_LOGICAL_WIDTH / (16 / 9));
        const logicalH = Math.max(120, Math.round((LOCAL_LOGICAL_WIDTH * deckH) / deckW));

        if (logicalH !== LOCAL_INITIAL_HEIGHT) {
          try {
            pre.destroy();
          } catch {
            /* ignore */
          }
          canvas.innerHTML = '';
          pre = init(canvas, { width: LOCAL_LOGICAL_WIDTH, height: logicalH, mode: 'slide' });
          await pre.load(buf);
        }

        if (cancelled) {
          try {
            pre.destroy();
          } catch {
            /* ignore */
          }
          return;
        }
        if (!pre.slideCount) throw new Error('no slides found in file');

        pre.renderSingleSlide(0);
        if (pre.wrapper) pre.wrapper.style.overflow = 'hidden';

        const slideEl = pre.wrapper?.querySelector<HTMLElement>('.pptx-preview-slide-wrapper-0');
        const measuredH = slideEl ? slideEl.offsetHeight : logicalH;

        previewerRef.current = pre;
        setTotal(pre.slideCount);
        setStage({ w: LOCAL_LOGICAL_WIDTH, h: Math.max(measuredH, logicalH) });

        const vp = viewportRef.current;
        if (vp && vp.clientWidth > 0) {
          setScale(Math.min(vp.clientWidth / LOCAL_LOGICAL_WIDTH, vp.clientHeight / logicalH));
        }
        setCurrent(0);
        setStatus('ready');
      } catch (err) {
        if (!cancelled) {
          console.error('[PptxViewer][local] render failed:', err);
          setStatus('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (previewerRef.current) {
        try {
          previewerRef.current.destroy();
        } catch {
          /* ignore */
        }
        previewerRef.current = null;
      }
    };
  }, [src]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      if (el.clientWidth > 0) {
        setScale(Math.min(el.clientWidth / stage.w, el.clientHeight / stage.h));
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [stage.w, stage.h]);

  const go = useCallback(
    (index: number) => {
      const pre = previewerRef.current;
      if (!pre || !pre.slideCount) return;
      const next = (index + pre.slideCount) % pre.slideCount;
      try {
        pre.renderSingleSlide(next);
        setCurrent(next);
      } catch (err) {
        console.error('[PptxViewer][local] slide render failed:', err);
      }
    },
    []
  );

  const download = () => downloadFile(src ?? '', filename, { contentName: filename });

  return (
    <div className="w-full flex flex-col gap-3">
      <div
        ref={viewportRef}
        dir="ltr"
        aria-label={title ? `معاينة: ${title}` : 'معاينة العرض التقديمي'}
        className="pptx-preview-scope relative w-full h-[380px] sm:h-[480px] lg:h-[540px] flex items-center justify-center overflow-hidden rounded-lg border border-border bg-black"
      >
        <div
          style={{
            width: stage.w,
            height: stage.h,
            flex: '0 0 auto',
            position: 'relative',
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
            willChange: 'transform',
          }}
        >
          <div ref={canvasRef} dir="rtl" className="local-ppt-arabic w-full h-full overflow-hidden" />
        </div>

        {status === 'loading' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/90 text-background-foreground pointer-events-none">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm text-muted-foreground">جاري تجهيز المعاينة...</p>
          </div>
        )}
        {status === 'error' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/90 p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-yellow-500" />
            <p className="font-bold">تعذر عرض الملف محلياً</p>
            <button
              type="button"
              onClick={download}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg text-base font-bold"
            >
              <Download className="w-5 h-5" />
              تحميل الملف
            </button>
          </div>
        )}
        {status === 'ready' && total === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 pointer-events-none">
            <p className="text-sm text-muted-foreground">لا توجد شرائح في هذا الملف</p>
          </div>
        )}
      </div>

      {status === 'ready' && total > 0 && (
        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => go(current - 1)}
            disabled={current === 0}
            className="p-2 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="الشريحة السابقة"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium tabular-nums min-w-[64px] text-center">
            {current + 1} / {total}
          </span>
          <button
            type="button"
            onClick={() => go(current + 1)}
            disabled={current === total - 1}
            className="p-2 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="الشريحة التالية"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={download}
            className="p-2 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
            title="تحميل الملف"
          >
            <Download className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}