import { Heart, Share2, ArrowUpDown, Search, ChevronDown, Tags, User, BookOpen, Calendar, Plus, Edit2, Trash2, Download, Upload, CheckSquare, Square, CheckCheck, Video, MessageSquareQuote } from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { TagFilter } from './TagFilter';
import { MultiSelectFilter } from './MultiSelectFilter';
import Masonry, { ResponsiveMasonry } from 'react-responsive-masonry';
import { FatherProfileModal } from './FatherProfileModal';
import { getFatherByName } from '../data/fathers';
import { useIsEditor } from '../utils/adminUtils';
import { AdminEditSayingModal } from './AdminEditSayingModal';
import { VideoModal } from './VideoModal';
import { useSayingsData } from '../hooks/useSayingsData';
import type { ContentId, Saying } from '../types/content';
import { useAuth } from '../contexts/AuthContext';
import { createSaying, deleteSaying, updateSaying } from '../services/contentWriteService';



type SortOption = 'author-asc' | 'author-desc' | 'date-asc' | 'date-desc';

const sortOptions = [
  { value: 'author-asc' as SortOption, label: 'حسب القائل (أ - ي)' },
  { value: 'author-desc' as SortOption, label: 'حسب القائل (ي - أ)' },
  { value: 'date-asc' as SortOption, label: 'الأقدم' },
  { value: 'date-desc' as SortOption, label: 'الأحدث' },
];

export function SayingsSection() {
  const isEditor = useIsEditor();
  const { accessToken } = useAuth();
  const { sayings, setSayings, loading: sayingsLoading } = useSayingsData();

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [expandedQuoteId, setExpandedQuoteId] = useState<ContentId | null>(null);
  const [favoritedQuotes, setFavoritedQuotes] = useState<ContentId[]>([]);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [selectedFather, setSelectedFather] = useState<string | null>(null);
  const [isFatherModalOpen, setIsFatherModalOpen] = useState(false);

  // Admin state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingSaying, setEditingSaying] = useState<Saying | null>(null);
  const [selectedSayingIds, setSelectedSayingIds] = useState<ContentId[]>([]);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  
  // Video tutorial modal state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const filtersContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get unique authors, sources, and tags
  const allAuthors = useMemo(() => Array.from(new Set(sayings.map(s => s.author))), [sayings]);
  const allSources = useMemo(() => Array.from(new Set(sayings.map(s => s.source))), [sayings]);
  const allTags = useMemo(() => Array.from(new Set(sayings.flatMap(s => s.tags))), [sayings]);

  // Detect scroll to hide title/description
  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const scrollTop = scrollContainerRef.current.scrollTop;
        const scrollRange = 50;
        const progress = Math.min(scrollTop / scrollRange, 1);
        setScrollProgress(progress);
        setIsScrolled(scrollTop > 20);
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, []);

  // Close sort dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortDropdownRef.current && !sortDropdownRef.current.contains(event.target as Node)) {
        setIsSortDropdownOpen(false);
      }
    };

    if (isSortDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSortDropdownOpen]);

  // Admin Functions
  const handleAddNew = () => {
    setEditingSaying(null);
    setIsEditModalOpen(true);
  };

  const handleEdit = (saying: Saying) => {
    setEditingSaying(saying);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (id: ContentId) => {
    if (confirm('هل أنت متأكد من حذف هذا القول؟')) {
      if (typeof id !== 'string') {
        setShareMessage('لا يمكن حذف عنصر غير متزامن مع الخادم');
        setTimeout(() => setShareMessage(null), 2000);
        return;
      }
      try {
        await deleteSaying(id, accessToken);
        setSayings((prev) => prev.filter((s) => String(s.id) !== String(id)));
        setShareMessage('تم الحذف بنجاح');
      } catch {
        setShareMessage('فشل الحذف من الخادم');
      } finally {
        setTimeout(() => setShareMessage(null), 2000);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSayingIds.length === 0) return;
    if (confirm(`هل أنت متأكد من حذف ${selectedSayingIds.length} قول؟`)) {
      const ids = selectedSayingIds.filter((id): id is string => typeof id === 'string');
      await Promise.allSettled(ids.map((id) => deleteSaying(id, accessToken)));
      setSayings((prev) =>
        prev.filter((s) => !ids.includes(String(s.id)))
      );
      setSelectedSayingIds([]);
      setBulkEditMode(false);
      setShareMessage('تم الحذف بنجاح');
      setTimeout(() => setShareMessage(null), 2000);
    }
  };

  const handleSelectAll = () => {
    const allVisibleIds = filteredSayings.map(saying => saying.id);
    if (selectedSayingIds.length === allVisibleIds.length) {
      // Deselect all
      setSelectedSayingIds([]);
    } else {
      // Select all
      setSelectedSayingIds(allVisibleIds);
    }
  };

  const handleSaveSaying = async (saying: Saying) => {
    try {
      if (editingSaying && typeof editingSaying.id === 'string') {
        const updated = await updateSaying(editingSaying.id, saying, accessToken);
        setSayings(prev => prev.map(s => s.id === updated.id ? updated : s));
        setShareMessage('تم التحديث بنجاح');
      } else {
        const created = await createSaying(saying, accessToken);
        setSayings(prev => [...prev, created]);
        setShareMessage('تمت الإضافة بنجاح');
      }
    } catch {
      setShareMessage('فشل الحفظ على الخادم');
    } finally {
      setTimeout(() => setShareMessage(null), 2000);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(sayings, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sayings-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setShareMessage('تم التصدير بنجاح');
    setTimeout(() => setShareMessage(null), 2000);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string);
        if (Array.isArray(imported)) {
          if (confirm('هل تريد استبدال البيانات الحالية أم دمجها؟\n\nاضغط OK للاستبدال، أو Cancel للدمج')) {
            // Replace
            setSayings(imported);
            setShareMessage('تم الاستيراد بنجاح (استبدال)');
          } else {
            // Merge
            const existingIds = new Set(sayings.map(s => s.id));
            const newSayings = imported.filter((s: Saying) => !existingIds.has(s.id));
            setSayings(prev => [...prev, ...newSayings]);
            setShareMessage(`تم الاستيراد بنجاح (${newSayings.length} عنصر جديد)`);
          }
          setTimeout(() => setShareMessage(null), 2000);
        } else {
          alert('ملف غير صالح. يجب أن يحتوي على مصفوفة JSON.');
        }
      } catch (error) {
        alert('خطأ في قراءة الملف');
      }
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };

  const toggleSelectSaying = (id: ContentId) => {
    setSelectedSayingIds((prev) =>
      prev.some((sid) => String(sid) === String(id))
        ? prev.filter((sid) => String(sid) !== String(id))
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedSayingIds.length === sortedSayings.length) {
      setSelectedSayingIds([]);
    } else {
      setSelectedSayingIds(sortedSayings.map(s => s.id));
    }
  };

  const toggleFavorite = (quoteId: ContentId) => {
    setFavoritedQuotes((prev) => {
      const isIn = prev.some((id) => String(id) === String(quoteId));
      return isIn ? prev.filter((id) => String(id) !== String(quoteId)) : [...prev, quoteId];
    });
  };

  const handleShare = (quote: Saying) => {
    const shareText = `"${quote.quote}"\n\n- ${quote.author}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'قول من أقوال الآباء',
        text: shareText,
      }).catch(() => {
        // Fallback to clipboard
        copyToClipboard(shareText);
      });
    } else {
      copyToClipboard(shareText);
    }
  };

  const copyToClipboard = (text: string) => {
    // Fallback method for copying text when Clipboard API is blocked
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    textarea.style.top = '-999999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    
    try {
      document.execCommand('copy');
      setShareMessage('تم النسخ إلى الحافظة');
      setTimeout(() => setShareMessage(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setShareMessage('فشل النسخ');
      setTimeout(() => setShareMessage(null), 2000);
    }
    
    textarea.remove();
  };

  const handleQuoteClick = (quoteId: ContentId) => {
    if (bulkEditMode) {
      toggleSelectSaying(quoteId);
    } else {
      if (expandedQuoteId !== null && String(expandedQuoteId) === String(quoteId)) {
        setExpandedQuoteId(null);
      } else {
        setExpandedQuoteId(quoteId);
      }
    }
  };

  const handleAuthorClick = (authorName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const father = getFatherByName(authorName);
    if (father) {
      setSelectedFather(authorName);
      setIsFatherModalOpen(true);
    }
  };

  const handleCloseFatherModal = () => {
    setIsFatherModalOpen(false);
    setSelectedFather(null);
  };

  // Filter sayings
  const filteredSayings = useMemo(() => {
    return sayings.filter(item => {
      const matchesSearch = searchQuery === '' || 
        item.quote.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.source.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(tag => item.tags.includes(tag));

      const matchesAuthors = selectedAuthors.length === 0 || 
        selectedAuthors.includes(item.author);

      const matchesSources = selectedSources.length === 0 || 
        selectedSources.includes(item.source);

      // Filter by favorites
      const matchesFavorites =
        !showFavoritesOnly || favoritedQuotes.some((f) => String(f) === String(item.id));

      return matchesSearch && matchesTags && matchesAuthors && matchesSources && matchesFavorites;
    });
  }, [selectedTags, selectedAuthors, selectedSources, searchQuery, showFavoritesOnly, favoritedQuotes, sayings]);

  // Sort filtered sayings
  const sortedSayings = useMemo(() => {
    return [...filteredSayings].sort((a, b) => {
      if (sortBy === 'author-asc') {
        return a.author.localeCompare(b.author);
      } else if (sortBy === 'author-desc') {
        return b.author.localeCompare(a.author);
      } else if (sortBy === 'date-asc') {
        return new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime();
      } else if (sortBy === 'date-desc') {
        return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
      }
      return 0;
    });
  }, [filteredSayings, sortBy]);

  if (sayingsLoading && sayings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-2 text-muted-foreground">
        <p>جاري تحميل الأقوال...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header Section */}
      <div 
        className="sticky top-0 bg-background z-40 pb-3 sm:pb-4 border-b border-border/50"
      >
        {/* Title and description - smooth fade and slide */}
        <div 
          className="overflow-hidden"
          style={{
            opacity: 1 - scrollProgress,
            transform: `translateY(${scrollProgress * -10}px)`,
            maxHeight: `${(1 - scrollProgress) * 150}px`,
            marginBottom: scrollProgress < 1 ? `${(1 - scrollProgress) * 16}px` : '0px',
            transition: 'opacity 0.1s linear, transform 0.1s linear, max-height 0.1s linear, margin-bottom 0.1s linear',
            pointerEvents: scrollProgress > 0.5 ? 'none' : 'auto',
          }}
        >
          <div>
            <h1 className="mb-2 font-bold text-[36px]">أقوال الآباء</h1>
            <p className="text-muted-foreground">
              مكتبة شاملة لحكم وأقوال آباء الكنيسة القديسين والمعلمين. استخدم البحث والفلاتر للعثور على الأقوال حسب القائل أو المصدر أو الموضوع، واضغط على اسم القديس لعرض سيرته، وأضف المفضلات لديك، وشارك الحكمة مع الآخرين.
            </p>
            <button
              onClick={() => setIsVideoModalOpen(true)}
              className="mt-2 flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <Video className="w-4 h-4" />
              <span>← شرح الاستخدام</span>
            </button>
          </div>
        </div>

        {/* Admin Toolbar - Option 1: Dedicated Row */}
        {isEditor && (
          <div className="mt-4 mb-4 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Label */}
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">أدوات التحرير:</span>
              </div>
              
              {/* Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleAddNew}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                  title="إضافة قول جديد"
                >
                  <Plus className="w-4 h-4" />
                  <span>جديد</span>
                </button>
                <button
                  onClick={() => {
                    setBulkEditMode(!bulkEditMode);
                    setSelectedSayingIds([]);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                    bulkEditMode
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border hover:bg-muted'
                  }`}
                  title="تحديد متعدد"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>{bulkEditMode ? 'إلغاء' : 'تحديد'}</span>
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg hover:bg-muted transition-colors text-sm"
                  title="تصدير JSON"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg hover:bg-muted transition-colors text-sm"
                  title="استيراد JSON"
                >
                  <Upload className="w-4 h-4" />
                  <span>استيراد</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {isEditor && bulkEditMode && selectedSayingIds.length > 0 && (
          <div className="mt-4 p-3 bg-primary/10 border border-primary rounded-xl flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedSayingIds.length} عنصر محدد
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                {selectedSayingIds.length === filteredSayings.length ? 'إلغاء الكل' : 'تحديد الكل'}
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                حذف المحدد
              </button>
            </div>
          </div>
        )}

        {/* Search and Filters Container */}
        <div className="space-y-4 sm:space-y-8">
          {/* Search Bar with Sort Button (Mobile) */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="ابحث في المحتوى..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-11 pl-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            {/* Sort Button - Icon only on mobile, beside search bar */}
            <div className="relative flex-shrink-0 sm:hidden" ref={sortDropdownRef}>
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="flex items-center justify-center w-[50px] h-[50px] bg-card border border-border rounded-xl hover:bg-muted transition-colors"
              >
                <ArrowUpDown className="w-5 h-5 text-muted-foreground" />
              </button>

              {/* Dropdown menu - Mobile */}
              {isSortDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-lg z-[100]">
                  <div className="p-2">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortBy(option.value);
                          setIsSortDropdownOpen(false);
                        }}
                        className={`w-full text-right px-3 py-2 rounded-lg text-sm transition-colors ${
                          sortBy === option.value
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Filters and Sort Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 -mt-2 sm:-mt-3.5">
            {/* Filters on the right */}
            <div className="relative flex items-center gap-2 sm:gap-3 w-full sm:w-auto" ref={filtersContainerRef}>
              {/* Bulk Select All (Admin only, when in bulk mode) */}
              {isEditor && bulkEditMode && (
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] bg-card border border-border rounded-xl hover:bg-muted transition-colors"
                  title={selectedSayingIds.length === sortedSayings.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                >
                  {selectedSayingIds.length === sortedSayings.length ? (
                    <CheckSquare className="w-4 h-4 text-primary" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span className="text-sm hidden lg:inline">الكل</span>
                </button>
              )}

              {/* Tag Filter */}
              <div className="flex-1 sm:flex-initial">
                <TagFilter
                  selectedTags={selectedTags}
                  onTagsChange={setSelectedTags}
                  onSearchChange={setSearchQuery}
                  searchQuery={searchQuery}
                  showSearch={false}
                  icon={Tags}
                  containerRef={filtersContainerRef}
                />
              </div>

              {/* Author Filter */}
              <div className="flex-1 sm:flex-initial">
                <MultiSelectFilter
                  label="القائل"
                  options={allAuthors}
                  selectedOptions={selectedAuthors}
                  onOptionsChange={setSelectedAuthors}
                  icon={User}
                />
              </div>

              {/* Source Filter */}
              <div className="flex-1 sm:flex-initial">
                <MultiSelectFilter
                  label="المصدر"
                  options={allSources}
                  selectedOptions={selectedSources}
                  onOptionsChange={setSelectedSources}
                  icon={BookOpen}
                />
              </div>

              {/* Favorites Only Toggle - Always visible */}
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] border rounded-xl transition-all relative whitespace-nowrap ${
                  showFavoritesOnly
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-card border-border hover:bg-muted'
                }`}
                title={showFavoritesOnly ? 'إظهار كل الأقوال' : 'عرض المفضلة قط'}
              >
                <Heart className={`w-4 h-4 flex-shrink-0 transition-all ${showFavoritesOnly ? 'fill-current' : ''}`} />
                <span className="text-sm hidden lg:inline">المفضلة فقط</span>
                {showFavoritesOnly && favoritedQuotes.length > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-2 py-0.5">
                    {favoritedQuotes.length}
                  </span>
                )}
              </button>

              {/* Results Count Info Chip */}
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] bg-muted/50 border border-border/50 rounded-xl pointer-events-none">
                <MessageSquareQuote className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">
                  {sortedSayings.length} / {sayings.length}
                </span>
              </div>
            </div>

            {/* Sort Dropdown on the left */}
            <div className="relative flex-shrink-0 order-1 sm:order-2 hidden sm:block" ref={sortDropdownRef}>
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-card border border-border rounded-xl hover:bg-muted transition-colors text-sm w-full sm:w-auto justify-between"
              >
                <ArrowUpDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span>{sortOptions.find(option => option.value === sortBy)?.label}</span>
                <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${isSortDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown menu */}
              {isSortDropdownOpen && (
                <div className="absolute left-0 right-0 sm:left-0 sm:right-auto top-full mt-2 sm:w-56 bg-card border border-border rounded-xl shadow-lg z-[100]">
                  <div className="p-2">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortBy(option.value);
                          setIsSortDropdownOpen(false);
                        }}
                        className={`w-full text-right px-3 py-2 rounded-lg text-sm transition-colors ${
                          sortBy === option.value
                            ? 'bg-primary/10 text-primary'
                            : 'hover:bg-muted'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto pt-6" ref={scrollContainerRef}>
        {sortedSayings.length > 0 ? (
          <ResponsiveMasonry columnsCountBreakPoints={{350: 1, 750: 2}}>
            <Masonry gutter="16px">
              {sortedSayings.map((item) => {
                const isExpanded =
                  expandedQuoteId !== null && String(expandedQuoteId) === String(item.id);
                const isSelected = selectedSayingIds.some((x) => String(x) === String(item.id));

                return (
                  <div
                    key={item.id}
                    className={`bg-card rounded-xl border overflow-hidden transition-all hover:bg-muted group/card w-full ${
                      isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                    }`}
                    style={{ width: '100%' }}
                  >
                    {/* Main Quote Content - Always visible */}
                    <div 
                      className={`p-5 transition-all ${bulkEditMode ? 'cursor-pointer' : 'cursor-pointer'}`}
                      onClick={() => handleQuoteClick(item.id)}
                    >
                      {/* Bulk Select Checkbox (Admin only, when in bulk mode) */}
                      {isEditor && bulkEditMode && (
                        <div className="mb-3 flex items-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectSaying(item.id);
                            }}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-primary" />
                            ) : (
                              <Square className="w-5 h-5 text-muted-foreground" />
                            )}
                          </button>
                        </div>
                      )}

                      {/* Quote Text */}
                      <blockquote className="text-foreground/90 leading-relaxed mb-4 text-base">
                        "{item.quote}"
                      </blockquote>

                      {/* Author Section */}
                      <div className="flex items-center justify-between gap-3">
                        {/* Author Info */}
                        <div className="flex items-center gap-3">
                          <img 
                            src={item.authorImage} 
                            alt={item.author}
                            className="w-12 h-12 rounded-full object-cover border-2 border-border"
                          />
                          <button
                            onClick={(e) => handleAuthorClick(item.author, e)}
                            className="text-sm font-medium text-primary hover:underline transition-all"
                          >
                            {item.author}
                          </button>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-2">
                          {/* Admin Edit/Delete buttons */}
                          {isEditor && !bulkEditMode && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(item);
                                }}
                                className="p-2 rounded-lg hover:bg-background transition-colors text-muted-foreground hover:text-primary"
                                title="تعديل"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(item.id);
                                }}
                                className="p-2 rounded-lg hover:bg-background transition-colors text-muted-foreground hover:text-red-500"
                                title="حذف"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShare(item);
                            }}
                            className="p-2 rounded-lg hover:bg-background transition-colors text-muted-foreground hover:text-foreground"
                            title="مشاركة"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(item.id);
                            }}
                            className={`p-2 rounded-lg transition-colors ${
                              favoritedQuotes.some((f) => String(f) === String(item.id))
                                ? 'text-red-500 hover:text-red-600'
                                : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title="مفضلة"
                          >
                            <Heart className={`w-4 h-4 ${favoritedQuotes.some((f) => String(f) === String(item.id)) ? 'fill-current' : ''}`} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details - With animation like hymns */}
                    <div 
                      className={`grid transition-all duration-500 ease-in-out ${
                        isExpanded
                          ? 'grid-rows-[1fr] opacity-100' 
                          : 'grid-rows-[0fr] opacity-0'
                      }`}
                    >
                      <div className="overflow-hidden">
                        <div className="border-t border-border/50 px-5 pb-5">
                          <div className="space-y-3 pt-4">
                            {/* Tags */}
                            <div className="flex flex-wrap gap-2">
                              {item.tags.map((tag, index) => (
                                <span 
                                  key={index}
                                  className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-full"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>

                            {/* Source and Date */}
                            <div className="space-y-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4" />
                                <span>المصدر: {item.source}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span>تاريخ الإضافة: {new Date(item.dateAdded).toLocaleDateString('ar-EG')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Masonry>
          </ResponsiveMasonry>
        ) : (
          <div className="text-center py-12 bg-card rounded-xl border border-border">
            <p className="text-muted-foreground">لا توجد أقوال مطابقة للبحث أو التصنيفات المحددة</p>
          </div>
        )}
      </div>

      {/* Share Message */}
      {shareMessage && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-xl shadow-lg z-50 animate-fade-in">
          {shareMessage}
        </div>
      )}

      {/* Father Profile Modal */}
      <FatherProfileModal
        father={selectedFather ? getFatherByName(selectedFather) || null : null}
        sayings={sayings as any}
        isOpen={isFatherModalOpen}
        onClose={handleCloseFatherModal}
        favoritedQuotes={favoritedQuotes as any}
        onToggleFavorite={toggleFavorite as any}
        onShare={handleShare}
      />

      {/* Admin Edit Modal */}
      {isEditor && (
        <AdminEditSayingModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingSaying(null);
          }}
          onSave={handleSaveSaying}
          saying={editingSaying}
          allAuthors={allAuthors}
          allSources={allSources}
        />
      )}

      {/* Video Tutorial Modal */}
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="شرح استخدام مكتبة أقوال الآباء"
      />
    </div>
  );
}