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
