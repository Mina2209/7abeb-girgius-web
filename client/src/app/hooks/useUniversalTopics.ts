import { useState, useEffect } from 'react';
import { allTags } from '../data/tags';

export interface Topic {
  id: string;
  name: string;
  sectionId: string;
  order: number; // Order within the section
}

export interface Section {
  id: string;
  name: string;
  order: number;
}

export interface TopicsBySection {
  section: Section;
  topics: string[]; // Just topic names for the filter
}

const TOPICS_STORAGE_KEY = 'universal_topics';
const SECTIONS_STORAGE_KEY = 'topic_sections';
const TOPICS_VERSION_KEY = 'universal_topics_version';
const CURRENT_VERSION = '2.0'; // Updated for sections feature

/**
 * Custom hook to manage universal topics across all libraries
 * Now supports sections for better organization
 */
export function useUniversalTopics() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [topicNames, setTopicNames] = useState<string[]>([]);
  const [topicsBySection, setTopicsBySection] = useState<TopicsBySection[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const savedVersion = localStorage.getItem(TOPICS_VERSION_KEY);
    const savedTopics = localStorage.getItem(TOPICS_STORAGE_KEY);
    const savedSections = localStorage.getItem(SECTIONS_STORAGE_KEY);
    
    // If sections exist, use them (user already migrated)
    if (savedSections && savedTopics) {
      const parsedSections: Section[] = JSON.parse(savedSections);
      const parsedTopics: Topic[] = JSON.parse(savedTopics);
      
      setSections(parsedSections);
      setTopics(parsedTopics);
      setTopicNames(parsedTopics.map(t => t.name));
      setTopicsBySection(groupTopicsBySection(parsedSections, parsedTopics));
    } else {
      // Fall back to old structure or initialize
      if (savedTopics && savedVersion === '1.1') {
        // Has old topics but no sections - will be migrated when visiting Topics Management Page
        const parsedTopics: any[] = JSON.parse(savedTopics);
        setTopicNames(parsedTopics.map(t => t.name));
      } else {
        // Initialize from static file
        initializeTopicsFromStaticFile();
      }
    }
  };

  const groupTopicsBySection = (sections: Section[], topics: Topic[]): TopicsBySection[] => {
    // Sort sections by order
    const sortedSections = [...sections].sort((a, b) => a.order - b.order);
    
    return sortedSections.map(section => ({
      section,
      topics: topics
        .filter(t => t.sectionId === section.id)
        .sort((a, b) => a.order - b.order) // Sort by order within section
        .map(t => t.name)
    })).filter(group => group.topics.length > 0); // Only include sections with topics
  };

  const initializeTopicsFromStaticFile = () => {
    // Create Topic objects from static tags
    const initialTopics: Topic[] = allTags.map((tag, index) => ({
      id: `topic-${index + 1}`,
      name: tag,
      sectionId: 'section-6', // Default to "مواضيع متنوعة"
      order: index + 1, // Order within the section
    }));

    // Save to localStorage
    localStorage.setItem(TOPICS_STORAGE_KEY, JSON.stringify(initialTopics));
    localStorage.setItem(TOPICS_VERSION_KEY, CURRENT_VERSION);
    setTopics(initialTopics);
    setTopicNames(initialTopics.map(t => t.name));
  };

  const refreshTopics = () => {
    loadData();
  };

  return {
    topics,           // Full topic objects with id, name, sectionId
    sections,         // Section definitions
    topicNames,       // Just the names array (flat list)
    topicsBySection,  // Topics grouped by section for organized display
    refreshTopics,    // Function to reload topics (useful after admin edits)
  };
}