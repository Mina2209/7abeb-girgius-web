import { useCallback, useEffect, useState } from 'react';
import type { Saying } from '../types/content';
import { bustContentCache, loadSayingsData } from '../services/contentLoaders';

export function useSayingsData() {
  const [sayings, setSayings] = useState<Saying[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const hydrate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadSayingsData();
      setSayings(data);
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
    bustContentCache('sayings');
    await hydrate();
  }, [hydrate]);

  return { sayings, setSayings, loading, error, refetch };
}
