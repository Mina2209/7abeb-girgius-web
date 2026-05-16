import { useCallback, useEffect, useState } from 'react';
import type { Hymn } from '../types/content';
import { bustContentCache, loadHymnsData } from '../services/contentLoaders';

export function useHymnsData() {
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const hydrate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadHymnsData();
      setHymns(data);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  const refetch = useCallback(async () => {
    bustContentCache('hymns');
    await hydrate();
  }, [hydrate]);

  return { hymns, setHymns, loading, error, refetch };
}
