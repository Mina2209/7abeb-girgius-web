import { useCallback, useEffect, useState } from 'react';
import type { Hymn } from '../types/content';
import { bustContentCache, fetchHymnsFiltered, loadHymnsData } from '../services/contentLoaders';

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

        // fetchHymnsFiltered pages through the server's 100-per-request cap and maps
        // every row into the client `Hymn` shape. Both matter: a single request would
        // silently truncate at 100, and the raw server rows are not `Hymn` objects --
        // casting them left tags as objects and fileTypes/lyrics/duration/files.url
        // undefined, which rendered filtered hymn cards without files or tags.
        data = await fetchHymnsFiltered(params.toString());
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

