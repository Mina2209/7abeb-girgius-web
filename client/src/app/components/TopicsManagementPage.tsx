import { useState, useEffect, useMemo, useCallback } from 'react';
import { loadGalleryImagesData, loadHymnsData, loadSayingsData } from '../services/contentLoaders';
import { useAuth } from '../contexts/AuthContext';
import {
  createTag,
  createSection,
  deleteTag,
  deleteSection,
  fetchAllSections,
  fetchAllTags,
  reorderSections,
  reorderTags,
  updateTag,
  updateSection,
  notifyTagsUpdated,
  type Section,
  type Topic,
} from '../services/tagsService';
import type { GalleryImage, Hymn, Saying } from '../types/content';
import { normalizeArabic } from '../utils/arabicUtils';
import { Plus, Edit2, Trash2, Search, Tag, AlertTriangle, Save, X, ChevronDown, ChevronUp, FolderOpen, Folder } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

const DEFAULT_SECTION_NAME = 'مواضيع متنوعة';
const UNASSIGNED_SECTION_ID = '__unassigned__';
const UNASSIGNED_SECTION_NAME = 'غير مصنف';

interface DeleteConfirmation {
  topicId?: string;
  sectionId?: string;
  name: string;
  usage: UsageBreakdown;
  type: 'topic' | 'section';
}

interface UsageBreakdown {
  hymns: number;
  images: number;
  sayings: number;
  total: number;
}

interface TopicWithUsage extends Topic {
  usage: UsageBreakdown;
}

export function TopicsManagementPage() {
  const { accessToken } = useAuth();
  const [sections, setSections] = useState<Section[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [contentCache, setContentCache] = useState<{
    hymns: Hymn[];
    sayings: Saying[];
    images: GalleryImage[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newTopicName, setNewTopicName] = useState('');
  const [newTopicSection, setNewTopicSection] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTopicName, setEditingTopicName] = useState('');
  const [editingTopicSection, setEditingTopicSection] = useState('');
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionName, setEditingSectionName] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState<DeleteConfirmation | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const reloadFromApi = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [serverSections, tags, hymns, sayings, images] = await Promise.all([
        fetchAllSections(),
        fetchAllTags(),
        loadHymnsData(),
        loadSayingsData(),
        loadGalleryImagesData(),
      ]);
      const sectionList: Section[] = serverSections.map((s) => ({
        id: s.id,
        name: s.name,
        order: s.order,
      }));
      const topicList: Topic[] = tags.map((t, idx) => ({
        id: t.id,
        name: t.name,
        sectionId: t.sectionId || null,
        order: t.order ?? idx,
      }));
      setSections(sectionList);
      setTopics(topicList);
      setContentCache({ hymns, sayings, images });
      const expanded = new Set(sectionList.map((s) => s.id));
      if (topicList.some(t => !t.sectionId)) {
        expanded.add(UNASSIGNED_SECTION_ID);
      }
      setExpandedSections(expanded);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load topics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadFromApi();
  }, [reloadFromApi]);

  useEffect(() => {
    if (!deleteConfirmation) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancelDelete();
      } else if (e.key === 'Enter') {
        handleConfirmDelete();
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [deleteConfirmation]);

  const calculateUsageBreakdown = (topicName: string, hymns: Hymn[], sayings: Saying[], images: GalleryImage[]): UsageBreakdown => {
    let hymnsCount = 0;
    let sayingsCount = 0;
    let imagesCount = 0;
    
    hymns.forEach((h) => { if (h.tags?.includes(topicName)) hymnsCount++; });
    sayings.forEach((s) => { if (s.tags?.includes(topicName)) sayingsCount++; });
    images.forEach((i) => { if (i.tags?.includes(topicName)) imagesCount++; });
    
    return {
      hymns: hymnsCount,
      sayings: sayingsCount,
      images: imagesCount,
      total: hymnsCount + sayingsCount + imagesCount
    };
  };

  const getTopicUsageBreakdown = useCallback((topicName: string): UsageBreakdown => {
    if (!contentCache) {
      return { hymns: 0, images: 0, sayings: 0, total: 0 };
    }
    return calculateUsageBreakdown(
      topicName,
      contentCache.hymns,
      contentCache.sayings,
      contentCache.images,
    );
  }, [contentCache]);

  const getSectionTopicsCount = (sectionId: string): number => {
    if (sectionId === UNASSIGNED_SECTION_ID) {
      return topics.filter(t => !t.sectionId).length;
    }
    return topics.filter(t => t.sectionId === sectionId).length;
  };

  const getDefaultSectionId = (): string | null => {
    const defaultSection = sections.find(s => s.name === DEFAULT_SECTION_NAME);
    return defaultSection?.id || null;
  };

  // ─── Section Management (backend) ──────────────────────────────

  const handleAddSection = async () => {
    if (!newSectionName.trim()) return;

    if (sections.some(s => s.name.toLowerCase() === newSectionName.toLowerCase())) {
      alert('هذا القسم موجود بالفعل');
      return;
    }

    setSaving(true);
    try {
      await createSection(newSectionName.trim(), accessToken);
      await reloadFromApi();
      notifyTagsUpdated();
      setNewSectionName('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'فشل إضافة القسم');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveSectionUp = async (sectionId: string) => {
    const sorted = [...sections].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex(s => s.id === sectionId);
    if (index <= 0) return;

    const reordered = sorted.map(s => s.id);
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];

    setSaving(true);
    try {
      await reorderSections(reordered, accessToken);
      await reloadFromApi();
      notifyTagsUpdated();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'فشل ترتيب الأقسام');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveSectionDown = async (sectionId: string) => {
    const sorted = [...sections].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex(s => s.id === sectionId);
    if (index < 0 || index >= sorted.length - 1) return;

    const reordered = sorted.map(s => s.id);
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];

    setSaving(true);
    try {
      await reorderSections(reordered, accessToken);
      await reloadFromApi();
      notifyTagsUpdated();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'فشل ترتيب الأقسام');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEditSection = (section: Section) => {
    setEditingSectionId(section.id);
    setEditingSectionName(section.name);
  };

  const handleSaveEditSection = async () => {
    if (!editingSectionName.trim() || !editingSectionId) return;

    const newName = editingSectionName.trim();
    if (sections.some(s => s.id !== editingSectionId && s.name.toLowerCase() === newName.toLowerCase())) {
      alert('هذا القسم موجود بالفعل');
      return;
    }

    const oldSection = sections.find((s) => s.id === editingSectionId);
    if (!oldSection || oldSection.name === newName) {
      setEditingSectionId(null);
      setEditingSectionName('');
      return;
    }

    setSaving(true);
    try {
      await updateSection(editingSectionId, newName, accessToken);
      await reloadFromApi();
      notifyTagsUpdated();
      setEditingSectionId(null);
      setEditingSectionName('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'فشل تحديث القسم');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEditSection = () => {
    setEditingSectionId(null);
    setEditingSectionName('');
  };

  const handleDeleteSection = (sectionId: string) => {
    const section = sections.find(s => s.id === sectionId);
    if (!section) return;

    const topicsCount = getSectionTopicsCount(sectionId);
    
    setDeleteConfirmation({
      sectionId,
      name: section.name,
      usage: { hymns: 0, images: 0, sayings: 0, total: topicsCount },
      type: 'section'
    });
  };

  // ─── Topic Management (backend) ────────────────────────────────

  const handleAddTopic = async () => {
    if (!newTopicName.trim()) return;

    if (topics.some(t => t.name.toLowerCase() === newTopicName.toLowerCase())) {
      alert('هذا الموضوع موجود بالفعل');
      return;
    }

    const targetSectionId = newTopicSection || getDefaultSectionId();

    setSaving(true);
    try {
      await createTag(
        { name: newTopicName.trim(), sectionId: targetSectionId },
        accessToken,
      );
      await reloadFromApi();
      notifyTagsUpdated();
      setNewTopicName('');
      setNewTopicSection('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'فشل إضافة الموضوع');
    } finally {
      setSaving(false);
    }
  };

  const handleStartEditTopic = (topic: Topic) => {
    setEditingTopicId(topic.id);
    setEditingTopicName(topic.name);
    setEditingTopicSection(topic.sectionId || '');
  };

  const handleSaveEditTopic = async () => {
    if (!editingTopicName.trim() || !editingTopicId) return;

    if (topics.some(t => t.id !== editingTopicId && t.name.toLowerCase() === editingTopicName.toLowerCase())) {
      alert('هذا الموضوع موجود بالفعل');
      return;
    }

    setSaving(true);
    try {
      await updateTag(
        editingTopicId,
        { name: editingTopicName.trim(), sectionId: editingTopicSection || getDefaultSectionId() },
        accessToken,
      );
      await reloadFromApi();
      notifyTagsUpdated();
      setEditingTopicId(null);
      setEditingTopicName('');
      setEditingTopicSection('');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'فشل تحديث الموضوع');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEditTopic = () => {
    setEditingTopicId(null);
    setEditingTopicName('');
    setEditingTopicSection('');
  };

  const handleDeleteTopic = (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;

    const usage = getTopicUsageBreakdown(topic.name);

    setDeleteConfirmation({
      topicId,
      name: topic.name,
      usage,
      type: 'topic'
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmation) return;

    if (deleteConfirmation.type === 'section' && deleteConfirmation.sectionId) {
      setSaving(true);
      try {
        await deleteSection(deleteConfirmation.sectionId, accessToken);
        await reloadFromApi();
        notifyTagsUpdated();
        setDeleteConfirmation(null);
      } catch (e) {
        alert(e instanceof Error ? e.message : 'فشل حذف القسم');
      } finally {
        setSaving(false);
      }
      return;
    }

    if (deleteConfirmation.type === 'topic' && deleteConfirmation.topicId) {
      setSaving(true);
      try {
        await deleteTag(deleteConfirmation.topicId, accessToken);
        await reloadFromApi();
        notifyTagsUpdated();
        setDeleteConfirmation(null);
      } catch (e) {
        alert(e instanceof Error ? e.message : 'فشل حذف الموضوع');
      } finally {
        setSaving(false);
      }
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirmation(null);
  };

  const toggleSectionExpanded = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const normalizeSearchText = (text: string) => normalizeArabic(text).toLowerCase();
  const normalizedSearchQuery = normalizeSearchText(searchQuery);

  const filteredTopics = useMemo(() => {
    return topics.filter((topic) =>
      normalizeSearchText(topic.name).includes(normalizedSearchQuery),
    );
  }, [topics, normalizedSearchQuery]);

  const topicsWithUsage: TopicWithUsage[] = useMemo(() => {
    return filteredTopics.map(topic => ({
      ...topic,
      usage: getTopicUsageBreakdown(topic.name),
    }));
  }, [filteredTopics, getTopicUsageBreakdown]);

  const getTopicsForSection = (sectionId: string): TopicWithUsage[] => {
    if (sectionId === UNASSIGNED_SECTION_ID) {
      return topicsWithUsage
        .filter(t => !t.sectionId)
        .sort((a, b) => a.order - b.order);
    }
    return topicsWithUsage
      .filter(t => t.sectionId === sectionId)
      .sort((a, b) => a.order - b.order);
  };

  // ─── Topic Ordering (backend) ──────────────────────────────────

  const handleMoveTopicUp = async (topicId: string, _sectionId: string) => {
    const sorted = [...topics].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex(t => t.id === topicId);
    if (index <= 0) return;

    const reordered = sorted.map(t => t.id);
    [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];

    setSaving(true);
    try {
      await reorderTags(reordered, accessToken);
      await reloadFromApi();
      notifyTagsUpdated();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'فشل ترتيب المواضيع');
    } finally {
      setSaving(false);
    }
  };

  const handleMoveTopicDown = async (topicId: string, _sectionId: string) => {
    const sorted = [...topics].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex(t => t.id === topicId);
    if (index < 0 || index >= sorted.length - 1) return;

    const reordered = sorted.map(t => t.id);
    [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];

    setSaving(true);
    try {
      await reorderTags(reordered, accessToken);
      await reloadFromApi();
      notifyTagsUpdated();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'فشل ترتيب المواضيع');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-8 text-center text-muted-foreground" dir="rtl">
        جاري تحميل المواضيع...
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-6xl mx-auto p-8 text-center" dir="rtl">
        <p className="text-destructive mb-4">{loadError}</p>
        <Button onClick={() => reloadFromApi()}>إعادة المحاولة</Button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto" dir="rtl">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">إدارة المواضيع والأقسام</h1>
        <p className="text-muted-foreground">
          إدارة الأقسام والمواضيع المستخدمة في جميع المكتبات (الترانيم، الأقوال، المعرض)
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Folder className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{sections.length}</p>
              <p className="text-sm text-muted-foreground">إجمالي الأقسام</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
              <Tag className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{topics.length}</p>
              <p className="text-sm text-muted-foreground">إجمالي المواضيع</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sections Management */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <Folder className="w-5 h-5" />
          إدارة الأقسام
        </h2>

        {/* Add New Section */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <Input
            type="text"
            placeholder="اسم القسم الجديد"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddSection()}
            className="flex-1"
          />
          <Button onClick={handleAddSection} disabled={!newSectionName.trim() || saving}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة قسم
          </Button>
        </div>

        {/* Sections List */}
        <div className="space-y-2">
          {[...sections].sort((a, b) => a.order - b.order).map((section, index) => (
            <div
              key={section.id}
              className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors flex-wrap"
            >
              {editingSectionId === section.id ? (
                <>
                  <Input
                    type="text"
                    value={editingSectionName}
                    onChange={(e) => setEditingSectionName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSaveEditSection()}
                    className="flex-1"
                    autoFocus
                  />
                  <Button size="sm" variant="ghost" onClick={handleSaveEditSection} disabled={saving}>
                    <Save className="w-4 h-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancelEditSection}>
                    <X className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <>
                  <Folder className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 font-medium">{section.name}</span>
                  <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {getSectionTopicsCount(section.id)} موضوع
                  </span>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMoveSectionUp(section.id)}
                      disabled={index === 0 || saving}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMoveSectionDown(section.id)}
                      disabled={index === sections.length - 1 || saving}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStartEditSection(section)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => handleDeleteSection(section.id)}
                      disabled={getSectionTopicsCount(section.id) > 0 || saving}
                      title={getSectionTopicsCount(section.id) > 0 ? 'لا يمكن حذف قسم يحتوي على مواضيع' : ''}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Add New Topic */}
      <div className="bg-card border border-border rounded-lg p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">إضافة موضوع جديد</h2>
        <div className="flex gap-3 flex-wrap">
          <Input
            type="text"
            placeholder="اسم الموضوع الجديد"
            value={newTopicName}
            onChange={(e) => setNewTopicName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddTopic()}
            className="flex-1"
          />
          <select
            value={newTopicSection}
            onChange={(e) => setNewTopicSection(e.target.value)}
            className="px-4 py-2 border border-border rounded-md bg-background"
          >
            <option value="">مواضيع متنوعة (افتراضي)</option>
            {sections.map(section => (
              <option key={section.id} value={section.id}>{section.name}</option>
            ))}
          </select>
          <Button onClick={handleAddTopic} disabled={!newTopicName.trim() || saving}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="بحث عن موضوع..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
      </div>

      {/* Topics by Section (Accordion) */}
      <div className="space-y-4">
        {(() => {
          const unassignedTopics = topicsWithUsage.filter(t => !t.sectionId);
          const hasUnassigned = unassignedTopics.length > 0;
          const sortedSections = [...sections].sort((a, b) => a.order - b.order);
          const displaySections = hasUnassigned
            ? [...sortedSections, { id: UNASSIGNED_SECTION_ID, name: UNASSIGNED_SECTION_NAME, order: Infinity }]
            : sortedSections;
          return displaySections.map(section => {
            const sectionTopics = getTopicsForSection(section.id);
            const isExpanded = expandedSections.has(section.id);

          return (
            <div key={section.id} className="bg-card border border-border rounded-lg overflow-hidden">
              {/* Section Header */}
              <button
                onClick={() => toggleSectionExpanded(section.id)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <FolderOpen className="w-5 h-5 text-primary" />
                  ) : (
                    <Folder className="w-5 h-5 text-muted-foreground" />
                  )}
                  <h3 className="text-lg font-semibold">{section.name}</h3>
                  <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {sectionTopics.length} موضوع
                  </span>
                </div>
                <ChevronDown
                  className={`w-5 h-5 text-muted-foreground transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Topics Table */}
              {isExpanded && (
                <div className="border-t border-border">
                  {sectionTopics.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      لا توجد مواضيع في هذا القسم
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-muted/50 border-b border-border">
                          <tr>
                            <th className="text-right px-4 py-3 font-semibold">الموضوع</th>
                            <th className="text-center px-3 py-3 font-semibold text-sm">القسم</th>
                            <th className="text-center px-3 py-3 font-semibold text-sm">الترانيم</th>
                            <th className="text-center px-3 py-3 font-semibold text-sm">الصور</th>
                            <th className="text-center px-3 py-3 font-semibold text-sm">الأقوال</th>
                            <th className="text-center px-4 py-3 font-semibold">الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sectionTopics.map((topic) => (
                            <tr key={topic.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3">
                                {editingTopicId === topic.id ? (
                                  <Input
                                    type="text"
                                    value={editingTopicName}
                                    onChange={(e) => setEditingTopicName(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSaveEditTopic()}
                                    className="w-full"
                                    autoFocus
                                  />
                                ) : (
                                  <span className="font-medium">{topic.name}</span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center">
                                {editingTopicId === topic.id ? (
                                  <select
                                    value={editingTopicSection}
                                    onChange={(e) => setEditingTopicSection(e.target.value)}
                                    className="px-3 py-1 border border-border rounded-md bg-background text-sm"
                                  >
                                    {sections.map(s => (
                                      <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                  </select>
                                ) : (
                                  <span className="text-sm text-muted-foreground">
                                    {sections.find(s => s.id === topic.sectionId)?.name || DEFAULT_SECTION_NAME}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full text-sm ${
                                  topic.usage.hymns > 0 ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-muted text-muted-foreground'
                                }`}>
                                  {topic.usage.hymns}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full text-sm ${
                                  topic.usage.images > 0 ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-muted text-muted-foreground'
                                }`}>
                                  {topic.usage.images}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className={`inline-flex items-center justify-center min-w-[2rem] px-2 py-1 rounded-full text-sm ${
                                  topic.usage.sayings > 0 ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' : 'bg-muted text-muted-foreground'
                                }`}>
                                  {topic.usage.sayings}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {editingTopicId === topic.id ? (
                                  <div className="flex gap-1 justify-center">
                                    <Button size="sm" variant="ghost" onClick={handleSaveEditTopic} disabled={saving}>
                                      <Save className="w-4 h-4" />
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={handleCancelEditTopic}>
                                      <X className="w-4 h-4" />
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex gap-1 justify-center">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleMoveTopicUp(topic.id, section.id)}
                                      disabled={sectionTopics.indexOf(topic) === 0 || saving}
                                      title="نقل لأعلى"
                                    >
                                      <ChevronUp className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleMoveTopicDown(topic.id, section.id)}
                                      disabled={sectionTopics.indexOf(topic) === sectionTopics.length - 1 || saving}
                                      title="نقل لأسفل"
                                    >
                                      <ChevronDown className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleStartEditTopic(topic)}
                                      title="تعديل"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => handleDeleteTopic(topic.id)}
                                      title="حذف"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        });
        })()}
      </div>

      {/* Delete Confirmation */}
      {deleteConfirmation && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-200"
            onClick={handleCancelDelete}
          />
          
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md px-4 animate-in zoom-in-95 duration-200">
            <div className="bg-card border border-border rounded-lg shadow-lg p-6" dir="rtl">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold mb-1">
                    {deleteConfirmation.type === 'section' ? 'تأكيد حذف القسم' : 'تأكيد حذف الموضوع'}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    هذا الإجراء لا يمكن التراجع عنه
                  </p>
                </div>
              </div>

              <div className="mb-6 pr-16">
                <p className="text-sm mb-3">
                  هل أنت متأكد من حذف {deleteConfirmation.type === 'section' ? 'القسم' : 'الموضوع'}{' '}
                  <span className="font-bold text-foreground">\"{deleteConfirmation.name}\"</span>؟
                </p>
                {deleteConfirmation.type === 'topic' && deleteConfirmation.usage.total > 0 ? (
                  <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3 mb-2">
                    <p className="text-sm text-destructive font-semibold mb-2">
                      يوجد {deleteConfirmation.usage.total} عنصر يستخدم هذا الموضوع
                    </p>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {deleteConfirmation.usage.hymns > 0 && (
                        <p>- {deleteConfirmation.usage.hymns} ترنيمة</p>
                      )}
                      {deleteConfirmation.usage.images > 0 && (
                        <p>- {deleteConfirmation.usage.images} صورة</p>
                      )}
                      {deleteConfirmation.usage.sayings > 0 && (
                        <p>- {deleteConfirmation.usage.sayings} قول</p>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      سيتم إزالة هذا الموضوع من جميع العناصر المرتبطة به.
                    </p>
                  </div>
                ) : deleteConfirmation.type === 'topic' ? (
                  <div className="bg-muted/50 border border-border rounded-lg p-3 mb-2">
                    <p className="text-sm text-muted-foreground">
                      هذا الموضوع غير مستخدم في أي عنصر حالياً.
                    </p>
                  </div>
                ) : deleteConfirmation.type === 'section' && deleteConfirmation.usage.total > 0 ? (
                  <div className="bg-muted/50 border border-border rounded-lg p-3 mb-2">
                    <p className="text-sm text-muted-foreground">
                      يحتوي القسم على {deleteConfirmation.usage.total} موضوع سيتم نقلها للقسم الافتراضي.
                    </p>
                  </div>
                ) : (
                  <div className="bg-muted/50 border border-border rounded-lg p-3 mb-2">
                    <p className="text-sm text-muted-foreground">
                      القسم فارغ ولا يحتوي على مواضيع.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="ghost" onClick={handleCancelDelete} disabled={saving}>
                  إلغاء
                </Button>
                <Button variant="destructive" onClick={handleConfirmDelete} className="gap-2" disabled={saving}>
                  <Trash2 className="w-4 h-4" />
                  {deleteConfirmation.type === 'section' ? 'حذف القسم' : 'حذف الموضوع'}
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Help Text */}
      <div className="mt-6 bg-primary/5 border border-primary/20 rounded-lg p-4">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">ملاحظات هامة:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>الأقسام تساعد في تنظيم المواضيع في المكتبات الثلاثة</li>
              <li>يمكن ترتيب الأقسام والمواضيع حسب الأولوية باستخدام الأسهم</li>
              <li>لا يمكن حذف قسم يحتوي على مواضيع</li>
              <li>عند حذف قسم، يتم نقل مواضيعه للقسم الافتراضي تلقائياً</li>
              <li>يمكن نقل المواضيع بين الأقسام وإعادة ترتيبها في أي وقت</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
