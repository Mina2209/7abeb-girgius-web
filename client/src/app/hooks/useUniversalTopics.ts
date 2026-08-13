import { useState, useEffect, useCallback } from 'react';
import {
  clearLegacyTopicStorage,
  fetchAllSections,
  fetchAllTags,
  groupTopicsBySection,
  mapTagsToSectionsAndTopics,
  TAGS_UPDATED_EVENT,
  type Section,
  type Topic,
  type TopicsBySection,
} from '../services/tagsService';

export type { Topic, Section, TopicsBySection };

/**
 * Loads universal topics (tags) from the API, grouped by section.
 * Sections are fetched from /api/tag-sections, tags from /api/tags.
 */
export function useUniversalTopics() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [topicNames, setTopicNames] = useState<string[]>([]);
  const [topicsBySection, setTopicsBySection] = useState<TopicsBySection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      clearLegacyTopicStorage();
      const [serverSections, tags] = await Promise.all([
        fetchAllSections(),
        fetchAllTags(),
      ]);
      const sectionList: Section[] = serverSections.map((s, idx) => ({
        id: s.id,
        name: s.name,
        order: s.order ?? idx,
      }));
      const { topics: nextTopics } = mapTagsToSectionsAndTopics(tags, sectionList);
      setSections(sectionList);
      setTopics(nextTopics);
      setTopicNames(nextTopics.map((t) => t.name));
      setTopicsBySection(groupTopicsBySection(sectionList, nextTopics));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tags');
      setSections([]);
      setTopics([]);
      setTopicNames([]);
      setTopicsBySection([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const onUpdated = () => {
      loadData();
    };
    window.addEventListener(TAGS_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(TAGS_UPDATED_EVENT, onUpdated);
  }, [loadData]);

  return {
    topics,
    sections,
    topicNames,
    topicsBySection,
    loading,
    error,
    refreshTopics: loadData,
  };
}
