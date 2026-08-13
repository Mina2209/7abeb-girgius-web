import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { trackEvent } from '../services/analytics';

/**
 * Tracks a page_view whenever the actual route pathname changes.
 *
 * - Dedupes consecutive renders with the same pathname (StrictMode double
 *   effects, re-renders, lazy-load suspends) so the same page is not tracked
 *   twice. Genuine navigations away and back ARE tracked again.
 * - The actual trackEvent call is deferred to idle time (page is usable first),
 *   and runs after the app has updated document.title for the new route.
 * - Renders nothing.
 */
export function AnalyticsRouteTracker() {
  const location = useLocation();
  const lastPathnameRef = useRef<string | null>(null);

  useEffect(() => {
    const pathname = location.pathname;
    // Consecutive same-pathname effect runs are ignored (StrictMode remount,
    // unrelated re-renders). The ref is reset in cleanup so a real navigation
    // back to the same path still counts as a new page view.
    if (lastPathnameRef.current === pathname) return;
    lastPathnameRef.current = pathname;

    let cancelled = false;
    const fire = () => {
      if (cancelled) return;
      // document.title reflects the new route here (App's title effect already
      // ran by the time we reach idle).
      const pageTitle =
        typeof document !== 'undefined' ? document.title : '';
      trackEvent('page_view', {
        route: pathname,
        properties: pageTitle ? { pageTitle } : undefined,
      });
    };

    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const handle = window.requestIdleCallback(fire, { timeout: 1000 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(handle);
        lastPathnameRef.current = null;
      };
    }
    const handle = setTimeout(fire, 0);
    return () => {
      cancelled = true;
      clearTimeout(handle);
      lastPathnameRef.current = null;
    };
  }, [location.pathname]);

  return null;
}
