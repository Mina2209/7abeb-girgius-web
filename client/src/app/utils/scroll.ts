// Lightweight scroll utility that accounts for the global header height and optional sticky toolbar height.
// Use this to scroll a target element into view while preventing it from being hidden behind
// the app header or sticky toolbars.

export interface ScrollOptions {
  scrollContainer?: HTMLElement | null; // if omitted, walks up to find a scrollable parent or uses document.scrollingElement
  stickyToolbarRef?: HTMLElement | null; // optional sticky toolbar element to account for
  extraOffset?: number; // additional spacing in px
  behavior?: ScrollBehavior; // 'smooth' | 'auto'
}

function parseCssPixelValue(value: string | null): number {
  if (!value) return 0;
  const px = value.trim();
  if (px.endsWith('px')) return parseFloat(px.slice(0, -2)) || 0;
  if (px.endsWith('rem')) {
    const rem = parseFloat(px.slice(0, -3)) || 0;
    const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    return rem * fontSize;
  }
  return parseFloat(px) || 0;
}

function getGlobalHeaderHeight(): number {
  try {
    const val = getComputedStyle(document.documentElement).getPropertyValue('--app-header-height') || '';
    const parsed = parseCssPixelValue(val);
    if (parsed > 0) return parsed;
  } catch (e) {
    // ignore
  }
  // Fallback: try to read padding-top from main element
  const main = document.querySelector('main');
  if (main) {
    const pt = getComputedStyle(main).paddingTop;
    const parsed = parseCssPixelValue(pt);
    if (parsed > 0) return parsed;
  }
  // Last resort: 0
  return 0;
}

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  if (!el) return null;
  let parent: HTMLElement | null = el;
  while (parent) {
    const style = getComputedStyle(parent);
    const overflowY = style.overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return parent;
    parent = parent.parentElement;
  }
  return document.scrollingElement as HTMLElement | null;
}

export function scrollElementIntoViewWithHeaderOffset(target: HTMLElement, options: ScrollOptions = {}) {
  if (!target) return;
  const { scrollContainer, stickyToolbarRef = null, extraOffset = 0, behavior = 'smooth' } = options;

  const headerHeight = getGlobalHeaderHeight();
  const toolbarHeight = stickyToolbarRef?.offsetHeight ?? 0;

  // Determine scroll parent
  let scrollParent: HTMLElement | null = scrollContainer ?? findScrollParent(target);
  if (!scrollParent) scrollParent = document.scrollingElement as HTMLElement | null;
  if (!scrollParent) return;

  const rect = target.getBoundingClientRect();

  if (scrollParent === (document.scrollingElement as HTMLElement)) {
    const top = window.scrollY + rect.top - (headerHeight + toolbarHeight + extraOffset);
    window.scrollTo({ top: Math.max(top, 0), behavior });
  } else {
    // scrollParent may have its own coordinate space
    const parentRect = scrollParent.getBoundingClientRect();
    const top = scrollParent.scrollTop + (rect.top - parentRect.top) - (headerHeight + toolbarHeight + extraOffset);
    scrollParent.scrollTo({ top: Math.max(top, 0), behavior });
  }
}
