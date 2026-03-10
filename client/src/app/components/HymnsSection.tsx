import { Play, Download, ArrowUpDown, Search, ChevronDown, FileVideo, Presentation, FileAudio, FileText, Video, X, Tags, Heart, Share2, Eye, Check, Plus, Edit2, Trash2, Upload, CheckSquare, Square, CheckCheck, Music } from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { TagFilter } from './TagFilter';
import { useAuth } from '../contexts/AuthContext';
import { LoginRequiredModal } from './LoginRequiredModal';
import { useIsEditor } from '../utils/adminUtils';
import { AdminEditHymnModal } from './AdminEditHymnModal';
import { VideoModal } from './VideoModal';

type FileType = 'Video montage' | 'Video PowerPoint' | 'PowerPoint file' | 'Music';

interface HymnFile {
  type: FileType;
  name: string;
  url: string; // base64 or URL
  size?: number;
}

interface Hymn {
  id: number;
  title: string;
  duration: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  fileTypes: FileType[];
  lyrics: string;
  files?: HymnFile[]; // Array of uploaded files
}

const defaultHymns: Hymn[] = [
  {
    id: 1,
    title: 'تينثينو',
    duration: '4:30',
    tags: ['تسبحة', 'تسبحة نصف الليل', 'الصلاة'],
    createdAt: '2023-11-10',
    updatedAt: '2024-01-15',
    fileTypes: ['Video PowerPoint', 'PowerPoint file', 'Music'] as FileType[],
    lyrics: 'نسبحك ونباركك\nونشكرك يا رب\nونتضرع إليك يا إلهنا',
  },
  {
    id: 2,
    title: 'بي اويك',
    duration: '3:45',
    tags: ['مديحة', 'القديسة مريم العذراء', 'لحن كيهكي'],
    createdAt: '2023-12-05',
    updatedAt: '2024-02-20',
    fileTypes: ['Video montage', 'PowerPoint file', 'Music'] as FileType[],
    lyrics: 'السلام لك يا مريم\nالممتلئة نعمة\nالرب معك',
  },
  {
    id: 3,
    title: 'افنوتي ناي نان',
    duration: '5:12',
    tags: ['تسبحة', 'الرحمة', 'الصلاة'],
    createdAt: '2023-10-20',
    updatedAt: '2024-01-10',
    fileTypes: ['PowerPoint file', 'Music'] as FileType[],
    lyrics: 'ارحمنا يا الله\nارحمنا بعظم رحمتك\nاستجب لنا يا رب',
  },
  {
    id: 4,
    title: 'شيري ني ماريا',
    duration: '3:20',
    tags: ['مديحة', 'القديسة مريم العذراء', 'لحن سنوي'],
    createdAt: '2024-01-18',
    updatedAt: '2024-03-05',
    fileTypes: ['Video PowerPoint', 'PowerPoint file', 'Music'] as FileType[],
    lyrics: 'السلام لمريم الملكة\nأم النور الحقيقي\nافرحي يا عروس بلا عيب\n\nيا سلطانة السموات والأرض\nيا أم الرحمة والحنان\nيا شفيعتنا الأمينة\nيا ملجأنا في الشدائد\n\nنسبحك ونمجدك\nونطلب شفاعتك\nأمام عرش النعمة\nفي كل حين وكل أوان\n\nأنت الكرمة الحقيقية\nأنت المدينة المقدسة\nأنت الباب السماوي\nأنت السلم الذي رأى يعقوب\n\nبك دخل الخلاص إلى العالم\nبك انفتحت أبواب الفردوس\nبك نلنا البركة والرحمة\nبك صرنا أبناء الله\n\nيا والدة الإله\nيا أم المخلص\nيا سيدة العالم كله\nاذكرينا في صلواتك\n\nاشفعي فينا عند ابنك الحبيب\nليغفر لنا خطايانا\nويرحمنا في يوم الدينونة\nويقبلنا في ملكوته السماوي\n\nمبارك اسمك في كل جيل\nمبارك اسمك إلى الأبد\nمبارك اسمك يا أم النور\nمبارك اسمك يا ملكة السموات',
  },
  {
    id: 5,
    title: 'كي ايبرتو',
    duration: '4:00',
    tags: ['قيامة', 'عيد القيامة', 'لحن فرايحي'],
    createdAt: '2024-01-05',
    updatedAt: '2024-02-28',
    fileTypes: ['Video PowerPoint', 'Music'] as FileType[],
    lyrics: 'المسيح قام من بين الأموات\nووطئ الموت بالموت\nووهب الحياة للذين في القبور',
  },
  {
    id: 6,
    title: 'افلوجيمينوس',
    duration: '2:50',
    tags: ['قداس', 'الليتورجيا', 'لحن سنوي'],
    createdAt: '2023-11-30',
    updatedAt: '2024-01-25',
    fileTypes: ['PowerPoint file', 'Music'] as FileType[],
    lyrics: 'مبارك الآتي باسم الرب\nباركنا من بيت الرب\nالرب إله وقد أضاء علا',
  },
  {
    id: 7,
    title: 'اجيوس',
    duration: '3:15',
    tags: ['قداس', 'الليتورجيا', 'لحن سنوي'],
    createdAt: '2024-02-12',
    updatedAt: '2024-03-10',
    fileTypes: ['Video montage', 'Video PowerPoint', 'PowerPoint file', 'Music'] as FileType[],
    lyrics: 'قدوس قدوس قدوس\nرب الصباؤوت\nالسماء والأرض مملوءتان من مجدك',
  },
  {
    id: 8,
    title: 'ذوكسا سي كيريه',
    duration: '2:30',
    tags: ['تسبحة', 'الشكر', 'لحن سنوي'],
    createdAt: '2023-12-20',
    updatedAt: '2024-02-15',
    fileTypes: ['PowerPoint file', 'Music'] as FileType[],
    lyrics: 'المجد لك يا رب\nالمجد لك يا قدوس\nالمجد لك يا ملك',
  },
  {
    id: 9,
    title: 'يا إلهي أعمق الحب هواك',
    duration: '3:50',
    tags: ['ترنيمة', 'المحبة', 'التسبيح'],
    createdAt: '2024-02-28',
    updatedAt: '2024-03-15',
    fileTypes: ['Video montage', 'Video PowerPoint', 'PowerPoint file', 'Music'] as FileType[],
    lyrics: 'يا إلهي أعمق الحب هواك         يا إلهي لي اشتهاء أن أراك\nلي اشتهاء أن أراك\nفي جمالٍ في بهاءٍ مبهرٍ         في جلالٍ وسط قوات سماك\nأو أرى حسنك في الابن الذي         كل شخص قد رآه قد رآك\nأنت ملءُ العقل والقلب معا         ليس في غربة العمر سواك\nأنا وسط الناس اجذبهم ��ك         أنا في الوحدة استوحي نِداك\nأنت أصل الكون يا رب الورى         كل مجد الكون صاغته يداك\nيا إلهي أنت عوني. أنت حصني         أنت ربي أنا أحيا في حِماك\nفيك ما يُشْبِعُ قلبي دائمًا         إيه ربي متعة القلب رضاك',
  },
];

type SortOption = 'alpha-asc' | 'alpha-desc' | 'length-asc' | 'length-desc' | 'date-asc' | 'date-desc';

const sortOptions = [
  { value: 'alpha-asc' as SortOption, label: 'أبجدياً (أ - ي)' },
  { value: 'alpha-desc' as SortOption, label: 'أبجدياً (ي - أ)' },
  { value: 'length-asc' as SortOption, label: 'الأقصر أولاً' },
  { value: 'length-desc' as SortOption, label: 'الأطول أولاً' },
  { value: 'date-desc' as SortOption, label: 'الأحدث أولاً' },
  { value: 'date-asc' as SortOption, label: 'الأقدم أولاً' },
];

const allFileTypes: FileType[] = ['Video montage', 'Video PowerPoint', 'PowerPoint file', 'Music'];

const STORAGE_KEY = 'hymns_data';

// Helper function to get icon for file type
const getFileTypeIcon = (fileType: FileType) => {
  switch (fileType) {
    case 'Video montage':
      return Video;
    case 'Video PowerPoint':
      return FileVideo;
    case 'PowerPoint file':
      return Presentation;
    case 'Music':
      return FileAudio;
  }
};

// Helper function to get Arabic label for file type
const getFileTypeLabel = (fileType: FileType) => {
  switch (fileType) {
    case 'Video montage':
      return 'فيديو مونتاج';
    case 'Video PowerPoint':
      return 'فيديو بوربوينت';
    case 'PowerPoint file':
      return 'بوربوينت';
    case 'Music':
      return 'موسيقى';
  }
};

export function HymnsSection({ isSidebarCollapsed }: { isSidebarCollapsed: boolean }) {
  const { user, profile } = useAuth();
  const isEditor = useIsEditor();

  // Load hymns from localStorage or use defaults
  const [hymns, setHymns] = useState<Hymn[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaultHymns;
  });

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedFileTypes, setSelectedFileTypes] = useState<FileType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('alpha-asc');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isFileTypeDropdownOpen, setIsFileTypeDropdownOpen] = useState(false);
  const [favoritedHymns, setFavoritedHymns] = useState<number[]>([]);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [expandedHymnId, setExpandedHymnId] = useState<number | null>(null);
  const [expandedLyricsIds, setExpandedLyricsIds] = useState<number[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  // Multi-select states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedHymnIds, setSelectedHymnIds] = useState<number[]>([]);

  // Admin states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingHymn, setEditingHymn] = useState<Hymn | null>(null);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  
  // Video tutorial modal state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const fileTypeDropdownRef = useRef<HTMLDivElement>(null);
  const filtersContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get unique tags from hymns
  const allTags = useMemo(() => Array.from(new Set(hymns.flatMap(h => h.tags))), [hymns]);

  // Save to localStorage whenever hymns change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hymns));
  }, [hymns]);

  // Load favorites from localStorage on mount
  useEffect(() => {
    if (user && profile) {
      const saved = localStorage.getItem('favoriteHymns');
      if (saved) {
        setFavoritedHymns(JSON.parse(saved));
      }
    }
  }, [user, profile]);

  // Detect scroll to hide title/description
  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const scrollTop = scrollContainerRef.current.scrollTop;
        const scrollRange = 50; // Distance over which to fade out (in pixels)
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
      if (fileTypeDropdownRef.current && !fileTypeDropdownRef.current.contains(event.target as Node)) {
        setIsFileTypeDropdownOpen(false);
      }
    };

    if (isSortDropdownOpen || isFileTypeDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSortDropdownOpen, isFileTypeDropdownOpen]);

  // Toggle file type selection
  const toggleFileType = (fileType: FileType) => {
    setSelectedFileTypes(prev =>
      prev.includes(fileType)
        ? prev.filter(ft => ft !== fileType)
        : [...prev, fileType]
    );
  };

  // Toggle favorite
  const toggleFavorite = (hymnId: number) => {
    // Check if user is authenticated
    if (!user || !profile) {
      setShowLoginModal(true);
      return;
    }

    setFavoritedHymns(prev =>
      prev.includes(hymnId)
        ? prev.filter(id => id !== hymnId)
        : [...prev, hymnId]
    );

    // Persist to localStorage
    const updated = favoritedHymns.includes(hymnId)
      ? favoritedHymns.filter(id => id !== hymnId)
      : [...favoritedHymns, hymnId];
    localStorage.setItem('favoriteHymns', JSON.stringify(updated));
  };

  // Toggle lyrics expansion
  const toggleLyricsExpansion = (hymnId: number) => {
    setExpandedLyricsIds(prev =>
      prev.includes(hymnId)
        ? prev.filter(id => id !== hymnId)
        : [...prev, hymnId]
    );
  };

  // Admin Functions
  const handleAddNew = () => {
    setEditingHymn(null);
    setIsEditModalOpen(true);
  };

  const handleEdit = (hymn: Hymn) => {
    setEditingHymn(hymn);
    setIsEditModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('هل أنت متأكد من حذف هذه الترنيمة؟')) {
      setHymns(prev => prev.filter(h => h.id !== id));
      setShareMessage('تم الحذف بنجاح');
      setTimeout(() => setShareMessage(null), 2000);
    }
  };

  const handleBulkDelete = () => {
    if (selectedHymnIds.length === 0) return;
    if (confirm(`هل أنت متأكد من حذف ${selectedHymnIds.length} ترنيمة؟`)) {
      setHymns(prev => prev.filter(h => !selectedHymnIds.includes(h.id)));
      setSelectedHymnIds([]);
      setBulkEditMode(false);
      setShareMessage('تم الحذف بنجاح');
      setTimeout(() => setShareMessage(null), 2000);
    }
  };

  const handleSelectAll = () => {
    const allVisibleIds = filteredHymns.map(hymn => hymn.id);
    if (selectedHymnIds.length === allVisibleIds.length) {
      // Deselect all
      setSelectedHymnIds([]);
    } else {
      // Select all
      setSelectedHymnIds(allVisibleIds);
    }
  };

  const handleSaveHymn = (hymn: Hymn) => {
    if (editingHymn) {
      // Update existing
      setHymns(prev => prev.map(h => h.id === hymn.id ? hymn : h));
      setShareMessage('تم التحديث بنجاح');
    } else {
      // Add new
      setHymns(prev => [...prev, hymn]);
      setShareMessage('تمت الإضافة بنجاح');
    }
    setTimeout(() => setShareMessage(null), 2000);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(hymns, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hymns-backup-${new Date().toISOString().split('T')[0]}.json`;
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
            setHymns(imported);
            setShareMessage('تم الاستيراد بنجاح (استبدال)');
          } else {
            // Merge
            const existingIds = new Set(hymns.map(h => h.id));
            const newHymns = imported.filter((h: Hymn) => !existingIds.has(h.id));
            setHymns(prev => [...prev, ...newHymns]);
            setShareMessage(`تم الاستيراد بنجاح (${newHymns.length} عنصر جديد)`);
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

  // Multi-select helper functions
  const toggleHymnSelection = (hymnId: number) => {
    setSelectedHymnIds(prev =>
      prev.includes(hymnId)
        ? prev.filter(id => id !== hymnId)
        : [...prev, hymnId]
    );
  };

  const selectAllHymns = () => {
    setSelectedHymnIds(filteredHymns.map(hymn => hymn.id));
  };

  const clearSelection = () => {
    setSelectedHymnIds([]);
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedHymnIds([]);
  };

  // Long press handlers for touch devices
  const handleTouchStart = (hymnId: number) => {
    longPressTimerRef.current = setTimeout(() => {
      // Activate selection mode and select this hymn
      if (!isSelectionMode) {
        setIsSelectionMode(true);
        setSelectedHymnIds([hymnId]);
      }
    }, 500); // 500ms long press duration
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchMove = () => {
    // Cancel long press if user moves their finger
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleBatchDownload = () => {
    // Download all file types for all selected hymns
    const selectedHymns = hymns.filter(hymn => selectedHymnIds.includes(hymn.id));
    console.log('Downloading files for hymns:', selectedHymns.map(h => h.title));
    
    // Show success message
    setShareMessage(`تم تحميل ${selectedHymnIds.length} ترنيمة`);
    setTimeout(() => setShareMessage(null), 3000);
    
    // Exit selection mode after download
    exitSelectionMode();
  };

  const handleBatchAddToFavorites = () => {
    // Check if user is authenticated
    if (!user || !profile) {
      setShowLoginModal(true);
      return;
    }

    // Add all selected hymns to favorites
    setFavoritedHymns(prev => {
      const newFavorites = [...prev];
      selectedHymnIds.forEach(id => {
        if (!newFavorites.includes(id)) {
          newFavorites.push(id);
        }
      });
      // Persist to localStorage
      localStorage.setItem('favoriteHymns', JSON.stringify(newFavorites));
      return newFavorites;
    });
    
    // Show success message
    setShareMessage(`تم إضافة ${selectedHymnIds.length} ترنيمة إلى المفضلة`);
    setTimeout(() => setShareMessage(null), 3000);
    
    // Exit selection mode
    exitSelectionMode();
  };

  // Share hymn
  const shareHymn = async (hymn: typeof hymns[0]) => {
    // Try native share API first (works on mobile and some modern browsers)
    if (navigator.share) {
      try {
        await navigator.share({
          title: hymn.title,
          text: `ترنيمة: ${hymn.title}`,
          url: window.location.href,
        });
        setShareMessage('تم مشاركة الترنيمة بنجاح');
        setTimeout(() => setShareMessage(null), 3000);
        return;
      } catch (err) {
        // User cancelled or share failed
        console.log('Share cancelled or failed:', err);
      }
    }
    
    // Fallback: Create a temporary textarea to copy text
    try {
      const shareText = `${hymn.title}\n${window.location.href}`;
      const textarea = document.createElement('textarea');
      textarea.value = shareText;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      
      setShareMessage('تم نسخ معلومات الترنيمة');
      setTimeout(() => setShareMessage(null), 3000);
    } catch (err) {
      console.log('Copy failed:', err);
      setShareMessage('فشل النسخ - الرجاء المحاولة مرة أخرى');
      setTimeout(() => setShareMessage(null), 3000);
    }
  };

  // Convert duration string to seconds for comparison
  const durationToSeconds = (duration: string) => {
    const [minutes, seconds] = duration.split(':').map(Number);
    return minutes * 60 + seconds;
  };

  // Filter and sort hymns
  const filteredHymns = useMemo(() => {
    let result = hymns.filter(hymn => {
      // Filter by search query - search in title and tags
      const matchesSearch = searchQuery === '' || 
        hymn.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        hymn.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      // Filter by tags
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(tag => hymn.tags.includes(tag));

      // Filter by file types
      const matchesFileTypes = selectedFileTypes.length === 0 || 
        selectedFileTypes.some(fileType => hymn.fileTypes.includes(fileType));

      // Filter by favorites
      const matchesFavorites = !showFavoritesOnly || favoritedHymns.includes(hymn.id);

      return matchesSearch && matchesTags && matchesFileTypes && matchesFavorites;
    });

    // Sort the results
    result.sort((a, b) => {
      switch (sortBy) {
        case 'alpha-asc':
          return a.title.localeCompare(b.title, 'ar');
        case 'alpha-desc':
          return b.title.localeCompare(a.title, 'ar');
        case 'length-asc':
          return durationToSeconds(a.duration) - durationToSeconds(b.duration);
        case 'length-desc':
          return durationToSeconds(b.duration) - durationToSeconds(a.duration);
        case 'date-asc':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        case 'date-desc':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        default:
          return 0;
      }
    });

    return result;
  }, [selectedTags, selectedFileTypes, searchQuery, sortBy, showFavoritesOnly, favoritedHymns]);

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
            marginBottom: scrollProgress < 1 ? `${(1 - scrollProgress) * 24}px` : '0px',
            transition: 'opacity 0.1s linear, transform 0.1s linear, max-height 0.1s linear, margin-bottom 0.1s linear',
            pointerEvents: scrollProgress > 0.5 ? 'none' : 'auto',
          }}
        >
          <div>
            <h1 className="mb-2 font-bold text-[36px]">مكتبة الترانيم</h1>
            <p className="text-muted-foreground">
              مكتبة شاملة تضم مئات الترانيم والألحان القبطية مع فيديوهات وعروض PowerPoint وملفات صوتية ونصوص. استخدم البحث والفلاتر للعثور على الترنيمة المطلوبة، وأضف المفضلات لديك، وحمّل الملفات للاستخدام في الخدمة والصلاة.
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
                  title="إضافة ترنيمة جديدة"
                >
                  <Plus className="w-4 h-4" />
                  <span>جديد</span>
                </button>
                <button
                  onClick={() => {
                    setBulkEditMode(!bulkEditMode);
                    setSelectedHymnIds([]);
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
        {isEditor && bulkEditMode && selectedHymnIds.length > 0 && (
          <div className="mt-4 p-3 bg-primary/10 border border-primary rounded-xl flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedHymnIds.length} عنصر محدد
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors"
              >
                <CheckCheck className="w-4 h-4" />
                {selectedHymnIds.length === filteredHymns.length ? 'إلغاء الكل' : 'تحديد الكل'}
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

            {/* Select Mode Button - Changes to Cancel when in selection mode */}
            <button
              onClick={() => isSelectionMode ? exitSelectionMode() : setIsSelectionMode(true)}
              className={`flex items-center justify-center gap-2 px-4 py-3 h-[50px] border rounded-xl transition-all whitespace-nowrap ${
                isSelectionMode 
                  ? 'bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/20' 
                  : 'bg-card border-border hover:bg-muted'
              }`}
            >
              {isSelectionMode ? (
                <>
                  <X className="w-5 h-5" />
                  <span className="hidden sm:inline">إلغاء</span>
                </>
              ) : (
                <>
                  <Check className="w-5 h-5" />
                  <span className="hidden sm:inline">تحديد</span>
                </>
              )}
            </button>

            {/* Sort Button - Icon only on mobile, beside search bar */}
            <div className="relative flex-shrink-0 sm:hidden" ref={sortDropdownRef}>
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="flex items-center justify-center w-[50px] h-[50px] bg-card border border-border rounded-xl hover:bg-muted transition-colors"
              >
                <ArrowUpDown className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Mobile Sort Panel - Slide up from bottom */}
          {isSortDropdownOpen && (
            <>
              {/* Backdrop */}
              <div 
                className="sm:hidden fixed inset-0 bg-black/50 z-[200] animate-in fade-in duration-200"
                onClick={() => setIsSortDropdownOpen(false)}
              />
              
              {/* Slide-up Panel */}
              <div className="sm:hidden fixed bottom-0 left-0 right-0 z-[201] bg-card rounded-t-xl shadow-2xl animate-in slide-in-from-bottom duration-300 pb-safe">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <h3 className="font-semibold text-lg">ترتيب حسب</h3>
                  <button
                    onClick={() => setIsSortDropdownOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Sort Options */}
                <div className="p-4 pb-8 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSortBy(option.value);
                          setIsSortDropdownOpen(false);
                        }}
                        className={`w-full text-right px-4 py-3.5 rounded-xl text-sm transition-colors ${
                          sortBy === option.value
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'hover:bg-muted'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Filters and Sort Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 -mt-2 sm:-mt-3.5">
            {/* Filters on the right */}
            <div className="relative flex items-center gap-3 w-full sm:w-auto" ref={filtersContainerRef}>
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

              {/* File Type Filter */}
              <div className="relative flex-1 sm:flex-initial sm:flex-shrink-0">
                <button
                  onClick={() => setIsFileTypeDropdownOpen(!isFileTypeDropdownOpen)}
                  className="flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] bg-card border border-border rounded-xl hover:bg-muted transition-colors relative w-full justify-center sm:justify-start"
                >
                  <FileAudio className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className="text-sm hidden md:inline">نوع الملف</span>
                  {selectedFileTypes.length > 0 && (
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFileTypes([]);
                      }}
                      className="absolute -top-2 -left-2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center cursor-pointer hover:bg-destructive transition-colors group"
                    >
                      <span className="group-hover:hidden">{selectedFileTypes.length}</span>
                      <X className="w-3.5 h-3.5 hidden group-hover:block" />
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 transition-transform ${isFileTypeDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Mobile: Slide-up Panel */}
                {isFileTypeDropdownOpen && (
                  <>
                    {/* Backdrop */}
                    <div 
                      className="sm:hidden fixed inset-0 bg-black/50 z-[200] animate-in fade-in duration-200"
                      onClick={() => setIsFileTypeDropdownOpen(false)}
                    />
                    
                    {/* Slide-up Panel */}
                    <div className="sm:hidden fixed bottom-0 left-0 right-0 z-[201] bg-card rounded-t-xl shadow-2xl animate-in slide-in-from-bottom duration-300 pb-safe">
                      {/* Header */}
                      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                        <h3 className="font-semibold text-lg">نوع الملف</h3>
                        <button
                          onClick={() => setIsFileTypeDropdownOpen(false)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>

                      {/* File Type Options */}
                      <div className="p-4 max-h-[60vh] overflow-y-auto">
                        <div className="space-y-2">
                          {allFileTypes.map((fileType) => {
                            const Icon = getFileTypeIcon(fileType);
                            return (
                              <button
                                key={fileType}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFileType(fileType);
                                }}
                                className={`w-full text-right px-4 py-3.5 rounded-xl transition-colors flex items-center gap-3 ${
                                  selectedFileTypes.includes(fileType)
                                    ? 'bg-primary text-primary-foreground font-medium'
                                    : 'hover:bg-muted'
                                }`}
                              >
                                <Icon className="w-5 h-5" />
                                <span>{getFileTypeLabel(fileType)}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Footer with Apply/Clear buttons */}
                      <div className="p-4 pb-8 border-t border-border space-y-2">
                        {selectedFileTypes.length > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFileTypes([]);
                            }}
                            className="w-full px-4 py-3 text-sm text-destructive hover:bg-destructive/10 rounded-xl transition-colors"
                          >
                            مسح جميع التحديدات
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsFileTypeDropdownOpen(false);
                          }}
                          className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all font-medium"
                        >
                          تطبيق
                        </button>
                      </div>
                    </div>

                    {/* Desktop: Dropdown aligned to button */}
                    <div className="hidden sm:block absolute right-0 top-full mt-2 w-56 bg-card border border-border rounded-xl shadow-lg z-[100]">
                      <div className="p-2">
                        {allFileTypes.map((fileType) => {
                          const Icon = getFileTypeIcon(fileType);
                          return (
                            <button
                              key={fileType}
                              onClick={() => toggleFileType(fileType)}
                              className={`w-full text-right px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                                selectedFileTypes.includes(fileType)
                                  ? 'bg-primary/10 text-primary'
                                  : 'hover:bg-muted'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                              <span>{getFileTypeLabel(fileType)}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Favorites Only Toggle - Only visible when user is logged in */}
              {user && profile && (
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] border rounded-xl transition-all relative whitespace-nowrap ${
                    showFavoritesOnly
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-card border-border hover:bg-muted'
                  }`}
                  title={showFavoritesOnly ? 'إظهار كل الترانيم' : 'عرض المفضلة فقط'}
                >
                  <Heart className={`w-4 h-4 flex-shrink-0 transition-all ${showFavoritesOnly ? 'fill-current' : ''}`} />
                  <span className="text-sm hidden lg:inline">المفضلة فقط</span>
                  {showFavoritesOnly && favoritedHymns.length > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-2 py-0.5">
                      {favoritedHymns.length}
                    </span>
                  )}
                </button>
              )}

              {/* Results Count Info Chip */}
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] bg-muted/50 border border-border/50 rounded-xl pointer-events-none">
                <Music className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">
                  {filteredHymns.length} / {hymns.length}
                </span>
              </div>
            </div>

           {/* Sort Dropdown on the left */}
            <div className="relative flex-shrink-0 order-1 sm:order-2 hidden sm:block" ref={sortDropdownRef}>
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl hover:bg-muted transition-colors text-sm w-full sm:w-auto justify-between"
              >
                <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                <span>{sortOptions.find(option => option.value === sortBy)?.label}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isSortDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown menu */}
              {isSortDropdownOpen && (
                <div className="absolute left-0 right-0 sm:left-0 sm:right-auto top-full mt-2 sm:w-56 bg-card border border-border rounded-xl shadow-lg z-[100]">
                  <div className="p-2">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={(e) => {
                          e.stopPropagation();
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
        <div className="space-y-3">
          {filteredHymns.length > 0 ? (
            filteredHymns.map((hymn) => (
              <div
                key={hymn.id}
                className="bg-card rounded-xl border border-border relative group/card hover:z-10"
              >
                {/* Collapsed State - Always Visible */}
                <div 
                  className={`p-4 hover:bg-muted transition-all cursor-pointer relative ${
                    (isSelectionMode || bulkEditMode) && selectedHymnIds.includes(hymn.id) 
                      ? 'bg-primary/5 border-2 border-primary' 
                      : ''
                  }`}
                  onClick={() => {
                    if (isSelectionMode || bulkEditMode) {
                      toggleHymnSelection(hymn.id);
                    } else {
                      setExpandedHymnId(expandedHymnId === hymn.id ? null : hymn.id);
                    }
                  }}
                  onTouchStart={() => handleTouchStart(hymn.id)}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={handleTouchMove}
                  style={{ borderRadius: expandedHymnId === hymn.id ? '0.75rem 0.75rem 0 0' : '0.75rem' }}
                >
                  {/* Selection Checkbox - Appears in selection mode on the right (RTL) */}
                  {(isSelectionMode || bulkEditMode) && (
                    <div 
                      className="absolute top-1/2 -translate-y-1/2 right-4 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHymnSelection(hymn.id);
                      }}
                    >
                      <div 
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer ${
                          selectedHymnIds.includes(hymn.id)
                            ? 'bg-primary border-primary'
                            : 'border-border bg-background hover:border-primary'
                        }`}
                      >
                        {selectedHymnIds.includes(hymn.id) && (
                          <Check className="w-4 h-4 text-primary-foreground" />
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4">
                    {/* Mobile Layout: Title + Icons */}
                    <div className={`flex md:hidden items-center justify-between w-full gap-3 ${(isSelectionMode || bulkEditMode) ? 'pr-8' : ''}`}>
                      {/* Title */}
                      <div className="flex-1 flex items-center" style={{ minHeight: '44px' }}>
                        <h3 
                          className="leading-tight font-bold"
                          style={{ 
                            fontSize: expandedHymnId === hymn.id ? '1.5rem' : '1.125rem',
                            transition: 'font-size 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            transformOrigin: 'top right'
                          }}
                        >
                          {hymn.title}
                        </h3>
                      </div>

                      {/* Mobile Action Buttons - Icons only on the left */}
                      {!isSelectionMode && !bulkEditMode && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Download All Button */}
                        <button 
                          className="flex items-center justify-center p-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log(`Downloading all files for ${hymn.title}`);
                          }}
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        {/* Favorite Button */}
                        <button
                          className={`flex items-center justify-center p-2.5 rounded-lg hover:opacity-90 transition-all ${
                            favoritedHymns.includes(hymn.id) ? 'bg-red-500 text-white' : 'bg-background/50 border border-border text-muted-foreground'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(hymn.id);
                          }}
                        >
                          <Heart className={`w-4 h-4 ${favoritedHymns.includes(hymn.id) ? 'fill-current' : ''}`} />
                        </button>

                        {/* Share Button */}
                        <button
                          className="flex items-center justify-center p-2.5 bg-background/50 border border-border rounded-lg text-muted-foreground hover:bg-primary/10 hover:border-primary hover:text-primary transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            shareHymn(hymn);
                          }}
                        >
                          <Share2 className="w-4 h-4" />
                        </button>

                        {/* Admin Edit Button (Mobile) */}
                        {isEditor && !bulkEditMode && (
                          <button
                            className="flex items-center justify-center p-2.5 bg-background/50 border border-border rounded-lg text-muted-foreground hover:bg-primary/10 hover:border-primary hover:text-primary transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(hymn);
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}

                        {/* Admin Delete Button (Mobile) */}
                        {isEditor && !bulkEditMode && (
                          <button
                            className="flex items-center justify-center p-2.5 bg-background/50 border border-border rounded-lg text-muted-foreground hover:bg-red-500/10 hover:border-red-500 hover:text-red-500 transition-all"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(hymn.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      )}
                    </div>

                    {/* Desktop Layout: Title + Spacer + File Types + Actions */}
                    <div className={`hidden md:flex items-center gap-4 w-full ${(isSelectionMode || bulkEditMode) ? 'pr-10' : ''}`}>
                      {/* Title */}
                      <div className="flex-shrink-0 min-w-[200px] flex items-center" style={{ minHeight: '44px' }}>
                        <h3 
                          className="leading-tight font-bold"
                          style={{ 
                            fontSize: expandedHymnId === hymn.id ? '1.5rem' : '1.125rem',
                            transition: 'font-size 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            transformOrigin: 'top right'
                          }}
                        >
                          {hymn.title}
                        </h3>
                      </div>

                      {/* Spacer to push file types to the left */}
                      <div className="flex-1"></div>
                    
                      {!isSelectionMode && !bulkEditMode && (
                        <>
                      {/* File Types as Download Buttons */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {hymn.fileTypes.map((fileType) => {
                          const Icon = getFileTypeIcon(fileType);
                          const label = getFileTypeLabel(fileType);
                          return (
                            <div key={fileType} className="relative group/tooltip">
                              <button
                                className="flex items-center justify-center p-3 bg-background/50 border border-border rounded-lg text-muted-foreground hover:bg-primary/10 hover:border-primary hover:text-primary transition-all w-11 h-11"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Download functionality would go here
                                  console.log(`Downloading ${fileType} for ${hymn.title}`);
                                }}
                              >
                                <Icon className="w-5 h-5" />
                              </button>
                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-popover text-popover-foreground text-sm rounded-lg shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                                تحميل {label}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-popover"></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Download All Button */}
                      <div className="relative group/tooltip flex-shrink-0">
                        <button 
                          className="flex items-center justify-center p-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all w-11 h-11"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Download all files functionality would go here
                            console.log(`Downloading all files for ${hymn.title}`);
                          }}
                        >
                          <Download className="w-5 h-5" />
                        </button>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-popover text-popover-foreground text-sm rounded-lg shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                          تحميل اكل
                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-popover"></div>
                        </div>
                      </div>

                      {/* Favorite Button */}
                      <div className="relative group/tooltip flex-shrink-0">
                        <button
                          className={`flex items-center justify-center p-3 rounded-lg hover:opacity-90 transition-all w-11 h-11 ${
                            favoritedHymns.includes(hymn.id) ? 'bg-red-500 text-white' : 'bg-background/50 border border-border text-muted-foreground'
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(hymn.id);
                          }}
                        >
                          <Heart className={`w-5 h-5 ${favoritedHymns.includes(hymn.id) ? 'fill-current' : ''}`} />
                        </button>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-popover text-popover-foreground text-sm rounded-lg shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                          {favoritedHymns.includes(hymn.id) ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-popover"></div>
                        </div>
                      </div>

                      {/* Share Button */}
                      <div className="relative group/tooltip flex-shrink-0">
                        <button
                          className="flex items-center justify-center p-3 bg-background/50 border border-border rounded-lg text-muted-foreground hover:bg-primary/10 hover:border-primary hover:text-primary transition-all w-11 h-11"
                          onClick={(e) => {
                            e.stopPropagation();
                            shareHymn(hymn);
                          }}
                        >
                          <Share2 className="w-5 h-5" />
                        </button>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-popover text-popover-foreground text-sm rounded-lg shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                          مشاركة
                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-popover"></div>
                        </div>
                      </div>

                      {/* Admin Edit Button */}
                      {isEditor && !bulkEditMode && (
                        <div className="relative group/tooltip flex-shrink-0">
                          <button
                            className="flex items-center justify-center p-3 bg-background/50 border border-border rounded-lg text-muted-foreground hover:bg-primary/10 hover:border-primary hover:text-primary transition-all w-11 h-11"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEdit(hymn);
                            }}
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-popover text-popover-foreground text-sm rounded-lg shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                            تعديل
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-popover"></div>
                          </div>
                        </div>
                      )}

                      {/* Admin Delete Button */}
                      {isEditor && !bulkEditMode && (
                        <div className="relative group/tooltip flex-shrink-0">
                          <button
                            className="flex items-center justify-center p-3 bg-background/50 border border-border rounded-lg text-muted-foreground hover:bg-red-500/10 hover:border-red-500 hover:text-red-500 transition-all w-11 h-11"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(hymn.id);
                            }}
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-popover text-popover-foreground text-sm rounded-lg shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                            حذف
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-popover"></div>
                          </div>
                        </div>
                      )}
                      </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded State */}
                <div 
                  className={`grid transition-all duration-500 ease-in-out ${
                    expandedHymnId === hymn.id 
                      ? 'grid-rows-[1fr] opacity-100' 
                      : 'grid-rows-[0fr] opacity-0'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="border-t border-border bg-muted/30 p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Right Column - Details */}
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-2">
                            {hymn.tags.map((tag) => (
                              <span key={tag} className="text-xs px-3 py-1 bg-primary/10 text-primary rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>

                          <div className="space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">المدة:</span>
                              <span>{hymn.duration}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">تاريخ الإنشاء:</span>
                              <span>{new Date(hymn.createdAt).toLocaleDateString('ar-EG')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold">آخر تحديث:</span>
                              <span>{new Date(hymn.updatedAt).toLocaleDateString('ar-EG')}</span>
                            </div>
                          </div>

                          {/* Lyrics Section */}
                          <div className="pt-2">
                            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">كلمات الترنيمة</h3>
                            <div className="bg-card/50 border border-border rounded-lg p-4 relative">
                              <div 
                                className="relative overflow-hidden transition-all duration-500 ease-in-out"
                                style={{
                                  maxHeight: expandedLyricsIds.includes(hymn.id) ? '2000px' : '103px',
                                }}
                              >
                                <p className="text-sm leading-relaxed whitespace-pre-line text-center">
                                  {hymn.lyrics}
                                </p>
                                {/* Fade gradient when collapsed */}
                                {!expandedLyricsIds.includes(hymn.id) && hymn.lyrics.split('\n').length > 4 && (
                                  <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card/50 via-card/50 to-transparent pointer-events-none"></div>
                                )}
                              </div>
                              
                              {/* Read more/less button - only show if text is long */}
                              {hymn.lyrics.split('\n').length > 4 && (
                                <button
                                  onClick={() => toggleLyricsExpansion(hymn.id)}
                                  className="mt-3 w-full text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                                >
                                  {expandedLyricsIds.includes(hymn.id) ? 'قراءة أقل' : 'قراءة المزيد'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Left Column - File Actions */}
                        <div className="space-y-4">
                          {/* File Type Actions */}
                          <div className="space-y-2">
                            {hymn.fileTypes.map((fileType) => {
                              const Icon = getFileTypeIcon(fileType);
                              const label = getFileTypeLabel(fileType);
                              const canPreview = fileType === 'Video montage' || fileType === 'Video PowerPoint' || fileType === 'Music' || fileType === 'PowerPoint file';
                              
                              return (
                                <div key={fileType} className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
                                  {/* Label with Icon */}
                                  <div className="flex items-center gap-2 flex-1">
                                    <Icon className="w-5 h-5 text-primary flex-shrink-0" />
                                    <span className="font-medium">{label}</span>
                                  </div>

                                  {/* View Button */}
                                  <button
                                    disabled={!canPreview}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                                      canPreview 
                                        ? 'bg-card border border-border hover:bg-primary/10 hover:border-primary' 
                                        : 'bg-muted/50 text-muted-foreground opacity-50 cursor-not-allowed border border-border/50'
                                    }`}
                                    onClick={() => {
                                      if (canPreview) {
                                        console.log(`Preview ${fileType} for ${hymn.title}`);
                                      }
                                    }}
                                  >
                                    <Eye className="w-4 h-4" />
                                    <span className="text-sm hidden min-[500px]:inline">معاينة</span>
                                  </button>

                                  {/* Download Button */}
                                  <button
                                    className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-primary/10 hover:border-primary transition-all"
                                    onClick={() => {
                                      console.log(`Downloading ${fileType} for ${hymn.title}`);
                                    }}
                                  >
                                    <Download className="w-4 h-4" />
                                    <span className="text-sm hidden min-[500px]:inline">تحميل</span>
                                  </button>
                                </div>
                              );
                            })}
                          </div>

                          {/* Download All */}
                          <button
                            className="w-full flex items-center justify-center gap-3 p-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all"
                            onClick={() => {
                              console.log(`Downloading all files for ${hymn.title}`);
                            }}
                          >
                            <Download className="w-5 h-5" />
                            <span>تحميل جميع الملفات</span>
                          </button>

                          {/* Action Buttons */}
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <button
                              className={`flex items-center justify-center gap-2 p-3 rounded-lg transition-all ${
                                favoritedHymns.includes(hymn.id) 
                                  ? 'bg-red-500 text-white hover:opacity-90' 
                                  : 'bg-card border border-border hover:bg-muted'
                              }`}
                              onClick={() => toggleFavorite(hymn.id)}
                            >
                              <Heart className={`w-4 h-4 ${favoritedHymns.includes(hymn.id) ? 'fill-current' : ''}`} />
                              <span className="text-sm">
                                {favoritedHymns.includes(hymn.id) ? 'المفضلة' : 'إضافة للمفضلة'}
                              </span>
                            </button>
                            
                            <button
                              className="flex items-center justify-center gap-2 p-3 bg-card border border-border rounded-lg hover:bg-muted transition-all"
                              onClick={() => shareHymn(hymn)}
                            >
                              <Share2 className="w-4 h-4" />
                              <span className="text-sm">مشاركة</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <p className="text-muted-foreground">لا توجد ترانيم مطابقة للبحث أو التصنيفات المحددة</p>
            </div>
          )}
        </div>
      </div>

      {/* Share Message */}
      {shareMessage && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-xl shadow-lg z-50 animate-fade-in">
          {shareMessage}
        </div>
      )}

      {/* Selection Mode Bottom Bar */}
      {isSelectionMode && (
        <div className={`fixed bottom-0 left-8 right-8 z-[100] bg-card border-t border-border shadow-2xl animate-in slide-in-from-bottom duration-300 pb-safe transition-all duration-300 ${
          isSidebarCollapsed ? 'lg:mr-20' : 'lg:mr-64'
        }`}>
          {/* Desktop Bar */}
          <div className="hidden sm:flex items-center justify-between gap-4 p-4">
            {/* Left Side - Counter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {selectedHymnIds.length} من {filteredHymns.length} محدد
              </span>
            </div>

            {/* Right Side - Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchDownload}
                disabled={selectedHymnIds.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                <span>تحميل ({selectedHymnIds.length})</span>
              </button>

              <button
                onClick={handleBatchAddToFavorites}
                disabled={selectedHymnIds.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-red-500 text-red-500 rounded-lg hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Heart className="w-4 h-4" />
                <span>مفضلة ({selectedHymnIds.length})</span>
              </button>

              <div className="w-px h-6 bg-border mx-2" />

              <button
                onClick={selectAllHymns}
                disabled={selectedHymnIds.length === filteredHymns.length}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <Check className="w-4 h-4" />
                <span>تحديد الكل</span>
              </button>

              <button
                onClick={clearSelection}
                disabled={selectedHymnIds.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                <X className="w-4 h-4" />
                <span>إلغاء التحديد</span>
              </button>

              <button
                onClick={exitSelectionMode}
                className="flex items-center gap-2 px-4 py-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg hover:bg-destructive/20 transition-all text-sm"
              >
                <X className="w-4 h-4" />
                <span>إلغاء</span>
              </button>
            </div>
          </div>

          {/* Mobile Bar */}
          <div className="sm:hidden">
            {/* Counter and Cancel on same row */}
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">
                {selectedHymnIds.length} من {filteredHymns.length} محدد
              </p>
              <button
                onClick={exitSelectionMode}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg hover:bg-destructive/20 transition-all text-sm"
              >
                <X className="w-4 h-4" />
                <span>إلغاء</span>
              </button>
            </div>

            {/* Actions */}
            <div className="p-4 space-y-2">
              {/* Select All / Clear Selection Row */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={selectAllHymns}
                  disabled={selectedHymnIds.length === filteredHymns.length}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-card border border-border rounded-xl hover:bg-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>تحديد الكل</span>
                </button>

                <button
                  onClick={clearSelection}
                  disabled={selectedHymnIds.length === 0}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-card border border-border rounded-xl hover:bg-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <X className="w-4 h-4" />
                  <span>إلغاء التحديد</span>
                </button>
              </div>

              {/* Download and Favorite side by side */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleBatchDownload}
                  disabled={selectedHymnIds.length === 0}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                >
                  <Download className="w-5 h-5" />
                  <span>تحميل ({selectedHymnIds.length})</span>
                </button>

                <button
                  onClick={handleBatchAddToFavorites}
                  disabled={selectedHymnIds.length === 0}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-card border border-red-500 text-red-500 rounded-xl hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                >
                  <Heart className="w-5 h-5" />
                  <span>مفضلة</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Login Required Modal */}
      <LoginRequiredModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginClick={() => {
          setShowLoginModal(false);
          window.dispatchEvent(new CustomEvent('openLoginModal'));
        }}
      />

      {/* Admin Edit Modal */}
      {isEditor && (
        <AdminEditHymnModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingHymn(null);
          }}
          onSave={handleSaveHymn}
          hymn={editingHymn}
        />
      )}

      {/* Video Tutorial Modal */}
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="شرح استخدام مكتبة الترانيم"
      />
    </div>
  );
}