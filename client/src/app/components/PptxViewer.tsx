import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Expand,
  ExternalLink,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import {
  buildPreviewImagesUrl,
  buildPreviewPdfUrl,
  resolveSlideImageUrl,
} from '../services/s3Upload';

interface PptxViewerProps {
  /** Stored URL of the original presentation (`/api/uploads/url?key=Hymns/...ppsx`). */
  src?: string;
  slideCount?: number | null;
  title?: string;
}

// Nominal frame geometry, not the deck's aspect ratio. 696x345 is ~2.02:1 while
// slides are 16:9 (1.78:1), so the rendered slide letterboxes inside the frame and
// leaves a dark band on each side; that is the intended fit-inside behaviour, not
// a stretched render. Set FRAME_HEIGHT to 391 for a flush 16:9 frame.
const FRAME_WIDTH = 696;
const FRAME_HEIGHT = 345;

// The very first open of a deck runs LibreOffice on the server (up to ~2 min)
// before the per-slide images can be rendered from the resulting PDF.
const PREVIEW_FETCH_TIMEOUT_MS = 180_000;

// 'pdf-only' is the safe fallback when the image set is unavailable: it links to
// the PDF, which the browser's native viewer renders correctly. The in-app PDF.js
// canvas path is deliberately not used — it mis-positions Arabic clusters.
type ViewerState = 'loading' | 'ready' | 'pdf-only' | 'error';

export function PptxViewer({ src, slideCount, title }: PptxViewerProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);

  const [page, setPage] = useState(1);
  const [state, setState] = useState<ViewerState>('loading');
  // True when the server answered 503: it has no PowerPoint->PDF converter, so
  // retrying cannot help. Suppresses the retry button and names the real cause.
  const [converterMissing, setConverterMissing] = useState(false);
  // "{n}"-templated image URL, or null when the server has no image set for this
  // deck (no poppler, an unsupported deck, or a render failure).
  const [template, setTemplate] = useState<string | null>(null);
  const [pages, setPages] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  // Set while this element (rather than the document) is fullscreen, so the
  // toolbar can get out of the way and the frame can fill the screen.
  const [bare, setBare] = useState(false);
  // A single slide that fails to load degrades to the PDF link, never to a
  // broken-image icon.
  const [imageFailed, setImageFailed] = useState(false);

  const pdfUrl = useMemo(() => buildPreviewPdfUrl(src), [src]);
  const imagesUrl = useMemo(() => buildPreviewImagesUrl(src), [src]);
  // The rendered set is the authority for page count; `slideCount` is the fallback.
  const total = pages ?? (slideCount && slideCount > 0 ? slideCount : null);
  const slideUrl = useMemo(
    () => (template ? resolveSlideImageUrl(template, page) : undefined),
    [template, page],
  );

  // Ask the server for the per-slide image set. The first open converts the deck
  // to PDF and renders every slide; later opens are served from S3. The response's
  // template is null when images cannot be produced — then we degrade to the PDF.
  useEffect(() => {
    if (!imagesUrl) {
      setState('error');
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PREVIEW_FETCH_TIMEOUT_MS);
    let abandoned = false;

    setState('loading');
    setConverterMissing(false);
    setTemplate(null);
    setPages(null);
    setPage(1);
    setImageFailed(false);

    (async () => {
      try {
        const res = await fetch(imagesUrl, { signal: controller.signal, cache: 'no-cache' });
        // No converter at all is a deployment problem: keep the specific message
        // and suppress a retry that could not possibly help.
        if (res.status === 503) {
          setConverterMissing(true);
          throw new Error('preview converter unavailable');
        }
        // Any other non-OK — 404 when the endpoint is not deployed yet, 504 when a
        // first render outran the server timeout, 502 when conversion failed, … —
        // leaves the images unavailable but does not invalidate the PDF, which is
        // rendered independently. Degrade to the PDF link instead of an error the
        // visitor cannot act on. (Malformed JSON / a dropped connection still fall
        // through to the error state, which also offers the PDF link.)
        if (!res.ok) {
          if (controller.signal.aborted || abandoned) return;
          setState('pdf-only');
          return;
        }

        const data = (await res.json()) as { template?: unknown; pages?: unknown };
        if (controller.signal.aborted || abandoned) return;

        const nextTemplate = typeof data?.template === 'string' ? data.template : null;
        const nextPages =
          typeof data?.pages === 'number' && data.pages > 0 ? data.pages : null;

        setTemplate(nextTemplate);
        setPages(nextPages);
        setState(nextTemplate ? 'ready' : 'pdf-only');
      } catch (err) {
        if (controller.signal.aborted || abandoned) return;
        console.error('[PptxViewer] preview load failed:', err);
        setConverterMissing(err instanceof Error && err.message.includes('converter unavailable'));
        setState('error');
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => {
      abandoned = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [imagesUrl, reloadToken]);

  // A slide change is a fresh load, so clear a previous failure.
  useEffect(() => {
    setImageFailed(false);
  }, [slideUrl]);

  const goNext = useCallback(() => setPage((p) => Math.min(p + 1, total ?? Infinity)), [total]);
  const goPrev = useCallback(() => setPage((p) => Math.max(p - 1, 1)), []);
  const goFirst = useCallback(() => setPage(1), []);
  const goLast = useCallback(() => {
    if (total) setPage(total);
  }, [total]);

  const toggleFullscreen = useCallback(() => {
    const el = shellRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  }, []);

  useEffect(() => {
    const onChange = () => setBare(document.fullscreenElement === shellRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  // Arrow keys follow reading order, not geometry: in an RTL shell the forward
  // arrow points left, so ArrowLeft advances.
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      // The viewer is view-only: swallow the browser's save/print shortcuts while
      // focus is inside it. This is a UI courtesy, not an access control.
      if ((event.ctrlKey || event.metaKey) && ['p', 's'].includes(event.key.toLowerCase())) {
        event.preventDefault();
        return;
      }

      const target = event.target as HTMLElement;
      if (target !== event.currentTarget && target.closest('button, a, input, [tabindex]')) return;

      switch (event.key) {
        case 'ArrowLeft':
        case 'PageDown':
        case ' ':
          goNext();
          break;
        case 'ArrowRight':
        case 'PageUp':
          goPrev();
          break;
        case 'Home':
          goFirst();
          break;
        case 'End':
          goLast();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        default:
          return;
      }
      event.preventDefault();
    },
    [goNext, goPrev, goFirst, goLast, toggleFullscreen],
  );

  // Blocks the browser menu over the slide itself; the toolbar stays right-clickable.
  const onContextMenu = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget || (event.target as HTMLElement).closest('img')) {
      event.preventDefault();
    }
  }, []);

  const showSlide = state === 'ready' && !imageFailed && Boolean(slideUrl);
  // A deck whose images are missing (or a slide that failed to load) still has a
  // correct render available at the PDF URL — the native viewer shapes Arabic
  // properly, so linking there is the safe fallback.
  const showPdfFallback = state === 'pdf-only' || (state === 'ready' && imageFailed);

  return (
    <div
      dir="rtl"
      ref={shellRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={`deck-shell flex flex-col items-center gap-3 outline-none ${bare ? 'deck-shell-bare h-screen justify-center bg-black' : ''}`}
    >
      <div
        ref={frameRef}
        onContextMenu={onContextMenu}
        className="deck-frame relative flex items-center justify-center overflow-hidden rounded-lg bg-black shadow-2xl"
        style={
          {
            '--deck-frame-w': FRAME_WIDTH,
            '--deck-frame-h': FRAME_HEIGHT,
          } as React.CSSProperties
        }
      >
        {showSlide && (
          <img
            key={slideUrl}
            src={slideUrl}
            alt={title ? `معاينة: ${title}` : 'معاينة العرض التقديمي'}
            className="block max-h-full max-w-full object-contain"
            onError={() => {
              console.error('[PptxViewer] slide image failed to load:', slideUrl);
              setImageFailed(true);
            }}
          />
        )}

        {state === 'loading' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/85 text-background-foreground pointer-events-none">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm text-muted-foreground">جاري تجهيز المعاينة...</p>
            <p className="max-w-[22rem] text-center text-xs text-muted-foreground/80">
              أول فتح للعرض قد يستغرق لحظات لتجهيز صور الشرائح.
            </p>
          </div>
        )}

        {showPdfFallback && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/90 p-6 text-center text-background-foreground">
            <AlertTriangle className="w-10 h-10 text-yellow-500" />
            <div>
              <p className="font-bold">المعاينة داخل الصفحة غير متاحة</p>
              <p className="mt-1 text-sm text-muted-foreground">
                يمكنك فتح العرض الأصلي في المتصفح لعرضه كاملاً.
              </p>
            </div>
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 font-bold"
              >
                <ExternalLink className="w-5 h-5" />
                فتح المعاينة في المتصفح
              </a>
            )}
          </div>
        )}

        {state === 'error' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/90 p-6 text-center text-background-foreground">
            <AlertTriangle className="w-10 h-10 text-yellow-500" />
            <div>
              <p className="font-bold">
                {converterMissing ? 'خدمة تحويل المعاينة غير مفعّلة' : 'المعاينة غير متاحة حالياً'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {converterMissing
                  ? 'المعاينة تحتاج إلى برنامج LibreOffice على الخادم.'
                  : 'يمكنك إعادة المحاولة أو فتح العرض الأصلي في المتصفح.'}
              </p>
            </div>
            {!converterMissing && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {imagesUrl && (
                  <button
                    type="button"
                    onClick={() => setReloadToken((token) => token + 1)}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 font-bold"
                  >
                    <RefreshCw className="w-5 h-5" />
                    إعادة المحاولة
                  </button>
                )}
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 font-bold"
                  >
                    <ExternalLink className="w-5 h-5" />
                    فتح المعاينة في المتصفح
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {state === 'ready' && !imageFailed && !bare && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {title && <span className="max-w-[16rem] truncate text-sm font-bold">{title}</span>}
          <button
            type="button"
            onClick={goPrev}
            disabled={page <= 1}
            className="rounded-lg bg-muted p-2 disabled:opacity-40"
            title="الصفحة السابقة"
            aria-label="الصفحة السابقة"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <span className="min-w-[70px] text-center text-sm tabular-nums">
            {page}
            {total ? ` / ${total}` : ''}
          </span>
          <button
            type="button"
            onClick={goNext}
            disabled={Boolean(total && page >= total)}
            className="rounded-lg bg-muted p-2 disabled:opacity-40"
            title="الصفحة التالية"
            aria-label="الصفحة التالية"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="mx-1 h-6 w-px bg-border" />
          <button
            type="button"
            onClick={toggleFullscreen}
            className="rounded-lg bg-muted p-2"
            title="ملء الشاشة"
            aria-label="ملء الشاشة"
          >
            <Expand className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}