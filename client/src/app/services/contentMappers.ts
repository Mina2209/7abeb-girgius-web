import type { GalleryImage, Hymn, HymnFile, HymnFileType, Saying } from '../types/content';

type ServerTag = { name: string };

export type ServerHymnFile = {
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

export type ServerSayingRow = {
  id: string;
  author: string;
  authorImage?: string | null;
  source?: string | null;
  content: string;
  tags?: ServerTag[];
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

export function mapServerHymnToClient(row: ServerHymn): Hymn {
  const files: HymnFile[] = (row.files ?? []).map((f) => ({
    type: mapFileType(f.type),
    name: f.originalName?.trim() || f.fileUrl || 'ملف',
    url: f.fileUrl,
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
