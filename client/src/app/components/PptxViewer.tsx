import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Expand,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { buildPreviewPdfUrl } from '../services/s3Upload';

interface PptxViewerProps {
  /** Stored URL of the original presentation (`/api/uploads/url?key=Hymns/...ppsx`). */
  src?: string;
  slideCount?: number | null;
  title?: string;
}

// Nominal frame geometry, not the deck's aspect ratio. 696x345 is ~2.02:1 while
// slides are 16:9 (1.78:1), so the rendered page letterboxes inside the frame and
// leaves a dark band on each side; that is the intended fit-inside behaviour, not
// a stretched render. Set FRAME_HEIGHT to 391 for a flush 16:9 frame.
const FRAME_WIDTH = 696;
const FRAME_HEIGHT = 345;

// The very first open of a deck runs LibreOffice on the server (up to ~2 min).
const PDF_FETCH_TIMEOUT_MS = 180_000;

type ViewerState = 'loading' | 'ready' | 'error';

export function PptxViewer({ src, slideCount, title }: PptxViewerProps) {
  const shellRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  const [page, setPage] = useState(1);
  const [state, setState] = useState<ViewerState>('loading');
  // True when the server answered 503: it has no PowerPoint->PDF converter, so
  // retrying cannot help. Suppresses the retry button and names the real cause.
  const [converterMissing, setConverterMissing] = useState(false);
  const [numPages, setNumPages] = useState<number | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  // Set while this element (rather than the document) is fullscreen, so the
  // toolbar can get out of the way and the frame can fill the screen.
  const [bare, setBare] = useState(false);
  // Bumped by the ResizeObserver so a container resize re-runs the render pass.
  const [frameSize, setFrameSize] = useState(0);

  const pdfUrl = useMemo(() => buildPreviewPdfUrl(src), [src]);
  // The rendered PDF is the authority for page count; `slideCount` is the fallback.
  const total = numPages ?? (slideCount && slideCount > 0 ? slideCount : null);

  // Cancel any in-flight page paint and destroy the document. Called both when a
  // new preview replaces the old one and on unmount, so nothing is left alive.
  const releaseDocument = useCallback(() => {
    renderTaskRef.current?.cancel();
    renderTaskRef.current = null;
    const doc = docRef.current;
    docRef.current = null;
    if (doc) void doc.destroy().catch(() => undefined);
  }, []);

  // The PDF is fetched here as bytes rather than handed to an <iframe>. The API is
  // on a different origin from the app and its responses carry `X-Frame-Options:
  // DENY`, which makes a cross-origin frame unrenderable — and a browser-native PDF
  // frame would come back with Download/Print controls we do not want to expose.
  // Holding the bytes also lets us see the HTTP status: an iframe cannot tell
  // "still converting" from "no converter".
  useEffect(() => {
    if (!pdfUrl) {
      setState('error');
      return undefined;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PDF_FETCH_TIMEOUT_MS);
    let abandoned = false;

    setState('loading');
    setConverterMissing(false);
    setNumPages(null);
    setPage(1);
    releaseDocument();

    (async () => {
      try {
        const res = await fetch(pdfUrl, { signal: controller.signal, cache: 'no-cache' });
        if (res.status === 503) {
          setConverterMissing(true);
          throw new Error('preview converter unavailable');
        }
        if (!res.ok) throw new Error(`preview fetch failed with status ${res.status}`);

        const buffer = await res.arrayBuffer();
        if (controller.signal.aborted || abandoned) return;

        // Loaded on demand: the PDF engine is ~1 MB, so it stays out of the
        // initial bundle and only arrives with the first preview that opens.
        const [pdfjs, workerModule] = await Promise.all([
          import('pdfjs-dist'),
          import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
        ]);
        pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
        if (controller.signal.aborted || abandoned) return;

        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
        const doc = await loadingTask.promise;
        if (controller.signal.aborted || abandoned) {
          void doc.destroy();
          return;
        }

        docRef.current = doc;
        setNumPages(doc.numPages);
        setPage(1);
        setState('ready');
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
      releaseDocument();
    };
  }, [pdfUrl, reloadToken, releaseDocument]);

  // Paint the requested page into the canvas. Every pass fits the page inside the
  // frame (contain), which is what the old `#view=Fit` fragment asked the browser
  // PDF viewer to do — so the letterboxing and the frame geometry are unchanged.
  useEffect(() => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (state !== 'ready' || !doc || !canvas || !frame) return undefined;

    let stale = false;
    const target = Math.min(Math.max(page, 1), doc.numPages);

    renderTaskRef.current?.cancel();
    renderTaskRef.current = null;

    (async () => {
      try {
        const pdfPage = await doc.getPage(target);
        if (stale) return;

        const cssWidth = frame.clientWidth;
        const cssHeight = frame.clientHeight;
        if (!cssWidth || !cssHeight) return;

        const base = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(cssWidth / base.width, cssHeight / base.height);
        const viewport = pdfPage.getViewport({ scale });
        // Render at device resolution so text stays crisp, while the CSS box keeps
        // the layout size — a plain 1:1 canvas would look blurred on retina.
        const outputScale = Math.max(window.devicePixelRatio || 1, 1);

        canvas.width = Math.round(viewport.width * outputScale);
        canvas.height = Math.round(viewport.height * outputScale);
        canvas.style.width = `${Math.round(viewport.width)}px`;
        canvas.style.height = `${Math.round(viewport.height)}px`;

        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) return;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const task = pdfPage.render({
          canvasContext: ctx,
          viewport,
          transform:
            outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
        });
        renderTaskRef.current = task;
        if (stale) {
          task.cancel();
          renderTaskRef.current = null;
          return;
        }
        await task.promise;
        if (renderTaskRef.current === task) renderTaskRef.current = null;
      } catch (err) {
        // A superseded paint is cancelled on purpose; only real failures matter.
        if (err instanceof Error && err.name === 'RenderingCancelledException') return;
        if (stale) return;
        console.error('[PptxViewer] page render failed:', err);
      }
    })();

    return () => {
      stale = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
    };
  }, [state, page, numPages, frameSize]);

  // The frame's on-screen box changes with the viewport and with fullscreen, so
  // every size change re-fits the page instead of leaving it at the old scale.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      setFrameSize((n) => n + 1);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

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
    if (event.target === event.currentTarget || (event.target as HTMLElement).closest('canvas')) {
      event.preventDefault();
    }
  }, []);

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
        {state === 'ready' && (
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={title ? `معاينة: ${title}` : 'معاينة العرض التقديمي'}
            className="block"
          />
        )}

        {state === 'loading' && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/85 text-background-foreground pointer-events-none">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="text-sm text-muted-foreground">جاري تجهيز المعاينة...</p>
            <p className="max-w-[22rem] text-center text-xs text-muted-foreground/80">
              أول فتح للعرض قد يستغرق لحظات لتحويله إلى PDF.
            </p>
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
                  : 'يمكنك إعادة المحاولة.'}
              </p>
            </div>
            {!converterMissing && pdfUrl && (
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-5 py-3 font-bold"
              >
                <RefreshCw className="w-5 h-5" />
                إعادة المحاولة
              </button>
            )}
          </div>
        )}
      </div>

      {state === 'ready' && !bare && (
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
