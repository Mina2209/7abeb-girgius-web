import { useCallback, useEffect, useState } from 'react';
import type { ServerTag } from '../services/tagsService';
import { fetchAllTags } from '../services/tagsService';

export function useTags() {
  const [tags, setTags] = useState<ServerTag[]>([]);
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);

  const loadTags = useCallback(async () => {
    setIsLoadingTags(true);
    setTagsError(null);
    try {
      const rows = await fetchAllTags();
      setTags(rows);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء جلب التصنيفات';
      setTagsError(message);
      // eslint-disable-next-line no-console
      console.error('فشل جلب tags:', err);
    } finally {
      setIsLoadingTags(false);
    }
  }, []);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  return {
    tags,
    isLoadingTags,
    tagsError,
    reloadTags: loadTags,
  };
}

