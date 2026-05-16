import { useState, useEffect, useCallback } from 'react';
import {
  clearLegacyTopicStorage,
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
 * Loads universal topics (tags) from the API, grouped by category (section).
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
      const tags = await fetchAllTags();
      const { sections: nextSections, topics: nextTopics } = mapTagsToSectionsAndTopics(tags);
      setSections(nextSections);
      setTopics(nextTopics);
      setTopicNames(nextTopics.map((t) => t.name));
      setTopicsBySection(groupTopicsBySection(nextSections, nextTopics));
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
