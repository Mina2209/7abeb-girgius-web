import { isApiConfigured } from '../config/api';
import type { GalleryImage, Hymn, Saying } from '../types/content';
import { apiGetJson } from './apiClient';
import {
  mapServerAuthorToClient,
  mapServerHymnToClient,
  mapServerImageToClient,
  mapServerSayingToClient,
  type ServerAuthorRow,
  type ServerHymn,
  type ServerImageRow,
  type ServerSayingRow,
} from './contentMappers';
import type { Artist } from '../data/artists';

async function fetchHymnsRemote(): Promise<Hymn[]> {
  const rows = await apiGetJson<ServerHymn[]>('/api/hymns');
  if (!Array.isArray(rows)) throw new Error('Invalid hymns response');
  return rows.map(mapServerHymnToClient);
}

type ImagePage = { data: ServerImageRow[]; total: number; page: number; limit: number };

async function fetchAllGalleryRemote(): Promise<GalleryImage[]> {
  const limit = 100;
  let page = 1;
  const all: ServerImageRow[] = [];
  let total = Infinity;
  while (all.length < total) {
    const res = await apiGetJson<ImagePage>(`/api/images?page=${page}&limit=${limit}`);
    if (!res?.data || !Array.isArray(res.data)) throw new Error('Invalid images response');
    all.push(...res.data);
    total = typeof res.total === 'number' ? res.total : all.length;
    if (!res.data.length) break;
    page += 1;
  }
  return all.map(mapServerImageToClient);
}

async function fetchSayingsRemote(): Promise<Saying[]> {
  const rows = await apiGetJson<ServerSayingRow[]>('/api/sayings');
  if (!Array.isArray(rows)) throw new Error('Invalid sayings response');
  return rows.map(mapServerSayingToClient);
}

const promiseCache = new Map<string, Promise<unknown>>();

function cacheKey(kind: string) {
  return kind;
}

export function bustContentCache(kind: 'hymns' | 'sayings' | 'gallery') {
  promiseCache.delete(cacheKey(kind));
}

export function loadHymnsData(): Promise<Hymn[]> {
  const k = cacheKey('hymns');
  let p = promiseCache.get(k) as Promise<Hymn[]> | undefined;
  if (!p) {
    p = (async (): Promise<Hymn[]> => {
      if (!isApiConfigured()) {
        throw new Error('VITE_API_BASE_URL is required for hymns');
      }
      return fetchHymnsRemote();
    })();
    promiseCache.set(k, p);
  }
  return p;
}

export function loadSayingsData(): Promise<Saying[]> {
  const k = cacheKey('sayings');
  let p = promiseCache.get(k) as Promise<Saying[]> | undefined;
  if (!p) {
    p = (async (): Promise<Saying[]> => {
      if (!isApiConfigured()) {
        throw new Error('VITE_API_BASE_URL is required for sayings');
      }
      return fetchSayingsRemote();
    })();
    promiseCache.set(k, p);
  }
  return p;
}

export function loadGalleryImagesData(): Promise<GalleryImage[]> {
  const k = cacheKey('gallery');
  let p = promiseCache.get(k) as Promise<GalleryImage[]> | undefined;
  if (!p) {
    p = (async (): Promise<GalleryImage[]> => {
      if (!isApiConfigured()) {
        throw new Error('VITE_API_BASE_URL is required for gallery images');
      }
      return fetchAllGalleryRemote();
    })();
    promiseCache.set(k, p);
  }
  return p;
}

// ---------------------------------------------------------------------------
// Server-driven (paged) gallery loading — used by the image library so it can
// fetch one page at a time with server-side search / filters / sort.
// ---------------------------------------------------------------------------

export type GalleryQuery = {
  page?: number;
  limit?: number;
  search?: string;
  tags?: string[];
  artists?: string[];
  types?: string[];
  ai?: 'all' | 'yes' | 'no';
  ids?: string[];
  sort?: string; // backend sort key: 'date-desc' | 'date-asc' | 'title-asc' | 'title-desc'
  token?: string | null; // editor token -> includes unpublished images
};

function galleryParams(q: GalleryQuery): URLSearchParams {
  const p = new URLSearchParams();
  if (q.search?.trim()) p.set('search', q.search.trim());
  if (q.tags?.length) p.set('tags', q.tags.join(','));
  if (q.artists?.length) p.set('artists', q.artists.join(','));
  if (q.types?.length) p.set('types', q.types.join(','));
  if (q.ai && q.ai !== 'all') p.set('ai', q.ai);
  if (q.sort) p.set('sort', q.sort);
  return p;
}

function authInit(token?: string | null): RequestInit | undefined {
  return token ? { headers: { Authorization: `Bearer ${token}` } } : undefined;
}

export async function fetchGalleryPage(
  q: GalleryQuery,
): Promise<{ items: GalleryImage[]; total: number; page: number }> {
  const p = galleryParams(q);
  p.set('page', String(q.page ?? 1));
  p.set('limit', String(q.limit ?? 30));
  if (q.ids?.length) p.set('ids', q.ids.join(','));
  const res = await apiGetJson<{ data: ServerImageRow[]; total: number; page: number }>(
    `/api/images?${p.toString()}`,
    authInit(q.token),
  );
  return {
    items: (res.data ?? []).map(mapServerImageToClient),
    total: res.total ?? 0,
    page: res.page ?? (q.page ?? 1),
  };
}

// All image IDs matching the current filters (for "select all" across pages).
export async function fetchGalleryIds(q: GalleryQuery): Promise<string[]> {
  const p = galleryParams(q);
  return apiGetJson<string[]>(`/api/images/ids?${p.toString()}`, authInit(q.token));
}

// Fetch specific images by id (e.g. favorites), chunked to respect the server's page cap.
export async function fetchGalleryByIds(
  ids: string[],
  token?: string | null,
): Promise<GalleryImage[]> {
  if (!ids.length) return [];
  const out: GalleryImage[] = [];
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const res = await apiGetJson<{ data: ServerImageRow[] }>(
      `/api/images?ids=${chunk.join(',')}&limit=100`,
      authInit(token),
    );
    out.push(...(res.data ?? []).map(mapServerImageToClient));
  }
  return out;
}

export async function fetchArtistById(id: string): Promise<Artist | null> {
  try {
    const row = await apiGetJson<ServerAuthorRow>(`/api/images/meta/authors/${id}`);
    return row ? mapServerAuthorToClient(row) : null;
  } catch {
    return null;
  }
}

export async function fetchImageArtists(): Promise<string[]> {
  const rows = await apiGetJson<{ name: string }[]>('/api/images/meta/authors');
  return (rows ?? []).map((r) => r.name).filter(Boolean);
}

export async function fetchImageTypes(): Promise<string[]> {
  const rows = await apiGetJson<{ name: string }[]>('/api/images/meta/types');
  return (rows ?? []).map((r) => r.name).filter(Boolean);
}

// Faceted filter options for the current filter selection (each facet excludes its own filter),
// so the dropdowns narrow as you select — computed server-side to work with pagination.
export async function fetchGalleryFacets(
  q: GalleryQuery,
): Promise<{ tags: string[]; artists: string[]; types: string[]; ai: ('yes' | 'no')[] }> {
  const p = galleryParams(q);
  const res = await apiGetJson<{ tags: string[]; artists: string[]; types: string[]; ai: string[] }>(
    `/api/images/facets?${p.toString()}`,
    authInit(q.token),
  );
  return {
    tags: res.tags ?? [],
    artists: res.artists ?? [],
    types: res.types ?? [],
    ai: (res.ai ?? []).filter((v): v is 'yes' | 'no' => v === 'yes' || v === 'no'),
  };
}
