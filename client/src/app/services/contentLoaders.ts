import { isApiConfigured } from '../config/api';
import type { GalleryImage, Hymn, Saying } from '../types/content';
import { apiGetJson } from './apiClient';
import {
  mapServerHymnToClient,
  mapServerImageToClient,
  mapServerSayingToClient,
  type ServerHymn,
  type ServerImageRow,
  type ServerSayingRow,
} from './contentMappers';

// The hymns endpoint paginates server-side (default 50, hard cap 100 per page) and
// answers with a bare array carrying no `total`, so a single request silently returns
// a truncated list with no way for the caller to notice. Page through until a short
// page comes back, which is the only reliable end-of-list signal this endpoint gives.
const HYMN_PAGE_LIMIT = 100;
const HYMN_MAX_PAGES = 200; // safety stop; 20k hymns is far beyond any real dataset

async function fetchHymnRowsRemote(extraParams = ''): Promise<ServerHymn[]> {
  const all: ServerHymn[] = [];
  for (let page = 1; page <= HYMN_MAX_PAGES; page += 1) {
    const qs = `page=${page}&limit=${HYMN_PAGE_LIMIT}${extraParams ? `&${extraParams}` : ''}`;
    const rows = await apiGetJson<ServerHymn[]>(`/api/hymns?${qs}`);
    if (!Array.isArray(rows)) throw new Error('Invalid hymns response');
    all.push(...rows);
    if (rows.length < HYMN_PAGE_LIMIT) break;
  }
  return all;
}

async function fetchHymnsRemote(): Promise<Hymn[]> {
  const rows = await fetchHymnRowsRemote();
  return rows.map(mapServerHymnToClient);
}

/**
 * Server-filtered hymns (search / tags / fileTypes / sort / favorites).
 *
 * Returns fully mapped `Hymn` objects. Callers must not use the raw rows: the server
 * shape differs from `Hymn` in every field that matters -- tags arrive as objects
 * rather than strings, lyrics live under `lyric.content`, file URLs under `fileUrl`,
 * and `fileTypes` / `duration` are derived, not sent.
 */
export async function fetchHymnsFiltered(params: string): Promise<Hymn[]> {
  const rows = await fetchHymnRowsRemote(params);
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

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  promise: Promise<unknown>;
  expiresAt: number;
}

const promiseCache = new Map<string, CacheEntry>();

function cacheKey(kind: string) {
  return kind;
}

function getFromCache<T>(kind: string): Promise<T> | undefined {
  const entry = promiseCache.get(cacheKey(kind));
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    promiseCache.delete(cacheKey(kind));
    return undefined;
  }
  return entry.promise as Promise<T>;
}

function setCache(kind: string, promise: Promise<unknown>) {
  promiseCache.set(cacheKey(kind), {
    promise,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

export function bustContentCache(kind: 'hymns' | 'sayings' | 'gallery') {
  promiseCache.delete(cacheKey(kind));
}

export function loadHymnsData(): Promise<Hymn[]> {
  const cached = getFromCache<Hymn[]>('hymns');
  if (cached) return cached;
  const p = (async (): Promise<Hymn[]> => {
    if (!isApiConfigured()) {
      throw new Error('VITE_API_BASE_URL is required for hymns');
    }
    return fetchHymnsRemote();
  })();
  setCache('hymns', p);
  return p;
}

export function loadSayingsData(): Promise<Saying[]> {
  const cached = getFromCache<Saying[]>('sayings');
  if (cached) return cached;
  const p = (async (): Promise<Saying[]> => {
    if (!isApiConfigured()) {
      throw new Error('VITE_API_BASE_URL is required for sayings');
    }
    return fetchSayingsRemote();
  })();
  setCache('sayings', p);
  return p;
}

export function loadGalleryImagesData(): Promise<GalleryImage[]> {
  const cached = getFromCache<GalleryImage[]>('gallery');
  if (cached) return cached;
  const p = (async (): Promise<GalleryImage[]> => {
    if (!isApiConfigured()) {
      throw new Error('VITE_API_BASE_URL is required for gallery images');
    }
    return fetchAllGalleryRemote();
  })();
  setCache('gallery', p);
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
