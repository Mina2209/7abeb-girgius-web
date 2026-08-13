  import { Heart, Share2, ArrowUpDown, Search, ChevronDown, Tags, User, BookOpen, Calendar, Plus, Edit2, Trash2, Download, Upload, CheckSquare, Square, CheckCheck, Video, MessageSquareQuote, Users, X, Image as ImageIcon, FileSpreadsheet } from 'lucide-react';
  import { useState, useMemo, useRef, useEffect } from 'react';
  import { useNavigate } from 'react-router-dom';
  import { TagFilter } from './TagFilter';
  import { MultiSelectFilter } from './MultiSelectFilter';
  import Masonry, { ResponsiveMasonry } from 'react-responsive-masonry';
  import { getFatherByName, fathers as staticFathersData } from '../data/fathers';
  import { useIsEditor } from '../utils/adminUtils';
  import { normalizeArabic } from '../utils/arabicUtils';
  import { AdminEditSayingModal } from './AdminEditSayingModal';
  import { VideoModal } from './VideoModal';
  import { useSayingsData } from '../hooks/useSayingsData';
  import { useFavorites } from '../hooks/useFavorites';
  import type { ContentId, Saying } from '../types/content';
  import { useAuth } from '../contexts/AuthContext';
import { createSaying, deleteSaying, updateSaying, fetchFatherByName, fetchFathers, createFather, bulkImportSayings } from '../services/contentWriteService';
import { AdminEditFatherModal } from './AdminEditFatherModal';
import { apiRequest } from '../services/apiClient';
import { trackEvent } from '../services/analytics';
import { useSearchAnalytics } from '../hooks/useSearchAnalytics';
import { toast } from 'sonner';
  import type { Father } from '../data/fathers';



  type SortOption = 'author-asc' | 'author-desc' | 'date-asc' | 'date-desc';

  const sortOptions = [
    { value: 'author-asc' as SortOption, label: 'حسب القائل (أ - ي)' },
    { value: 'author-desc' as SortOption, label: 'حسب القائل (ي - أ)' },
    { value: 'date-asc' as SortOption, label: 'الأقدم' },
    { value: 'date-desc' as SortOption, label: 'الأحدث' },
  ];

  type SayingFacet = 'tags' | 'authors' | 'sources';

  const sortArabic = (a: string, b: string) => a.localeCompare(b, 'ar');

  const uniqueSorted = (values: string[]) =>
    Array.from(new Set(values.filter(Boolean))).sort(sortArabic);

  const normalizeSearchText = (text: string) => normalizeArabic(text).toLowerCase();

  function sayingMatchesSearch(item: Saying, query: string) {
    if (!query) return true;
    const normalizedQuery = normalizeSearchText(query);
    return (
      normalizeSearchText(item.quote).includes(normalizedQuery) ||
      normalizeSearchText(item.author).includes(normalizedQuery) ||
      normalizeSearchText(item.source).includes(normalizedQuery) ||
      item.tags.some((tag) => normalizeSearchText(tag).includes(normalizedQuery))
    );
  }

  function sayingMatchesTags(item: Saying, selectedTags: string[]) {
    return (
      selectedTags.length === 0 ||
      selectedTags.some((tag) => item.tags.includes(tag))
    );
  }

  function sayingMatchesAuthors(item: Saying, selectedAuthors: string[]) {
    return (
      selectedAuthors.length === 0 ||
      selectedAuthors.includes(item.author)
    );
  }

  function sayingMatchesSources(item: Saying, selectedSources: string[]) {
    return (
      selectedSources.length === 0 ||
      selectedSources.includes(item.source)
    );
  }

  function sayingMatchesFavorites(
    item: Saying,
    showFavoritesOnly: boolean,
    favoritedQuotes: ContentId[],
  ) {
    return (
      !showFavoritesOnly ||
      favoritedQuotes.some((f) => String(f) === String(item.id))
    );
  }

  function getSayingsForFacet(
    sayings: Saying[],
    params: {
      searchQuery: string;
      selectedTags: string[];
      selectedAuthors: string[];
      selectedSources: string[];
      showFavoritesOnly: boolean;
      favoritedQuotes: ContentId[];
      excludeFacet?: SayingFacet;
    },
  ) {
    const {
      searchQuery,
      selectedTags,
      selectedAuthors,
      selectedSources,
      showFavoritesOnly,
      favoritedQuotes,
      excludeFacet,
    } = params;

    return sayings.filter((item) => {
      if (!sayingMatchesSearch(item, searchQuery)) return false;
      if (excludeFacet !== 'tags' && !sayingMatchesTags(item, selectedTags)) {
        return false;
      }
      if (
        excludeFacet !== 'authors' &&
        !sayingMatchesAuthors(item, selectedAuthors)
      ) {
        return false;
      }
      if (
        excludeFacet !== 'sources' &&
        !sayingMatchesSources(item, selectedSources)
      ) {
        return false;
      }
      if (
        !sayingMatchesFavorites(item, showFavoritesOnly, favoritedQuotes)
      ) {
        return false;
      }
      return true;
    });
  }

  export function SayingsSection() {
    const navigate = useNavigate();
    const isEditor = useIsEditor();
    const { accessToken } = useAuth();
    const { sayings, setSayings, loading: sayingsLoading } = useSayingsData();

    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
    const [selectedSources, setSelectedSources] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<SortOption>('date-desc');
    const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
    const [expandedQuoteId, setExpandedQuoteId] = useState<ContentId | null>(null);
    const { favoriteIds: favoritedQuoteIds, toggleFavorite: apiToggleFavorite, count: favoritedCount } = useFavorites('SAYING');
    const favoritedQuotes = Array.from(favoritedQuoteIds);
    const [shareMessage, setShareMessage] = useState<string | null>(null);
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [showFathersList, setShowFathersList] = useState(false);
    const [allFathers, setAllFathers] = useState<Father[]>([]);
    const [fathersLoading, setFathersLoading] = useState(false);
    const [isNewFatherModalOpen, setIsNewFatherModalOpen] = useState(false);

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
    const excelFileInputRef = useRef<HTMLInputElement>(null);

    // Load all fathers eagerly so we can resolve author images for cards
    useEffect(() => {
      const seen = new Set<string>();
      const combined: Father[] = [];
      for (const f of staticFathersData) { combined.push(f); seen.add(f.name); }
      fetchFathers(accessToken).then(serverFathers => {
        for (const f of serverFathers) {
          if (!seen.has(f.name)) { combined.push(f); }
          else { const idx = combined.findIndex(c => c.name === f.name); if (idx !== -1 && !f.id.startsWith('static-')) combined[idx] = f; }
          seen.add(f.name);
        }
        setAllFathers(combined);
      }).catch(() => setAllFathers(combined));
    }, []);

    // Map author name -> father profileImage for fallback
    const fatherImageMap = useMemo(() => {
      const map = new Map<string, string>();
      for (const f of allFathers) {
        if (f.profileImage) map.set(f.name, f.profileImage);
      }
      return map;
    }, [allFathers]);

    // Get unique authors, sources, and tags
    const allAuthors = useMemo(() => Array.from(new Set(sayings.map(s => s.author))), [sayings]);
    const allSources = useMemo(() => Array.from(new Set(sayings.map(s => s.source))), [sayings]);
    const allTags = useMemo(() => Array.from(new Set(sayings.flatMap(s => s.tags))), [sayings]);

    const fathersWithSayings = useMemo(() => {
      const authorMap = new Map<string, Father>();
      for (const f of staticFathersData) authorMap.set(f.name, f);

      const uniqueAuthors = Array.from(new Set(sayings.map(s => s.author).filter(Boolean)));

      for (const name of uniqueAuthors) {
        if (authorMap.has(name)) continue;
        const serverFather = allFathers.find(f => f.name === name && !f.id.startsWith('static-'));
        if (serverFather) {
          authorMap.set(name, serverFather);
        } else {
          authorMap.set(name, {
            id: `author-${name}`,
            name,
            title: '',
            bio: '',
            profileImage: '',
          });
        }
      }

      return Array.from(authorMap.values()).filter(f => uniqueAuthors.includes(f.name));
    }, [allFathers, sayings]);

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

    // Load all fathers when modal opens
    useEffect(() => {
      if (!showFathersList) return;
      setFathersLoading(true);
      const seen = new Set<string>();
      const combined: Father[] = [];

      for (const f of staticFathersData) {
        combined.push(f);
        seen.add(f.name);
      }

      fetchFathers(accessToken).then(serverFathers => {
        for (const f of serverFathers) {
          if (!seen.has(f.name)) {
            combined.push(f);
          } else {
            const idx = combined.findIndex(c => c.name === f.name);
            if (idx !== -1 && !f.id.startsWith('static-')) combined[idx] = f;
          }
          seen.add(f.name);
        }
        setAllFathers(combined);
        setFathersLoading(false);
      }).catch(() => {
        setAllFathers(combined);
        setFathersLoading(false);
      });
    }, [showFathersList]);

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

    const handleSaveSaying = async (input: Saying | Saying[]) => {
      const sayingsToSave = Array.isArray(input) ? input : [input];

      try {
        if (editingSaying && typeof editingSaying.id === 'string' && sayingsToSave.length === 1) {
          const updated = await updateSaying(editingSaying.id, sayingsToSave[0], accessToken);
          setSayings(prev => prev.map(s => s.id === updated.id ? updated : s));
          setShareMessage('تم التحديث بنجاح');
        } else {
          // When adding multiple sayings, do sequential create for now.
          // (Bulk API can be added later; this keeps behavior working immediately.)
          const created = [] as Saying[];
          for (const s of sayingsToSave) {
            const row = await createSaying(s, accessToken);
            created.push(row);
          }
          setSayings(prev => [...prev, ...created]);
          setShareMessage(`تمت الإضافة بنجاح (${created.length} قول${created.length === 1 ? '' : ''})`);
        }
      } catch {
        setShareMessage('فشل الحفظ على الخادم');
        toast.error('فشل الحفظ على الخادم');
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
            toast.error('ملف غير صالح. يجب أن يحتوي على مصفوفة JSON.');
          }
        } catch (error) {
          toast.error('خطأ في قراءة الملف');
        }
      };
      reader.readAsText(file);
      
      // Reset input
      event.target.value = '';
    };

    const handleExcelImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      try {
        const XLSX = await import('xlsx');
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as unknown as Record<string, string>[];

        if (jsonData.length === 0) {
          toast.error('الملف فارغ أو لا يحتوي على بيانات');
          return;
        }

        const rows = jsonData.map(row => ({
          content: row['القول'] || '',
          author: row['القائل'] || '',
          source: row['المصدر'] || undefined,
          topic: row['الموضوع'] || undefined,
        })).filter(row => row.content && row.author);

        if (rows.length === 0) {
          toast.error('لا توجد بيانات صالحة. تأكد من وجود أعمدة "القول" و"القائل"');
          return;
        }

        const result = await bulkImportSayings(rows, accessToken);

        const imported: Saying[] = rows.map((row, i) => ({
          id: `excel-${Date.now()}-${i}`,
          quote: row.content,
          author: row.author,
          authorImage: '',
          tags: row.topic ? [row.topic] : [],
          source: row.source || '',
          dateAdded: new Date().toISOString().split('T')[0],
        }));

        setSayings(prev => [...prev, ...imported]);
        setShareMessage(`تم استيراد ${result.count} قول بنجاح`);
        setTimeout(() => setShareMessage(null), 2000);
        toast.success(`تم استيراد ${result.count} قول`);
      } catch (err) {
        console.error('Excel import error:', err);
        toast.error('فشل استيراد الملف. تأكد من صيغة الملف والأعمدة المطلوبة.');
      }

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
      apiToggleFavorite(quoteId);
    };

    const handleShare = (quote: Saying) => {
      const shareText = `"${quote.quote}"\n\n- ${quote.author}`;
      // Engage with a specific quote — never send the quote text itself.
      trackEvent('saying_view', {
        contentType: 'saying',
        contentId: quote.id,
        contentName: quote.author,
      });
      trackEvent('share_started', {
        contentType: 'saying',
        contentId: quote.id,
        contentName: quote.author,
      });

      if (navigator.share) {
        navigator.share({
          title: 'قول من أقوال الآباء',
          text: shareText,
        }).then(() => {
          trackEvent('share_completed', {
            contentType: 'saying',
            contentId: quote.id,
            contentName: quote.author,
            properties: { method: 'native' },
          });
        }).catch(() => {
          // Fallback to clipboard
          copyToClipboard(shareText, quote);
        });
      } else {
        copyToClipboard(shareText, quote);
      }
    };

    const copyToClipboard = (text: string, quote?: Saying) => {
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
        if (quote) {
          trackEvent('share_completed', {
            contentType: 'saying',
            contentId: quote.id,
            contentName: quote.author,
            properties: { method: 'copy' },
          });
        }
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

    const handleAuthorClick = async (authorName: string, e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        const father = await fetchFatherByName(authorName, accessToken);
        if (father) {
          navigate(`/sayings/authors/${father.id}`);
          return;
        }
      } catch {}
      const staticFather = getFatherByName(authorName);
      if (staticFather) {
        navigate(`/sayings/authors/${staticFather.id}`);
      } else {
        navigate(`/sayings/authors/author-${encodeURIComponent(authorName)}`);
      }
    };

    // Filter sayings
    const filteredSayings = useMemo(() => {
      return sayings.filter(item => {
        const matchesSearch =
          searchQuery === "" || sayingMatchesSearch(item, searchQuery);

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

    useSearchAnalytics(searchQuery, {
      section: "sayings",
      getResultCount: () => filteredSayings.length,
    });

    const availableSayingsForTags = useMemo(
      () =>
        getSayingsForFacet(sayings, {
          searchQuery,
          selectedTags,
          selectedAuthors,
          selectedSources,
          showFavoritesOnly,
          favoritedQuotes,
          excludeFacet: 'tags',
        }),
      [
        sayings,
        searchQuery,
        selectedTags,
        selectedAuthors,
        selectedSources,
        showFavoritesOnly,
        favoritedQuotes,
      ],
    );

    const availableSayingsForAuthors = useMemo(
      () =>
        getSayingsForFacet(sayings, {
          searchQuery,
          selectedTags,
          selectedAuthors,
          selectedSources,
          showFavoritesOnly,
          favoritedQuotes,
          excludeFacet: 'authors',
        }),
      [
        sayings,
        searchQuery,
        selectedTags,
        selectedAuthors,
        selectedSources,
        showFavoritesOnly,
        favoritedQuotes,
      ],
    );

    const availableSayingsForSources = useMemo(
      () =>
        getSayingsForFacet(sayings, {
          searchQuery,
          selectedTags,
          selectedAuthors,
          selectedSources,
          showFavoritesOnly,
          favoritedQuotes,
          excludeFacet: 'sources',
        }),
      [
        sayings,
        searchQuery,
        selectedTags,
        selectedAuthors,
        selectedSources,
        showFavoritesOnly,
        favoritedQuotes,
      ],
    );

    const availableTagNames = useMemo(
      () => uniqueSorted(availableSayingsForTags.flatMap((item) => item.tags)),
      [availableSayingsForTags],
    );

    const availableAuthorNames = useMemo(
      () =>
        uniqueSorted(availableSayingsForAuthors.map((item) => item.author)),
      [availableSayingsForAuthors],
    );

    const availableSourceNames = useMemo(
      () =>
        uniqueSorted(availableSayingsForSources.map((item) => item.source)),
      [availableSayingsForSources],
    );

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
    {/* Section Header - normal flow container, scrolls up naturally */}
    <div>
      <div>
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="font-bold text-2xl sm:text-3xl lg:text-[36px]">أقوال الآباء</h1>
            <button
              onClick={() => setShowFathersList(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium shrink-0"
            >
              <Users className="w-4 h-4" />
              <span>الآباء</span>
            </button>
          </div>
          <p className="text-muted-foreground leading-relaxed">
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

      {/* Admin Toolbar */}
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
                  <button
                    onClick={() => excelFileInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg hover:bg-muted transition-colors text-sm"
                    title="استيراد من إكسل"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>إستيراد من إكسل</span>
                  </button>
                  <input
                    ref={excelFileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleExcelImport}
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
        </div>

        {/* Sticky Filter Toolbar - pinned at the top while scrolling */}
        <div className="sticky z-50 isolate bg-background border-b border-border/50 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.3)] py-3 sm:py-4" style={{ top: 'var(--app-header-height)' }}>
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
                  className="flex items-center justify-center min-w-[44px] min-h-[44px] w-[50px] h-[50px] bg-card border border-border rounded-xl hover:bg-muted transition-colors"
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
                  availableTopics={availableTagNames}
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
                  availableOptions={availableAuthorNames}
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
                  availableOptions={availableSourceNames}
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
        <div className="pt-6" ref={scrollContainerRef}>
          {sortedSayings.length > 0 ? (
            <ResponsiveMasonry columnsCountBreakPoints={{0: 1, 350: 1, 750: 2}}>
              <Masonry gutter="16px">
                {sortedSayings.map((item) => {
                  const isExpanded =
                    expandedQuoteId !== null && String(expandedQuoteId) === String(item.id);
                  const isSelected = selectedSayingIds.some((x) => String(x) === String(item.id));

                  return (
                    <div
                      key={item.id}
                      className={`bg-card relative z-0 isolate rounded-xl border overflow-hidden transition-all hover:bg-muted group/card w-full ${
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
                              src={item.authorImage || fatherImageMap.get(item.author) || ''} 
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

        {/* Fathers List Modal */}
        {showFathersList && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
            <div className="bg-background rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card flex-shrink-0">
                <h2 className="text-2xl font-bold">الآباء</h2>
                <div className="flex items-center gap-2">
                  {isEditor && (
                    <button
                      onClick={() => {
                        setIsNewFatherModalOpen(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                    >
                      <Plus className="w-4 h-4" />
                      <span>إضافة آب</span>
                    </button>
                  )}
                  <button
                    onClick={() => setShowFathersList(false)}
                    className="p-2 hover:bg-muted rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                {fathersLoading ? (
                  <div className="flex flex-col items-center justify-center min-h-[30vh] gap-2 text-muted-foreground">
                    <p>جاري تحميل الآباء...</p>
                  </div>
                ) : fathersWithSayings.length === 0 ? (
                  <div className="text-center py-12 bg-card rounded-xl border border-border">
                    <p className="text-muted-foreground">لا يوجد آباء لديهم أقوال بعد</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {fathersWithSayings.map((father) => {
                      const sayingCount = sayings.filter(s => s.author === father.name).length;

                      return (
                        <div
                          key={father.id}
                          className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-all group cursor-pointer"
                          onClick={() => {
                            setShowFathersList(false);
                            navigate(`/sayings/authors/${father.id}`);
                          }}
                        >
                          <div className="relative h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center overflow-hidden">
                            {father.profileImage ? (
                              <img
                                src={father.profileImage}
                                alt={father.name}
                                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full object-cover border-4 border-background shadow-xl group-hover:scale-110 transition-transform duration-300"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = '';
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-background shadow-xl bg-muted flex items-center justify-center">
                                <ImageIcon className="w-12 h-12 text-muted-foreground" />
                              </div>
                            )}
                          </div>

                          <div className="p-6 space-y-4">
                            {isEditor && father && !father.id.startsWith('static-') && (
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowFathersList(false);
                                    navigate(`/sayings/authors/${father.id}`);
                                  }}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-muted hover:bg-primary hover:text-primary-foreground rounded-lg transition-colors text-sm font-medium"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                  تعديل
                                </button>
                                {!father.id.startsWith('author-') && (
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      if (!confirm(`هل أنت متأكد من حذف "${father.name}"؟`)) return;
                                      try {
                                        const res = await apiRequest(`/api/fathers/${father.id}`, { method: 'DELETE' });
                                        if (!res.ok) {
                                          const err = await res.json().catch(() => ({}));
                                          throw new Error(err.error || 'فشل الحذف');
                                        }
                                        setShareMessage('تم حذف الآب بنجاح');
                                        setAllFathers(prev => prev.filter(f => f.id !== father.id));
                                      } catch (e: any) {
                                        setShareMessage(e.message || 'فشل حذف الآب');
                                      }
                                      setTimeout(() => setShareMessage(null), 2000);
                                    }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-600 rounded-lg transition-colors text-sm font-medium"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    حذف
                                  </button>
                                )}
                              </div>
                            )}

                            <div className="text-center space-y-1">
                              <h3 className="text-xl font-bold">{father.name}</h3>
                              {father.title && <p className="text-primary font-medium text-sm">{father.title}</p>}
                            </div>

                            {father.bio && (
                              <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 text-center">
                                {father.bio}
                              </p>
                            )}

                            <div className="flex items-center justify-center">
                              <span className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm font-medium">
                                {sayingCount} قول
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Admin Edit Father Modal - Create */}
        {isEditor && (
          <AdminEditFatherModal
            isOpen={isNewFatherModalOpen}
            onClose={() => {
              setIsNewFatherModalOpen(false);
            }}
            onSave={async (fatherData) => {
              try {
                const created = await createFather(fatherData, accessToken);
                setAllFathers(prev => [...prev, created]);
                setShareMessage('تم إضافة الآب بنجاح');
              } catch (e: any) {
                const isDuplicate = e.message?.includes('409') || e.message?.includes('هذا الاسم');
                setShareMessage(isDuplicate ? 'هذا الاسم موجود مسبقاً' : 'فشل إضافة الآب');
              }
              setTimeout(() => setShareMessage(null), 2000);
              setIsNewFatherModalOpen(false);
            }}
            isNew
          />
        )}
      </div>
    );
  }
