import type { GalleryImage, Hymn, HymnFileType, Saying } from '../types/content';
import type { Artist } from '../data/artists';
import { apiGetJson, apiRequest } from './apiClient';
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

type AuthHeaders = Record<string, string>;

function withAuth(token?: string | null): AuthHeaders {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function ensureOk(res: Response, defaultMessage: string) {
  if (res.ok) return;
  const detail = await res.text().catch(() => '');
  throw new Error(detail || defaultMessage);
}

function mapFileTypeToServer(t: HymnFileType): string {
  if (t === 'Video montage') return 'VIDEO_MONTAGE';
  if (t === 'Video PowerPoint') return 'VIDEO_POWERPOINT';
  if (t === 'PowerPoint file') return 'POWERPOINT';
  return 'MUSIC_AUDIO';
}

export async function createHymn(input: Hymn, token?: string | null): Promise<Hymn> {
  const body = {
    title: input.title,
    tags: input.tags,
    files: (input.files ?? []).map((f) => ({
      type: mapFileTypeToServer(f.type),
      fileUrl: f.url,
      originalName: f.name,
      size: f.size ?? null,
    })),
  };
  const row = await apiGetJson<ServerHymn>('/api/hymns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify(body),
  });
  if (input.lyrics.trim()) {
    const lyricRes = await apiRequest(`/api/lyrics/hymn/${row.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...withAuth(token) },
      body: JSON.stringify({ content: input.lyrics }),
    });
    await ensureOk(lyricRes, 'Failed to save hymn lyrics');
  }
  return mapServerHymnToClient(row);
}

export async function updateHymn(id: string, input: Hymn, token?: string | null): Promise<Hymn> {
  const body = {
    title: input.title,
    tags: input.tags,
    files: (input.files ?? []).map((f) => ({
      type: mapFileTypeToServer(f.type),
      fileUrl: f.url,
      originalName: f.name,
      size: f.size ?? null,
    })),
  };
  const row = await apiGetJson<ServerHymn>(`/api/hymns/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify(body),
  });
  const lyricRes = await apiRequest(`/api/lyrics/hymn/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify({ content: input.lyrics ?? '' }),
  });
  await ensureOk(lyricRes, 'Failed to update hymn lyrics');
  return mapServerHymnToClient(row);
}

export async function deleteHymn(id: string, token?: string | null): Promise<void> {
  const res = await apiRequest(`/api/hymns/${id}`, {
    method: 'DELETE',
    headers: withAuth(token),
  });
  await ensureOk(res, 'Failed to delete hymn');
}

export async function createSaying(input: Saying, token?: string | null): Promise<Saying> {
  const body = {
    author: input.author,
    authorImage: input.authorImage || null,
    source: input.source || null,
    content: input.quote,
    tags: input.tags,
  };
  const row = await apiGetJson<ServerSayingRow>('/api/sayings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify(body),
  });
  return mapServerSayingToClient(row);
}

export async function updateSaying(id: string, input: Saying, token?: string | null): Promise<Saying> {
  const body = {
    author: input.author,
    authorImage: input.authorImage || null,
    source: input.source || null,
    content: input.quote,
    tags: input.tags,
  };
  const row = await apiGetJson<ServerSayingRow>(`/api/sayings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify(body),
  });
  return mapServerSayingToClient(row);
}

export async function deleteSaying(id: string, token?: string | null): Promise<void> {
  const res = await apiRequest(`/api/sayings/${id}`, {
    method: 'DELETE',
    headers: withAuth(token),
  });
  await ensureOk(res, 'Failed to delete saying');
}

async function resolveImageMetaIds(image: GalleryImage, token?: string | null) {
  const auth = withAuth(token);
  const [authors, types] = await Promise.all([
    apiGetJson<Array<{ id: string; name: string }>>('/api/images/meta/authors', { headers: auth }),
    apiGetJson<Array<{ id: string; name: string }>>('/api/images/meta/types', { headers: auth }),
  ]);
  let authorId = authors.find((a) => a.name === image.artist)?.id;
  let typeId = types.find((t) => t.name === image.type)?.id;

  if (!authorId && image.artist.trim()) {
    const created = await apiGetJson<{ id: string; name: string }>('/api/images/meta/authors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ name: image.artist.trim() }),
    });
    authorId = created.id;
  }
  if (!typeId && image.type.trim()) {
    const created = await apiGetJson<{ id: string; name: string }>('/api/images/meta/types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ name: image.type.trim() }),
    });
    typeId = created.id;
  }
  return { authorId: authorId ?? null, typeId: typeId ?? null };
}

export async function createImage(image: GalleryImage, token?: string | null): Promise<GalleryImage> {
  const { authorId, typeId } = await resolveImageMetaIds(image, token);
  const body = {
    title: image.title,
    imageUrl: image.src,
    tags: image.tags,
    ai: image.aiGenerated,
    published: image.published,
    authorId,
    typeId,
  };
  const row = await apiGetJson<ServerImageRow>('/api/images', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify(body),
  });
  return mapServerImageToClient(row);
}

export async function updateImage(id: string, image: GalleryImage, token?: string | null): Promise<GalleryImage> {
  const { authorId, typeId } = await resolveImageMetaIds(image, token);
  const body = {
    title: image.title,
    imageUrl: image.src,
    tags: image.tags,
    ai: image.aiGenerated,
    published: image.published,
    authorId,
    typeId,
  };
  const row = await apiGetJson<ServerImageRow>(`/api/images/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify(body),
  });
  return mapServerImageToClient(row);
}

export async function deleteImage(id: string, token?: string | null): Promise<void> {
  const res = await apiRequest(`/api/images/${id}`, {
    method: 'DELETE',
    headers: withAuth(token),
  });
  await ensureOk(res, 'Failed to delete image');
}

export async function updateArtist(id: string, data: Partial<Artist>, token?: string | null): Promise<Artist> {
  const row = await apiGetJson<ServerAuthorRow>(`/api/images/meta/authors/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify(data),
  });
  return mapServerAuthorToClient(row);
}
