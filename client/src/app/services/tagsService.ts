import { isApiConfigured } from '../config/api';
import { apiGetJson, apiRequest } from './apiClient';

export type ServerTag = {
  id: string;
  name: string;
  category: string | null;
  hymns?: unknown[];
  sayings?: unknown[];
};

export interface Section {
  id: string;
  name: string;
  order: number;
}

export interface Topic {
  id: string;
  name: string;
  sectionId: string;
  order: number;
}

export interface TopicsBySection {
  section: Section;
  topics: string[];
}

export const DEFAULT_CATEGORY = 'مواضيع متنوعة';

export const DEFAULT_SECTIONS: Section[] = [
  { id: 'الأعياد السيدية', name: 'الأعياد السيدية', order: 1 },
  { id: 'مناسبات كنسية', name: 'مناسبات كنسية', order: 2 },
  { id: 'أسرار كنسية', name: 'أسرار كنسية', order: 3 },
  { id: 'فضائل روحية', name: 'فضائل روحية', order: 4 },
  { id: 'شخصيات كتابية', name: 'شخصيات كتابية', order: 5 },
  { id: DEFAULT_CATEGORY, name: DEFAULT_CATEGORY, order: 6 },
];

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

export function resolveCategory(category: string | null | undefined): string {
  const trimmed = category?.trim();
  return trimmed || DEFAULT_CATEGORY;
}

export function mapTagsToSectionsAndTopics(tags: ServerTag[]): {
  sections: Section[];
  topics: Topic[];
} {
  const categoriesFromTags = new Set(tags.map((t) => resolveCategory(t.category)));
  const knownNames = new Set(DEFAULT_SECTIONS.map((s) => s.name));

  const extraSections: Section[] = Array.from(categoriesFromTags)
    .filter((name) => !knownNames.has(name))
    .map((name, index) => ({
      id: name,
      name,
      order: DEFAULT_SECTIONS.length + index + 1,
    }));

  const sections = [...DEFAULT_SECTIONS, ...extraSections].sort((a, b) => a.order - b.order);

  const topics: Topic[] = [];
  for (const section of sections) {
    const sectionTags = tags
      .filter((t) => resolveCategory(t.category) === section.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    sectionTags.forEach((tag, index) => {
      topics.push({
        id: tag.id,
        name: tag.name,
        sectionId: section.id,
        order: index + 1,
      });
    });
  }

  return { sections, topics };
}

export function groupTopicsBySection(sections: Section[], topics: Topic[]): TopicsBySection[] {
  const sortedSections = [...sections].sort((a, b) => a.order - b.order);
  return sortedSections
    .map((section) => ({
      section,
      topics: topics
        .filter((t) => t.sectionId === section.id)
        .sort((a, b) => a.order - b.order)
        .map((t) => t.name),
    }))
    .filter((group) => group.topics.length > 0);
}

export async function fetchAllTags(): Promise<ServerTag[]> {
  if (!isApiConfigured()) {
    throw new Error('VITE_API_BASE_URL is required for tags');
  }
  const rows = await apiGetJson<ServerTag[]>('/api/tags');
  if (!Array.isArray(rows)) throw new Error('Invalid tags response');
  return rows;
}

export async function createTag(
  data: { name: string; category?: string | null },
  token?: string | null,
): Promise<ServerTag> {
  const res = await apiRequest('/api/tags', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...withAuth(token) },
    body: JSON.stringify({
      name: data.name.trim(),
      category: data.category?.trim() || null,
    }),
  });
  await ensureOk(res, 'Failed to create tag');
  return res.json() as Promise<ServerTag>;
}

export async function updateTag(
  id: string,
  data: { name?: string; category?: string | null },
  token?: string | null,
): Promise<ServerTag> {
  const body: { name?: string; category?: string | null } = {};
  if (data.name !== undefined) body.name = data.name.trim();
  if (data.category !== undefined) {
    body.category = data.category?.trim() || null;
  }

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
