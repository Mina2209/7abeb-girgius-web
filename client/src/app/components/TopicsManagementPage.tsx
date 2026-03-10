import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Search, Tag, AlertTriangle, Save, X, ChevronDown, ChevronUp, FolderOpen, Folder } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';

interface Section {
  id: string;
  name: string;
  order: number;
}

interface Topic {
  id: string;
  name: string;
  sectionId: string;
  order: number; // Order within the section
}

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
  const [sections, setSections] = useState<Section[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
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

  // Load sections and topics from localStorage on mount
  useEffect(() => {
    initializeData();
  }, []);

  // Handle keyboard shortcuts for delete confirmation
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

  const initializeData = () => {
    const savedSections = localStorage.getItem('topic_sections');
    const savedTopics = localStorage.getItem('universal_topics');

    if (savedSections && savedTopics) {
      setSections(JSON.parse(savedSections));
      const loadedTopics = JSON.parse(savedTopics);
      // Ensure all topics have proper sequential order values
      const topicsWithOrder = ensureTopicOrders(loadedTopics, JSON.parse(savedSections));
      setTopics(topicsWithOrder);
      if (JSON.stringify(loadedTopics) !== JSON.stringify(topicsWithOrder)) {
        localStorage.setItem('universal_topics', JSON.stringify(topicsWithOrder));
      }
      // Expand all sections by default
      const allSectionIds = JSON.parse(savedSections).map((s: Section) => s.id);
      setExpandedSections(new Set(allSectionIds));
    } else {
      // Initialize with default sections and migrate existing topics
      initializeDefaultSections();
    }
  };

  // Ensure topics have proper sequential order values within each section
  const ensureTopicOrders = (topics: Topic[], sections: Section[]): Topic[] => {
    const updatedTopics = [...topics];
    
    sections.forEach(section => {
      const sectionTopics = updatedTopics
        .filter(t => t.sectionId === section.id)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      
      // Reassign sequential orders
      sectionTopics.forEach((topic, index) => {
        const topicIndex = updatedTopics.findIndex(t => t.id === topic.id);
        if (topicIndex !== -1) {
          updatedTopics[topicIndex] = { ...updatedTopics[topicIndex], order: index + 1 };
        }
      });
    });
    
    return updatedTopics;
  };

  const initializeDefaultSections = () => {
    const defaultSections: Section[] = [
      { id: 'section-1', name: 'الأعياد السيدية', order: 1 },
      { id: 'section-2', name: 'مناسبات كنسية', order: 2 },
      { id: 'section-3', name: 'أسرار كنسية', order: 3 },
      { id: 'section-4', name: 'فضائل روحية', order: 4 },
      { id: 'section-5', name: 'شخصيات كتابية', order: 5 },
      { id: 'section-6', name: 'مواضيع متنوعة', order: 6 },
    ];

    // Get existing topics from old structure
    const oldTopics = localStorage.getItem('universal_topics');
    let migratedTopics: Topic[] = [];

    if (oldTopics) {
      const parsedOldTopics = JSON.parse(oldTopics);
      migratedTopics = parsedOldTopics.map((topic: any) => ({
        id: topic.id,
        name: topic.name,
        sectionId: categorizeTopicToSection(topic.name),
        order: 1, // Default order
      }));
    } else {
      // If no topics exist, collect from libraries
      const hymns = JSON.parse(localStorage.getItem('hymns_data') || '[]');
      const sayings = JSON.parse(localStorage.getItem('sayings_data') || '[]');
      const images = JSON.parse(localStorage.getItem('gallery_images_data') || '[]');

      const allTags = new Set<string>();
      hymns.forEach((h: any) => h.tags?.forEach((tag: string) => allTags.add(tag)));
      sayings.forEach((s: any) => s.tags?.forEach((tag: string) => allTags.add(tag)));
      images.forEach((i: any) => i.tags?.forEach((tag: string) => allTags.add(tag)));

      migratedTopics = Array.from(allTags).map((tag, index) => ({
        id: `topic-${index + 1}`,
        name: tag,
        sectionId: categorizeTopicToSection(tag),
        order: 1, // Default order
      }));
    }

    setSections(defaultSections);
    setTopics(migratedTopics);
    localStorage.setItem('topic_sections', JSON.stringify(defaultSections));
    localStorage.setItem('universal_topics', JSON.stringify(migratedTopics));
    
    // Expand all sections by default
    const allSectionIds = defaultSections.map(s => s.id);
    setExpandedSections(new Set(allSectionIds));
  };

  const categorizeTopicToSection = (topicName: string): string => {
    const name = topicName.toLowerCase();

    // الأعياد السيدية
    if (name.includes('قيامة') || name.includes('ميلاد') || name.includes('غطاس') || 
        name.includes('صعود') || name.includes('عنصرة') || name.includes('تجلي') ||
        name.includes('عيد') || name.includes('فصح')) {
      return 'section-1';
    }

    // مناسبات كنسية
    if (name.includes('صوم') || name.includes('آلام') || name.includes('خماسين') ||
        name.includes('كيهك') || name.includes('برمون') || name.includes('نيروز')) {
      return 'section-2';
    }

    // أسرار كنسية
    if (name.includes('معمودية') || name.includes('إفخارستيا') || name.includes('توبة') ||
        name.includes('اعتراف') || name.includes('مسحة') || name.includes('زيجة') ||
        name.includes('كهنوت') || name.includes('قنديل')) {
      return 'section-3';
    }

    // فضائل روحية
    if (name.includes('محبة') || name.includes('إيمان') || name.includes('رجاء') ||
        name.includes('صلاة') || name.includes('صبر') || name.includes('تواضع') ||
        name.includes('طاعة') || name.includes('نقاوة') || name.includes('وداعة') ||
        name.includes('سلام') || name.includes('فرح') || name.includes('رحمة')) {
      return 'section-4';
    }

    // شخصيات كتابية
    if (name.includes('مريم') || name.includes('موسى') || name.includes('يوسف') ||
        name.includes('داود') || name.includes('بولس') || name.includes('بطرس') ||
        name.includes('يوحنا') || name.includes('مرقس') || name.includes('لوقا') ||
        name.includes('متى') || name.includes('إبراهيم') || name.includes('يعقوب')) {
      return 'section-5';
    }

    // Default: مواضيع متنوعة
    return 'section-6';
  };

  const calculateUsageBreakdown = (topicName: string, hymns: any[], sayings: any[], images: any[]): UsageBreakdown => {
    let hymnsCount = 0;
    let sayingsCount = 0;
    let imagesCount = 0;
    
    hymns.forEach((h: any) => { if (h.tags?.includes(topicName)) hymnsCount++; });
    sayings.forEach((s: any) => { if (s.tags?.includes(topicName)) sayingsCount++; });
    images.forEach((i: any) => { if (i.tags?.includes(topicName)) imagesCount++; });
    
    return {
      hymns: hymnsCount,
      sayings: sayingsCount,
      images: imagesCount,
      total: hymnsCount + sayingsCount + imagesCount
    };
  };

  const getTopicUsageBreakdown = (topicName: string): UsageBreakdown => {
    const hymns = JSON.parse(localStorage.getItem('hymns_data') || '[]');
    const sayings = JSON.parse(localStorage.getItem('sayings_data') || '[]');
    const images = JSON.parse(localStorage.getItem('gallery_images_data') || '[]');
    return calculateUsageBreakdown(topicName, hymns, sayings, images);
  };

  const getSectionTopicsCount = (sectionId: string): number => {
    return topics.filter(t => t.sectionId === sectionId).length;
  };

  // Section Management
  const handleAddSection = () => {
    if (!newSectionName.trim()) return;

    if (sections.some(s => s.name.toLowerCase() === newSectionName.toLowerCase())) {
      alert('هذا القسم موجود بالفعل');
      return;
    }

    const newSection: Section = {
      id: `section-${Date.now()}`,
      name: newSectionName.trim(),
      order: sections.length + 1,
    };

    const updatedSections = [...sections, newSection];
    setSections(updatedSections);
    localStorage.setItem('topic_sections', JSON.stringify(updatedSections));
    setNewSectionName('');
  };

  const handleMoveSectionUp = (sectionId: string) => {
    const index = sections.findIndex(s => s.id === sectionId);
    if (index <= 0) return;

    const updatedSections = [...sections];
    [updatedSections[index - 1], updatedSections[index]] = [updatedSections[index], updatedSections[index - 1]];
    
    // Update order values
    updatedSections.forEach((s, i) => s.order = i + 1);
    
    setSections(updatedSections);
    localStorage.setItem('topic_sections', JSON.stringify(updatedSections));
  };

  const handleMoveSectionDown = (sectionId: string) => {
    const index = sections.findIndex(s => s.id === sectionId);
    if (index < 0 || index >= sections.length - 1) return;

    const updatedSections = [...sections];
    [updatedSections[index], updatedSections[index + 1]] = [updatedSections[index + 1], updatedSections[index]];
    
    // Update order values
    updatedSections.forEach((s, i) => s.order = i + 1);
    
    setSections(updatedSections);
    localStorage.setItem('topic_sections', JSON.stringify(updatedSections));
  };

  const handleStartEditSection = (section: Section) => {
    setEditingSectionId(section.id);
    setEditingSectionName(section.name);
  };

  const handleSaveEditSection = () => {
    if (!editingSectionName.trim() || !editingSectionId) return;

    if (sections.some(s => s.id !== editingSectionId && s.name.toLowerCase() === editingSectionName.toLowerCase())) {
      alert('هذا القسم موجود بالفعل');
      return;
    }

    const updatedSections = sections.map(s =>
      s.id === editingSectionId ? { ...s, name: editingSectionName.trim() } : s
    );

    setSections(updatedSections);
    localStorage.setItem('topic_sections', JSON.stringify(updatedSections));
    setEditingSectionId(null);
    setEditingSectionName('');
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

  // Topic Management
  const handleAddTopic = () => {
    if (!newTopicName.trim()) return;

    if (topics.some(t => t.name.toLowerCase() === newTopicName.toLowerCase())) {
      alert('هذا الموضوع موجود بالفعل');
      return;
    }

    const targetSectionId = newTopicSection || sections.find(s => s.name === 'مواضيع متنوعة')?.id || sections[sections.length - 1].id;
    
    // Find the max order in the target section
    const sectionTopics = topics.filter(t => t.sectionId === targetSectionId);
    const maxOrder = sectionTopics.length > 0 ? Math.max(...sectionTopics.map(t => t.order)) : 0;

    const newTopic: Topic = {
      id: `topic-${Date.now()}`,
      name: newTopicName.trim(),
      sectionId: targetSectionId,
      order: maxOrder + 1, // Assign next order in sequence
    };

    const updatedTopics = [...topics, newTopic];
    setTopics(updatedTopics);
    localStorage.setItem('universal_topics', JSON.stringify(updatedTopics));
    setNewTopicName('');
    setNewTopicSection('');
  };

  const handleStartEditTopic = (topic: Topic) => {
    setEditingTopicId(topic.id);
    setEditingTopicName(topic.name);
    setEditingTopicSection(topic.sectionId);
  };

  const handleSaveEditTopic = () => {
    if (!editingTopicName.trim() || !editingTopicId) return;

    const oldTopic = topics.find(t => t.id === editingTopicId);
    if (!oldTopic) return;

    if (topics.some(t => t.id !== editingTopicId && t.name.toLowerCase() === editingTopicName.toLowerCase())) {
      alert('هذا الموضوع موجود بالفعل');
      return;
    }

    const updatedTopics = topics.map(t =>
      t.id === editingTopicId ? { ...t, name: editingTopicName.trim(), sectionId: editingTopicSection } : t
    );

    // Update the topic name in all libraries if it changed
    if (oldTopic.name !== editingTopicName.trim()) {
      updateTopicInAllLibraries(oldTopic.name, editingTopicName.trim());
    }

    setTopics(updatedTopics);
    localStorage.setItem('universal_topics', JSON.stringify(updatedTopics));
    setEditingTopicId(null);
    setEditingTopicName('');
    setEditingTopicSection('');
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

  const handleConfirmDelete = () => {
    if (!deleteConfirmation) return;

    if (deleteConfirmation.type === 'section' && deleteConfirmation.sectionId) {
      const updatedSections = sections.filter(s => s.id !== deleteConfirmation.sectionId);
      setSections(updatedSections);
      localStorage.setItem('topic_sections', JSON.stringify(updatedSections));
    } else if (deleteConfirmation.type === 'topic' && deleteConfirmation.topicId) {
      removeTopicFromAllLibraries(deleteConfirmation.name);
      const updatedTopics = topics.filter(t => t.id !== deleteConfirmation.topicId);
      setTopics(updatedTopics);
      localStorage.setItem('universal_topics', JSON.stringify(updatedTopics));
    }

    setDeleteConfirmation(null);
  };

  const handleCancelDelete = () => {
    setDeleteConfirmation(null);
  };

  const updateTopicInAllLibraries = (oldName: string, newName: string) => {
    const hymns = JSON.parse(localStorage.getItem('hymns_data') || '[]');
    const updatedHymns = hymns.map((h: any) => ({
      ...h,
      tags: h.tags?.map((tag: string) => tag === oldName ? newName : tag) || [],
    }));
    localStorage.setItem('hymns_data', JSON.stringify(updatedHymns));

    const sayings = JSON.parse(localStorage.getItem('sayings_data') || '[]');
    const updatedSayings = sayings.map((s: any) => ({
      ...s,
      tags: s.tags?.map((tag: string) => tag === oldName ? newName : tag) || [],
    }));
    localStorage.setItem('sayings_data', JSON.stringify(updatedSayings));

    const images = JSON.parse(localStorage.getItem('gallery_images_data') || '[]');
    const updatedImages = images.map((i: any) => ({
      ...i,
      tags: i.tags?.map((tag: string) => tag === oldName ? newName : tag) || [],
    }));
    localStorage.setItem('gallery_images_data', JSON.stringify(updatedImages));
  };

  const removeTopicFromAllLibraries = (topicName: string) => {
    const hymns = JSON.parse(localStorage.getItem('hymns_data') || '[]');
    const updatedHymns = hymns.map((h: any) => ({
      ...h,
      tags: h.tags?.filter((tag: string) => tag !== topicName) || [],
    }));
    localStorage.setItem('hymns_data', JSON.stringify(updatedHymns));

    const sayings = JSON.parse(localStorage.getItem('sayings_data') || '[]');
    const updatedSayings = sayings.map((s: any) => ({
      ...s,
      tags: s.tags?.filter((tag: string) => tag !== topicName) || [],
    }));
    localStorage.setItem('sayings_data', JSON.stringify(updatedSayings));

    const images = JSON.parse(localStorage.getItem('gallery_images_data') || '[]');
    const updatedImages = images.map((i: any) => ({
      ...i,
      tags: i.tags?.filter((tag: string) => tag !== topicName) || [],
    }));
    localStorage.setItem('gallery_images_data', JSON.stringify(updatedImages));
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

  const filteredTopics = useMemo(() => {
    return topics.filter(topic =>
      topic.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [topics, searchQuery]);

  const topicsWithUsage: TopicWithUsage[] = useMemo(() => {
    return filteredTopics.map(topic => ({
      ...topic,
      usage: getTopicUsageBreakdown(topic.name),
    }));
  }, [filteredTopics]);

  const getTopicsForSection = (sectionId: string): TopicWithUsage[] => {
    return topicsWithUsage
      .filter(t => t.sectionId === sectionId)
      .sort((a, b) => a.order - b.order); // Sort by order
  };

  // Topic Ordering
  const handleMoveTopicUp = (topicId: string, sectionId: string) => {
    const sectionTopics = topics.filter(t => t.sectionId === sectionId).sort((a, b) => a.order - b.order);
    const index = sectionTopics.findIndex(t => t.id === topicId);
    if (index <= 0) return;

    // Swap orders
    const updatedTopics = topics.map(t => {
      if (t.id === sectionTopics[index].id) {
        return { ...t, order: sectionTopics[index - 1].order };
      } else if (t.id === sectionTopics[index - 1].id) {
        return { ...t, order: sectionTopics[index].order };
      }
      return t;
    });

    setTopics(updatedTopics);
    localStorage.setItem('universal_topics', JSON.stringify(updatedTopics));
  };

  const handleMoveTopicDown = (topicId: string, sectionId: string) => {
    const sectionTopics = topics.filter(t => t.sectionId === sectionId).sort((a, b) => a.order - b.order);
    const index = sectionTopics.findIndex(t => t.id === topicId);
    if (index < 0 || index >= sectionTopics.length - 1) return;

    // Swap orders
    const updatedTopics = topics.map(t => {
      if (t.id === sectionTopics[index].id) {
        return { ...t, order: sectionTopics[index + 1].order };
      } else if (t.id === sectionTopics[index + 1].id) {
        return { ...t, order: sectionTopics[index].order };
      }
      return t;
    });

    setTopics(updatedTopics);
    localStorage.setItem('universal_topics', JSON.stringify(updatedTopics));
  };

  return (
    <div className="max-w-6xl mx-auto" dir="rtl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">إدارة المواضيع والأقسام</h1>
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
        <div className="flex gap-3 mb-6">
          <Input
            type="text"
            placeholder="اسم القسم الجديد"
            value={newSectionName}
            onChange={(e) => setNewSectionName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleAddSection()}
            className="flex-1"
          />
          <Button onClick={handleAddSection} disabled={!newSectionName.trim()}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة قسم
          </Button>
        </div>

        {/* Sections List */}
        <div className="space-y-2">
          {sections.map((section, index) => (
            <div
              key={section.id}
              className="flex items-center gap-3 p-3 border border-border rounded-lg hover:bg-muted/30 transition-colors"
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
                  <Button size="sm" variant="ghost" onClick={handleSaveEditSection}>
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
                      disabled={index === 0}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMoveSectionDown(section.id)}
                      disabled={index === sections.length - 1}
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
                      disabled={getSectionTopicsCount(section.id) > 0}
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
        <div className="flex gap-3">
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
          <Button onClick={handleAddTopic} disabled={!newTopicName.trim()}>
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
        {sections.map(section => {
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
                                    {sections.find(s => s.id === topic.sectionId)?.name}
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
                                    <Button size="sm" variant="ghost" onClick={handleSaveEditTopic}>
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
                                      disabled={sectionTopics.indexOf(topic) === 0}
                                      title="نقل لأعلى"
                                    >
                                      <ChevronUp className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleMoveTopicDown(topic.id, section.id)}
                                      disabled={sectionTopics.indexOf(topic) === sectionTopics.length - 1}
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
        })}
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
                      ⚠️ يوجد {deleteConfirmation.usage.total} عنصر يستخدم هذا الموضوع
                    </p>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {deleteConfirmation.usage.hymns > 0 && (
                        <p>• {deleteConfirmation.usage.hymns} ترنيمة</p>
                      )}
                      {deleteConfirmation.usage.images > 0 && (
                        <p>• {deleteConfirmation.usage.images} صورة</p>
                      )}
                      {deleteConfirmation.usage.sayings > 0 && (
                        <p>• {deleteConfirmation.usage.sayings} قول</p>
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
                ) : (
                  <div className="bg-muted/50 border border-border rounded-lg p-3 mb-2">
                    <p className="text-sm text-muted-foreground">
                      القسم فارغ ولا يحتوي على مواضيع.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end">
                <Button variant="ghost" onClick={handleCancelDelete}>
                  إلغاء
                </Button>
                <Button variant="destructive" onClick={handleConfirmDelete} className="gap-2">
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
              <li>تعديل اسم الموضوع سيتم تحديثه تلقائياً في جميع المكتبات</li>
              <li>يمكن نقل المواضيع بين الأقسام وإعادة ترتيبها في أي وقت</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}