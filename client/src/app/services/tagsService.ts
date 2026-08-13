import { isApiConfigured } from '../config/api';
import { apiGetJson, apiRequest } from './apiClient';

export type ServerTag = {
  id: string;
  name: string;
  order?: number;
  sectionId?: string | null;
  category?: string;
  section?: ServerTagSection | null;
  _count?: { hymns: number; sayings: number; images: number };
};

export type ServerTagSection = {
  id: string;
  name: string;
  order: number;
  _count?: { tags: number };
  tags?: ServerTag[];
};

export interface Section {
  id: string;
  name: string;
  order: number;
}

export interface Topic {
  id: string;
  name: string;
  sectionId: string | null;
  order: number;
}

export interface TopicsBySection {
  section: Section;
  topics: string[];
}

export const TAGS_UPDATED_EVENT = 'adhg:tags-updated';

const LEGACY_KEYS = ['universal_topics', 'topic_sections', 'universal_topics_version'] as const;

export function clearLegacyTopicStorage() {
  for (const key of LEGACY_KEYS) {
    localStorage.removeItem(key);
  }
}

export function notifyTagsUpdated() {
  window.dispatchEvent(new Event(TAGS_UPDATED_EVENT));
}

function withAuth(token?: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function ensureOk(res: Response, message: string) {
  if (res.ok) return;
  const detail = await res.text().catch(() => '');
  throw new Error(detail || message);
}

// ─── TagSection CRUD ────────────────────────────────────────────

export async function fetchAllSections(): Promise<ServerTagSection[]> {
  if (!isApiConfigured()) {
    throw new Error('VITE_API_BASE_URL is required for tag sections');
  }
  const rows = await apiGetJson<ServerTagSection[]>('/api/tag-sections');
  if (!Array.isArray(rows)) throw new Error('Invalid sections response');
  return rows;
}

export async function createSection(
  name: string,
  token?: string | null,
): Promise<ServerTagSection> {
  const res = await apiRequest('/api/tag-sections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify({ name: name.trim() }),
  });
  await ensureOk(res, 'Failed to create section');
  return res.json() as Promise<ServerTagSection>;
}

export async function updateSection(
  id: string,
  name: string,
  token?: string | null,
): Promise<ServerTagSection> {
  const res = await apiRequest(`/api/tag-sections/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify({ name: name.trim() }),
  });
  await ensureOk(res, 'Failed to update section');
  return res.json() as Promise<ServerTagSection>;
}

export async function deleteSection(
  id: string,
  token?: string | null,
): Promise<void> {
  const res = await apiRequest(`/api/tag-sections/${id}`, {
    method: 'DELETE',
    headers: { ...withAuth(token) },
  });
  await ensureOk(res, 'Failed to delete section');
}

export async function reorderSections(
  orderedIds: string[],
  token?: string | null,
): Promise<void> {
  const res = await apiRequest('/api/tag-sections/reorder/batch', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify({ orderedIds }),
  });
  await ensureOk(res, 'Failed to reorder sections');
}

// ─── Tag CRUD ────────────────────────────────────────────────────

export async function fetchAllTags(): Promise<ServerTag[]> {
  if (!isApiConfigured()) {
    throw new Error('VITE_API_BASE_URL is required for tags');
  }
  const rows = await apiGetJson<ServerTag[]>('/api/tags');
  if (!Array.isArray(rows)) throw new Error('Invalid tags response');
  return rows;
}

export async function createTag(
  data: { name: string; sectionId?: string | null },
  token?: string | null,
): Promise<ServerTag> {
  const res = await apiRequest('/api/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify({
      name: data.name.trim(),
      sectionId: data.sectionId || null,
    }),
  });
  await ensureOk(res, 'Failed to create tag');
  return res.json() as Promise<ServerTag>;
}

export async function updateTag(
  id: string,
  data: { name?: string; sectionId?: string | null },
  token?: string | null,
): Promise<ServerTag> {
  const body: { name?: string; sectionId?: string | null } = {};
  if (data.name !== undefined) body.name = data.name.trim();
  if (data.sectionId !== undefined) body.sectionId = data.sectionId || null;

  const res = await apiRequest(`/api/tags/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify(body),
  });
  await ensureOk(res, 'Failed to update tag');
  return res.json() as Promise<ServerTag>;
}

export async function deleteTag(id: string, token?: string | null): Promise<void> {
  const res = await apiRequest(`/api/tags/${id}`, {
    method: 'DELETE',
    headers: { ...withAuth(token) },
  });
  await ensureOk(res, 'Failed to delete tag');
}

export async function reorderTags(
  orderedIds: string[],
  token?: string | null,
): Promise<void> {
  const res = await apiRequest('/api/tags/reorder/batch', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify({ orderedIds }),
  });
  await ensureOk(res, 'Failed to reorder tags');
}

// ─── Mapping helpers ─────────────────────────────────────────────

export function mapTagsToSectionsAndTopics(
  tags: ServerTag[],
  sections: Section[],
): { sections: Section[]; topics: Topic[] } {
  const topics: Topic[] = tags.map((tag, idx) => ({
    id: tag.id,
    name: tag.name,
    sectionId: tag.sectionId || null,
    order: tag.order ?? idx,
  }));
  topics.sort((a, b) => a.order - b.order);
  return { sections, topics };
}

export function groupTopicsBySection(sections: Section[], topics: Topic[]): TopicsBySection[] {
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  const sectionIds = new Set(sortedSections.map((s) => s.id));

  const result: TopicsBySection[] = sortedSections
    .map((section) => ({
      section,
      topics: topics
        .filter((t) => t.sectionId === section.id)
        .sort((a, b) => a.order - b.order)
        .map((t) => t.name),
    }))
    .filter((group) => group.topics.length > 0);

  const unassigned = topics
    .filter((t) => !t.sectionId || !sectionIds.has(t.sectionId))
    .sort((a, b) => a.order - b.order)
    .map((t) => t.name);

  if (unassigned.length > 0) {
    result.push({
      section: { id: '__default__', name: 'مواضيع متنوعة', order: Infinity },
      topics: unassigned,
    });
  }

  return result;
}
