import { useCallback, useRef, useState } from 'react';
import type { GalleryImage } from '../types/content';
import { fetchGalleryPage, type GalleryQuery } from '../services/contentLoaders';

export type GalleryFilters = Omit<GalleryQuery, 'page' | 'limit'>;

/**
 * Server-driven, paginated gallery data.
 * - `applyFilters(filters)` resets to page 1 and fetches (call when controls change).
 * - `loadMore()` appends the next page (call from an infinite-scroll sentinel).
 * Out-of-order responses are ignored via a request-id guard.
 */
export function useGalleryImagesPaged(pageSize = 30) {
  const [items, setItems] = useState<GalleryImage[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const filtersRef = useRef<GalleryFilters>({});
  const reqId = useRef(0);

  const run = useCallback(
    async (filters: GalleryFilters, pageNum: number, append: boolean) => {
      const myReq = ++reqId.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const { items: pageItems, total: t } = await fetchGalleryPage({
          ...filters,
          page: pageNum,
          limit: pageSize,
        });
        if (myReq !== reqId.current) return; // a newer request superseded this one
        setTotal(t);
        setPage(pageNum);
        setItems((prev) => (append ? [...prev, ...pageItems] : pageItems));
      } catch (e) {
        if (myReq === reqId.current) setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        if (myReq === reqId.current) {
          if (append) setLoadingMore(false);
          else setLoading(false);
        }
      }
    },
    [pageSize],
  );

  const applyFilters = useCallback(
    (filters: GalleryFilters) => {
      filtersRef.current = filters;
      void run(filters, 1, false);
    },
    [run],
  );

  const loadMore = useCallback(() => {
    if (loading || loadingMore) return;
    if (items.length >= total) return;
    void run(filtersRef.current, page + 1, true);
  }, [loading, loadingMore, items.length, total, page, run]);

  const refetch = useCallback(() => {
    void run(filtersRef.current, 1, false);
  }, [run]);

  return {
    items,
    setItems,
    total,
    page,
    loading,
    loadingMore,
    error,
    hasMore: items.length < total,
    applyFilters,
    loadMore,
    refetch,
  };
}
