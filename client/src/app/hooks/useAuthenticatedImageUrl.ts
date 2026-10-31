import { useEffect, useState } from 'react';
import { getApiBaseUrl } from '../config/api';
import { apiRequest } from '../services/apiClient';

interface AuthenticatedImageOptions {
  requiresAuth: boolean;
  authToken: string | null;
}

interface ImageState {
  key: string;
  url: string;
  loading: boolean;
  error: Error | null;
}

interface ImageCacheEntry {
  refs: number;
  promise: Promise<string>;
  objectUrl?: string;
  cleanupTimer?: ReturnType<typeof setTimeout>;
  disposed: boolean;
}

const CACHE_CLEANUP_DELAY_MS = 1000;
const imageCache = new Map<string, ImageCacheEntry>();

// Only send the bearer token to this app's upload endpoints. A raw S3 key can
// resolve through a separately configured public media origin, which must never
// receive the API token.
function toApiRequestPath(publicUrl: string): string | null {
  const apiBase = getApiBaseUrl();
  let path: string | null = null;

  if (apiBase && publicUrl.startsWith(`${apiBase}/`)) {
    path = publicUrl.slice(apiBase.length);
  } else if (publicUrl.startsWith('/api/')) {
    path = publicUrl;
  }

  return path?.startsWith('/api/uploads/') ? path : null;
}

async function fetchObjectUrl(path: string, token: string | null): Promise<string> {
  const headers = new Headers({ Accept: 'image/*' });
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await apiRequest(path, { headers });
  if (!response.ok) {
    throw new Error('Image could not be loaded');
  }

  const blob = await response.blob();
  if (!blob.size) {
    throw new Error('Image could not be loaded');
  }

  return URL.createObjectURL(blob);
}

function acquireEntry(key: string, path: string, token: string | null): ImageCacheEntry {
  const existing = imageCache.get(key);
  if (existing) {
    existing.refs += 1;
    if (existing.cleanupTimer) {
      clearTimeout(existing.cleanupTimer);
      existing.cleanupTimer = undefined;
    }
    return existing;
  }

  const entry: ImageCacheEntry = {
    refs: 1,
    disposed: false,
    promise: Promise.resolve(''),
  };

  entry.promise = fetchObjectUrl(path, token)
    .then((objectUrl) => {
      entry.objectUrl = objectUrl;
      if (entry.disposed) {
        URL.revokeObjectURL(objectUrl);
        entry.objectUrl = undefined;
      }
      return objectUrl;
    })
    .catch((error) => {
      if (imageCache.get(key) === entry) imageCache.delete(key);
      throw error;
    });

  imageCache.set(key, entry);
  return entry;
}

function releaseEntry(key: string, entry: ImageCacheEntry): void {
  entry.refs = Math.max(0, entry.refs - 1);
  if (entry.refs > 0) return;

  if (entry.cleanupTimer) clearTimeout(entry.cleanupTimer);
  entry.cleanupTimer = setTimeout(() => {
    if (entry.refs > 0) return;
    if (imageCache.get(key) === entry) imageCache.delete(key);

    entry.disposed = true;
    if (entry.objectUrl) {
      URL.revokeObjectURL(entry.objectUrl);
      entry.objectUrl = undefined;
    }
  }, CACHE_CLEANUP_DELAY_MS);
}

function resolveStateKey(
  publicUrl: string,
  requestPath: string | null,
  token: string | null,
): string {
  return `${requestPath ? 'auth' : 'public'}\n${token ?? ''}\n${publicUrl}`;
}

function initialState(key: string, publicUrl: string, requestPath: string | null): ImageState {
  return {
    key,
    url: requestPath ? '' : publicUrl,
    loading: Boolean(requestPath),
    error: null,
  };
}

/**
 * Resolve an image URL for display. Public images use the browser's normal image
 * loading path; protected images are fetched through apiRequest so the existing
 * bearer-token handling applies. Blob object URLs are cached by URL and token,
 * deduplicated across concurrent callers, and released after the last caller
 * unmounts.
 */
export function useAuthenticatedImageUrl(
  publicUrl: string,
  { requiresAuth, authToken }: AuthenticatedImageOptions,
): { url: string; loading: boolean; error: Error | null } {
  const requestPath = requiresAuth && authToken ? toApiRequestPath(publicUrl) : null;
  const key = resolveStateKey(publicUrl, requestPath, authToken);
  const [state, setState] = useState<ImageState>(() =>
    initialState(key, publicUrl, requestPath),
  );
  const current = state.key === key ? state : initialState(key, publicUrl, requestPath);

  useEffect(() => {
    if (!publicUrl || !requestPath) return;

    let active = true;
    const entry = acquireEntry(key, requestPath, authToken);

    entry.promise.then(
      (url) => {
        if (active) {
          setState({ key, url, loading: false, error: null });
        }
      },
      () => {
        if (active) {
          setState({
            key,
            url: '',
            loading: false,
            error: new Error('Image could not be loaded'),
          });
        }
      },
    );

    return () => {
      active = false;
      releaseEntry(key, entry);
    };
  }, [key, publicUrl, requestPath, authToken]);

  return current;
}
