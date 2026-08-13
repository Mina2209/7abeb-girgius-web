// Runtime header measurement helper
// Finds the top-most header/banner element and writes its measured height (px)
// into the CSS variable --app-header-height on :root. Returns a teardown function.

type Teardown = () => void;

function findHeaderElement(): HTMLElement | null {
  const selectors = [
    '[data-app-header]',
    'header[role="banner"]',
    'header',
    '.app-header',
    '#app-header',
    '.top-bar',
    '.site-header',
    '.topbar',
  ];

  for (const sel of selectors) {
    const el = document.querySelector<HTMLElement>(sel);
    if (el) return el;
  }

  // Fallback: find a fixed/sticky element near the top of the viewport
  const candidates = Array.from(document.querySelectorAll<HTMLElement>('*')).filter((el) => {
    try {
      const st = getComputedStyle(el);
      if (!(st.position === 'fixed' || st.position === 'sticky')) return false;
      const rect = el.getBoundingClientRect();
      // near the top
      return rect.top >= -2 && rect.top <= 8 && rect.width > 100 && rect.height > 8;
    } catch {
      return false;
    }
  });

  if (candidates.length === 0) return null;
  // Prefer element with largest z-index / height
  candidates.sort((a, b) => {
    const za = parseInt(getComputedStyle(a).zIndex || '0', 10) || 0;
    const zb = parseInt(getComputedStyle(b).zIndex || '0', 10) || 0;
    if (za !== zb) return zb - za;
    return b.getBoundingClientRect().height - a.getBoundingClientRect().height;
  });

  return candidates[0] ?? null;
}

function setCssHeaderHeight(heightPx: number) {
  try {
    document.documentElement.style.setProperty('--app-header-height', `${Math.round(heightPx)}px`);
  } catch {
    // no-op
  }
}

export function initRuntimeHeaderHeight(): Teardown {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  let scheduled: number | null = null;
  let lastHeight = 0;

  function measureOnce() {
    try {
      const headerEl = findHeaderElement();
      if (!headerEl) return;
      const rect = headerEl.getBoundingClientRect();
      const h = Math.max(0, Math.round(rect.height));
      if (h && h !== lastHeight) {
        lastHeight = h;
        setCssHeaderHeight(h);
      }
    } catch (e) {
      // ignore
    }
  }

  function scheduleMeasure() {
    if (scheduled !== null) return;
    scheduled = window.setTimeout(() => {
      scheduled = null;
      measureOnce();
    }, 120);
  }

  // Initial measurement on next frame
  const rafId = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => scheduleMeasure()) : null;

  // Resize handler (debounced)
  const resizeHandler = () => scheduleMeasure();
  window.addEventListener('resize', resizeHandler, { passive: true });

  // Observe mutations in the body — if header structure changes, re-measure
  const observer = new MutationObserver(() => scheduleMeasure());
  try {
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
  } catch {
    // ignore
  }

  // Also re-measure when fonts load (layout may change)
  if (document.fonts && typeof (document as any).fonts.ready?.then === 'function') {
    (document as any).fonts.ready.then(() => scheduleMeasure()).catch(() => {});
  }

  // One-time fallback measure after a short timeout to catch late layout
  const fallbackTimer = window.setTimeout(() => scheduleMeasure(), 400);

  const teardown = () => {
    if (rafId) try { cancelAnimationFrame(rafId); } catch {}
    if (scheduled !== null) { clearTimeout(scheduled); scheduled = null; }
    try { window.removeEventListener('resize', resizeHandler); } catch {}
    try { observer.disconnect(); } catch {}
    try { clearTimeout(fallbackTimer); } catch {}
  };

  return teardown;
}
