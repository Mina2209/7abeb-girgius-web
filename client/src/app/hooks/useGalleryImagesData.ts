import { useCallback, useEffect, useState } from 'react';
import type { GalleryImage } from '../types/content';
import { bustContentCache, loadGalleryImagesData } from '../services/contentLoaders';

export function useGalleryImagesData() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const hydrate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadGalleryImagesData();
      setImages(data);
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
    bustContentCache('gallery');
    await hydrate();
  }, [hydrate]);

  return { images, setImages, loading, error, refetch };
}
