import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiGetJson, apiPostJson, apiDeleteJson } from '../services/apiClient';
import { getApiBaseUrl } from '../config/api';
import type { ContentId } from '../types/content';
import type { ApiError } from '../services/apiClient';
import { useAuth } from '../contexts/AuthContext';

export type FavoriteContentType = 'HYMN' | 'IMAGE' | 'BOOK' | 'SAYING' | string;

type UseFavoritesResult = {
  // For compatibility across the app, favorites are exposed as string ids.
  favoriteIds: Set<string>;
  count: number;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  toggleFavorite: (contentId: ContentId) => Promise<void>;
  removeFavorite: (contentId: ContentId) => Promise<void>;
  isFavorited: (contentId: ContentId) => boolean;
};

function normalizeContentId(id: ContentId): string {
  return typeof id === 'string' ? id : String(id);
}

export function useFavorites(contentType: FavoriteContentType): UseFavoritesResult {
  const { profile } = useAuth();

  const [favoriteIdsArray, setFavoriteIdsArray] = useState<ContentId[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!profile) {
      setFavoriteIdsArray([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Server: GET /api/favorites/:contentType returns [{contentId}] mapped in controller to ids
      const ids = await apiGetJson<ContentId[]>(`/api/favorites/${encodeURIComponent(String(contentType))}`);
      setFavoriteIdsArray(Array.isArray(ids) ? ids : []);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setFavoriteIdsArray([]);
    } finally {
      setLoading(false);
    }
  }, [contentType, profile]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const favoriteIds = useMemo(
    () => new Set(favoriteIdsArray.map((id) => normalizeContentId(id))),
    [favoriteIdsArray],
  );


  const toggleFavorite = useCallback(
    async (contentId: ContentId) => {
      if (!profile) return;
      setLoading(true);
      setError(null);
      try {
        await apiPostJson(`/api/favorites/${encodeURIComponent(String(contentType))}/${encodeURIComponent(String(normalizeContentId(contentId)))}/toggle`, {});
        // Optimistic update: decide based on previous set
        const contentIdStr = normalizeContentId(contentId);
        const isCurrentlyFavorited = Array.from(favoriteIds).some((id) => normalizeContentId(id) === contentIdStr);
        setFavoriteIdsArray((prev) => {
          if (isCurrentlyFavorited) {
            return prev.filter((id) => normalizeContentId(id) !== contentIdStr);
          }
          return [...prev, contentId];
        });
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        await refresh();
      } finally {
        setLoading(false);
      }
    },
    [contentType, favoriteIds, profile, refresh],
  );

  const removeFavorite = useCallback(
    async (contentId: ContentId) => {
      if (!profile) return;
      setLoading(true);
      setError(null);
      try {
        // Server has only toggle; remove via toggle if already favorited
        await toggleFavorite(contentId);
        // toggleFavorite handles optimistic update
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        await refresh();
      } finally {
        setLoading(false);
      }
    },
    [profile, refresh, toggleFavorite],
  );

  const isFavorited = useCallback(
    (contentId: ContentId) => favoriteIds.has(normalizeContentId(contentId)),
    [favoriteIds],
  );

  return {
    favoriteIds,
    count: favoriteIds.size,
    loading,
    error,
    refresh,
    toggleFavorite,
    removeFavorite,
    isFavorited,
  };
}

