import { useCallback, useEffect, useState } from 'react';
import type { Hymn } from '../types/content';
import { bustContentCache, loadHymnsData } from '../services/contentLoaders';

// Phase 1 (Server sync): only ensure hymns are loaded from the API.
// Keep the existing client-side filtering/sorting behavior inside HymnsSection.
export function useHymnsData(query?: {
  search?: string;
  tags?: string[];
  fileTypes?: string[];
  sort?: string;
  favorites?: boolean;
}) {
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const hydrate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // When filters are provided, build query string and call API directly.
      const hasQuery = !!query && Object.keys(query).some((k) => (query as any)[k] != null);
      let data: Hymn[];

      if (hasQuery) {
        const params = new URLSearchParams();
        if (query?.search) params.set('search', query.search);
        if (query?.tags?.length) params.set('tags', query.tags.join(','));
        if (query?.fileTypes?.length) params.set('fileTypes', query.fileTypes.join(','));
        if (query?.sort) params.set('sort', query.sort);
        if (query?.favorites) params.set('favorites', 'true');

        const qs = params.toString();
        const url = `/api/hymns${qs ? `?${qs}` : ''}`;

        // Reuse existing apiClient via loadHymnsData path is not possible here,
        // so we fetch directly.
        const res = await fetch(url, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
        const rows = (await res.json()) as any[];

        // The client-side mapper expects server rows already in the Hymn shape.
        // In this project hymns from loadHymnsData are already mapped, so keep it consistent:
        // loadHymnsData does mapping, but here we call raw /api/hymns.
        // Easiest: just cast and rely on server output matching client Hymn.
        data = rows as unknown as Hymn[];
      } else {
        data = await loadHymnsData();
      }

      setHymns(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const refetch = useCallback(async () => {
    bustContentCache('hymns');
    await hydrate();
  }, [hydrate]);

  return { hymns, setHymns, loading, error, refetch };
}

