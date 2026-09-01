import type { GalleryImage, Hymn, HymnFileType, Saying } from '../types/content';
import type { Artist } from '../data/artists';
import type { Father } from '../data/fathers';
import { apiGetJson, apiRequest } from './apiClient';
import { uploadFileToS3, getFileContentType, presignAndUpload } from './s3Upload';
import {
  mapServerAuthorToClient,
  mapServerFatherToClient,
  mapServerHymnToClient,
  mapServerImageToClient,
  mapServerSayingToClient,
  type ServerAuthorRow,
  type ServerFatherRow,
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

function isBase64DataUrl(url: string): boolean {
  return url.startsWith('data:');
}

function base64DataUrlToFile(dataUrl: string, name: string, fileType: string): File {
  const [header, data] = dataUrl.split(',');
  const mimeMatch = header.match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : getFileContentType(fileType);
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

async function ensureFilesUploadedToS3(
  files: { type: string; fileUrl: string; originalName: string; size: number | null }[],
): Promise<{ type: string; fileUrl: string; originalName: string; size: number | null }[]> {
  return Promise.all(
    files.map(async (f) => {
      if (!isBase64DataUrl(f.fileUrl)) return f;
      const file = base64DataUrlToFile(f.fileUrl, f.originalName || 'file', f.type);
      const s3Url = await uploadFileToS3(file, f.type);
      return { ...f, fileUrl: s3Url || f.fileUrl };
    }),
  );
}

/**
 * Upload a picked image to S3 and return the short stored URL.
 *
 * The image modals read files with FileReader as base64 data URLs, which is right for
 * the preview but must never reach the API: `imageUrl` is validated at 2000 characters
 * server-side, and nothing on the server converts base64 to S3 (it only ever deletes
 * from S3). Sending the data URL therefore failed every upload with
 * "imageUrl must not exceed 2000 characters". Uploading here mirrors what hymn files
 * already do via ensureFilesUploadedToS3, and yields the same
 * `/api/uploads/url?key=...` form as the rows written by the previous site.
 */
async function ensureImageUploadedToS3(src: string, title: string): Promise<string> {
  if (!src || !isBase64DataUrl(src)) return src;

  const mime = src.slice(5, src.indexOf(';')) || 'image/jpeg';
  const ext = (mime.split('/')[1] || 'jpg').replace('+xml', '');
  // The server sanitizes the key anyway (non-ASCII becomes '_'), so keep this simple
  // and just strip anything that would be awkward in a filename.
  const safeTitle = (title || 'image').trim().replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60) || 'image';

  const file = base64DataUrlToFile(src, `${safeTitle}.${ext}`, mime);
  const { url } = await presignAndUpload(file, mime, 'Images');
  return url;
}

export async function createHymn(input: Hymn, token?: string | null): Promise<Hymn> {
  const rawFiles = (input.files ?? []).map((f) => ({
    type: mapFileTypeToServer(f.type),
    fileUrl: f.url,
    originalName: f.name,
    size: f.size ?? null,
  }));
  const files = await ensureFilesUploadedToS3(rawFiles);
  const body = {
    title: input.title,
    tags: input.tags,
    files,
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
  const rawFiles = (input.files ?? []).map((f) => ({
    type: mapFileTypeToServer(f.type),
    fileUrl: f.url,
    originalName: f.name,
    size: f.size ?? null,
  }));
  const files = await ensureFilesUploadedToS3(rawFiles);
  const body = {
    title: input.title,
    tags: input.tags,
    files,
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

export async function bulkImportSayings(rows: { content: string; author: string; source?: string; topic?: string }[], token?: string | null): Promise<{ success: boolean; count: number }> {
  const res = await apiRequest('/api/sayings/bulk-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify({ rows }),
  });
  await ensureOk(res, 'Failed to bulk import sayings');
  return res.json();
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
  const imageUrl = await ensureImageUploadedToS3(image.src, image.title);
  const body = {
    title: image.title,
    imageUrl,
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
  const imageUrl = await ensureImageUploadedToS3(image.src, image.title);
  const body = {
    title: image.title,
    imageUrl,
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

export async function createArtist(data: Partial<Artist>, token?: string | null): Promise<Artist> {
  const created = await apiGetJson<ServerAuthorRow>('/api/images/meta/authors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify({ name: data.name }),
  });
  const row = await apiGetJson<ServerAuthorRow>(`/api/images/meta/authors/${created.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify(data),
  });
  return mapServerAuthorToClient(row);
}

export async function updateArtist(id: string, data: Partial<Artist>, token?: string | null): Promise<Artist> {
  const row = await apiGetJson<ServerAuthorRow>(`/api/images/meta/authors/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify(data),
  });
  return mapServerAuthorToClient(row);
}

export async function fetchFathers(token?: string | null): Promise<Father[]> {
  const rows = await apiGetJson<ServerFatherRow[]>('/api/fathers', {
    headers: withAuth(token),
  });
  return rows.map(mapServerFatherToClient);
}

export async function fetchFatherByName(name: string, token?: string | null): Promise<Father | null> {
  try {
    const row = await apiGetJson<ServerFatherRow>(`/api/fathers/by-name/${encodeURIComponent(name)}`, {
      headers: withAuth(token),
    });
    return row ? mapServerFatherToClient(row) : null;
  } catch {
    return null;
  }
}

export async function fetchFatherById(id: string, token?: string | null): Promise<Father | null> {
  try {
    const row = await apiGetJson<ServerFatherRow>(`/api/fathers/${id}`, {
      headers: withAuth(token),
    });
    return row ? mapServerFatherToClient(row) : null;
  } catch {
    return null;
  }
}

export async function createFather(data: Partial<Father>, token?: string | null): Promise<Father> {
  const row = await apiGetJson<ServerFatherRow>('/api/fathers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify(data),
  });
  return mapServerFatherToClient(row);
}

export async function updateFather(id: string, data: Partial<Father>, token?: string | null): Promise<Father> {
  const row = await apiGetJson<ServerFatherRow>(`/api/fathers/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify(data),
  });
  return mapServerFatherToClient(row);
}
