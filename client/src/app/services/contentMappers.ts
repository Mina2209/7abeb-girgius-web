import type { GalleryImage, Hymn, HymnFile, HymnFileType, Saying } from '../types/content';
import { getApiBaseUrl } from '../config/api';
import type { Artist } from '../data/artists';
import type { Father } from '../data/fathers';

type ServerTag = { name: string };

type ServerHymnFile = {
  type: string;
  fileUrl: string;
  originalName?: string | null;
  size?: number | null;
  duration?: number | null;
};

export type ServerHymn = {
  id: string;
  title: string;
  tags?: ServerTag[];
  files?: ServerHymnFile[];
  lyric?: { content: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type ServerImageRow = {
  id: string;
  title: string;
  imageUrl: string;
  tags?: ServerTag[];
  author?: { name: string } | null;
  type?: { name: string } | null;
  ai?: boolean;
  published?: boolean;
  createdAt: string;
};

export type ServerAuthorRow = {
  id: string;
  name: string;
  bio?: string | null;
  role?: string | null;
  profileImage?: string | null;
  facebook?: string | null;
  instagram?: string | null;
  website?: string | null;
  email?: string | null;
  joinDate: string;
  specialty: string[];
  _count?: { images: number };
};

export type ServerSayingRow = {
  id: string;
  author: string;
  authorImage?: string | null;
  source?: string | null;
  content: string;
  tags?: ServerTag[];
  createdAt: string;
};

export type ServerFatherRow = {
  id: string;
  name: string;
  title?: string | null;
  bio?: string | null;
  profileImage?: string | null;
  createdAt: string;
};

const FILE_TYPE_MAP: Record<string, HymnFileType> = {
  VIDEO_MONTAGE: 'Video montage',
  VIDEO_POWERPOINT: 'Video PowerPoint',
  POWERPOINT: 'PowerPoint file',
  MUSIC_AUDIO: 'Music',
};

function mapFileType(t: string): HymnFileType {
  return FILE_TYPE_MAP[t] ?? 'Music';
}

function formatDurationSeconds(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Resolve a stored file URL to something the browser can actually fetch.
 *
 * Rows written by the old site hold an absolute URL; rows written by newer code hold a
 * relative `/api/uploads/url?key=…`. The frontend is served from an S3 website bucket,
 * a different origin to the API with no proxy in front of it, so a relative path would
 * resolve against the bucket. Normalising here covers every consumer of `file.url` —
 * preview, download and the anchor hrefs — regardless of which form was stored.
 */
function resolveFileUrl(fileUrl: string): string {
  if (!fileUrl) return fileUrl;
  if (/^(https?:|data:|blob:)/.test(fileUrl)) return fileUrl;
  if (fileUrl.startsWith('/api/')) return `${getApiBaseUrl()}${fileUrl}`;
  return fileUrl;
}

export function mapServerHymnToClient(row: ServerHymn): Hymn {
  const files: HymnFile[] = (row.files ?? []).map((f) => ({
    type: mapFileType(f.type),
    name: f.originalName?.trim() || f.fileUrl || 'ملف',
    url: resolveFileUrl(f.fileUrl),
    size: f.size ?? undefined,
  }));
  const fileTypes = [...new Set(files.map((f) => f.type))] as HymnFileType[];
  const durations = (row.files ?? [])
    .map((f) => f.duration)
    .filter((d): d is number => typeof d === 'number' && Number.isFinite(d));
  const maxDur = durations.length ? Math.max(...durations) : null;
  const createdAt = row.createdAt ? row.createdAt.slice(0, 10) : '';
  const updatedAt = row.updatedAt ? row.updatedAt.slice(0, 10) : createdAt;
  return {
    id: row.id,
    title: row.title,
    duration: formatDurationSeconds(maxDur),
    tags: (row.tags ?? []).map((t) => t.name),
    createdAt,
    updatedAt,
    fileTypes: fileTypes.length ? fileTypes : ['Music'],
    lyrics: row.lyric?.content ?? '',
    files: files.length ? files : undefined,
  };
}

export function mapServerImageToClient(row: ServerImageRow): GalleryImage {
  return {
    id: row.id,
    src: row.imageUrl,
    title: row.title,
    tags: (row.tags ?? []).map((t) => t.name),
    artist: row.author?.name ?? '',
    type: row.type?.name ?? '',
    aiGenerated: !!row.ai,
    uploadDate: row.createdAt ? row.createdAt.slice(0, 10) : '',
    published: !!row.published,
  };
}

export function mapServerSayingToClient(row: ServerSayingRow): Saying {
  return {
    id: row.id,
    quote: row.content,
    author: row.author,
    authorImage: row.authorImage ?? '',
    tags: (row.tags ?? []).map((t) => t.name),
    source: row.source ?? '',
    dateAdded: row.createdAt ? row.createdAt.slice(0, 10) : '',
  };
}

export function mapServerFatherToClient(row: ServerFatherRow): Father {
  return {
    id: row.id,
    name: row.name,
    title: row.title ?? '',
    bio: row.bio ?? '',
    profileImage: row.profileImage ?? '',
  };
}

export function mapServerAuthorToClient(row: ServerAuthorRow): Artist {
  return {
    id: row.id,
    name: row.name,
    bio: row.bio ?? '',
    role: row.role ?? '',
    profileImage: row.profileImage ?? '',
    socialMedia: {
      facebook: row.facebook ?? undefined,
      instagram: row.instagram ?? undefined,
      website: row.website ?? undefined,
      email: row.email ?? undefined,
    },
    joinDate: row.joinDate ? row.joinDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    specialty: row.specialty ?? [],
  };
}
