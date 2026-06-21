import {
  Play,
  Download,
  ArrowUpDown,
  Search,
  ChevronDown,
  FileVideo,
  Presentation,
  FileAudio,
  FileText,
  Video,
  X,
  Tags,
  Heart,
  Share2,
  Eye,
  Check,
  Plus,
  Edit2,
  Trash2,
  Upload,
  CheckSquare,
  Square,
  CheckCheck,
  Music,
} from "lucide-react";
import { useState, useMemo, useRef, useEffect } from "react";
import { TagFilter } from "./TagFilter";
import { useAuth } from "../contexts/AuthContext";
import { LoginRequiredModal } from "./LoginRequiredModal";
import { useIsEditor } from "../utils/adminUtils";
import { normalizeArabic } from "../utils/arabicUtils";
import { AdminEditHymnModal } from "./AdminEditHymnModal";
import { VideoModal } from "./VideoModal";
import { useHymnsData } from "../hooks/useHymnsData";
import type {
  ContentId,
  Hymn,
  HymnFileType as FileType,
} from "../types/content";
import {
  createHymn,
  deleteHymn,
  updateHymn,
} from "../services/contentWriteService";

type SortOption =
  | "alpha-asc"
  | "alpha-desc"
  | "length-asc"
  | "length-desc"
  | "date-asc"
  | "date-desc";

const sortOptions = [
  { value: "alpha-asc" as SortOption, label: "أبجدياً (أ - ي)" },
  { value: "alpha-desc" as SortOption, label: "أبجدياً (ي - أ)" },
  { value: "length-asc" as SortOption, label: "الأقصر أولاً" },
  { value: "length-desc" as SortOption, label: "الأطول أولاً" },
  { value: "date-desc" as SortOption, label: "الأحدث أولاً" },
  { value: "date-asc" as SortOption, label: "الأقدم أولاً" },
];

const allFileTypes: FileType[] = [
  "Video montage",
  "Video PowerPoint",
  "PowerPoint file",
  "Music",
];

// Helper function to get icon for file type
const getFileTypeIcon = (fileType: FileType) => {
  switch (fileType) {
    case "Video montage":
      return Video;
    case "Video PowerPoint":
      return FileVideo;
    case "PowerPoint file":
      return Presentation;
    case "Music":
      return FileAudio;
  }
};

// Helper function to get Arabic label for file type
const getFileTypeLabel = (fileType: FileType) => {
  switch (fileType) {
    case "Video montage":
      return "فيديو مونتاج";
    case "Video PowerPoint":
      return "فيديو بوربوينت";
    case "PowerPoint file":
      return "بوربوينت";
    case "Music":
      return "موسيقى";
  }
};

type HymnFacet = "tags" | "fileTypes";

const sortArabic = (a: string, b: string) => a.localeCompare(b, "ar");

const uniqueSorted = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean))).sort(sortArabic);

const normalizeSearchText = (text: string) => normalizeArabic(text).toLowerCase();

function hymnMatchesSearch(hymn: Hymn, query: string) {
  if (!query) return true;
  const normalizedQuery = normalizeSearchText(query);
  return (
    normalizeSearchText(hymn.title).includes(normalizedQuery) ||
    hymn.tags.some((tag) => normalizeSearchText(tag).includes(normalizedQuery))
  );
}

function hymnMatchesTags(hymn: Hymn, selectedTags: string[]) {
  return (
    selectedTags.length === 0 ||
    selectedTags.some((tag) => hymn.tags.includes(tag))
  );
}

function hymnMatchesFileTypes(hymn: Hymn, selectedFileTypes: FileType[]) {
  return (
    selectedFileTypes.length === 0 ||
    selectedFileTypes.some((fileType) => hymn.fileTypes.includes(fileType))
  );
}

function hymnMatchesFavorites(
  hymn: Hymn,
  showFavoritesOnly: boolean,
  favoritedHymns: ContentId[],
) {
  return (
    !showFavoritesOnly ||
    favoritedHymns.some((f) => String(f) === String(hymn.id))
  );
}

function getHymnsForFacet(
  hymns: Hymn[],
  params: {
    searchQuery: string;
    selectedTags: string[];
    selectedFileTypes: FileType[];
    showFavoritesOnly: boolean;
    favoritedHymns: ContentId[];
    excludeFacet?: HymnFacet;
  },
) {
  const {
    searchQuery,
    selectedTags,
    selectedFileTypes,
    showFavoritesOnly,
    favoritedHymns,
    excludeFacet,
  } = params;

  return hymns.filter((hymn) => {
    if (!hymnMatchesSearch(hymn, searchQuery)) return false;
    if (excludeFacet !== "tags" && !hymnMatchesTags(hymn, selectedTags)) {
      return false;
    }
    if (
      excludeFacet !== "fileTypes" &&
      !hymnMatchesFileTypes(hymn, selectedFileTypes)
    ) {
      return false;
    }
    if (!hymnMatchesFavorites(hymn, showFavoritesOnly, favoritedHymns)) {
      return false;
    }
    return true;
  });
}

export function HymnsSection({
  isSidebarCollapsed,
}: {
  isSidebarCollapsed: boolean;
}) {
  const { user, profile, accessToken } = useAuth();
  const isEditor = useIsEditor();
  const { hymns, setHymns, loading: hymnsLoading } = useHymnsData();

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedFileTypes, setSelectedFileTypes] = useState<FileType[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("alpha-asc");
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [isFileTypeDropdownOpen, setIsFileTypeDropdownOpen] = useState(false);
  const [favoritedHymns, setFavoritedHymns] = useState<ContentId[]>([]);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [expandedHymnId, setExpandedHymnId] = useState<ContentId | null>(null);
  const [expandedLyricsIds, setExpandedLyricsIds] = useState<ContentId[]>([]);
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // 1. عداد التحكم في عدد الترانيم المعروضة حالياً
  const [visibleCount, setVisibleCount] = useState(25);

  // 2. تصفير العداد عند تغيير أي فلتر فعلي داخل الكومبوننت لتجنب الـ Bugs
  useEffect(() => {
    setVisibleCount(25);
  }, [searchQuery, selectedTags, selectedFileTypes, sortBy, showFavoritesOnly]);

  // Multi-select states
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedHymnIds, setSelectedHymnIds] = useState<ContentId[]>([]);

  // Admin states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingHymn, setEditingHymn] = useState<Hymn | null>(null);
  const [bulkEditMode, setBulkEditMode] = useState(false);

  // Video tutorial modal state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  // أضف هذه الأسطر للمعاينة
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewType, setPreviewType] = useState<FileType | null>(null);
  const handleOpenPreview = (url: string, type: FileType, title: string) => {
    setPreviewUrl(url);
    setPreviewType(type);
    setPreviewTitle(title);
    setIsPreviewOpen(true);
  };
  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const fileTypeDropdownRef = useRef<HTMLDivElement>(null);
  const filtersContainerRef = useRef<HTMLDivElement>(null!);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const hymnCardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  // Use browser-compatible timer type to avoid NodeJS namespace issues
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const scrollTop = scrollContainerRef.current.scrollTop;
        setIsScrolled(scrollTop > 20);
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll);
      handleScroll();
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", handleScroll);
      }
    };

    // شيلنا isLoading وسيبنا الـ Ref ومصفوفة الداتا بس
  }, [scrollContainerRef.current, hymns]);

  useEffect(() => {
    if (!expandedHymnId) return;

    const hymnsContainer = scrollContainerRef.current;
    const hymnElement = hymnCardRefs.current[String(expandedHymnId)];
    if (!hymnsContainer || !hymnElement) return;

    hymnElement.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
  }, [expandedHymnId]);

  // Get unique tags from hymns
  const allTags = useMemo(
    () => Array.from(new Set(hymns.flatMap((h) => h.tags))),
    [hymns],
  );

  // Favorites are kept in-memory only.

  // Close sort/file-type dropdown when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const isInsideSort =
        sortDropdownRef.current?.contains(target) ?? false;
      const isInsideFileType =
        fileTypeDropdownRef.current?.contains(target) ?? false;

      if (!isInsideSort && !isInsideFileType) {
        setIsSortDropdownOpen(false);
        setIsFileTypeDropdownOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSortDropdownOpen(false);
        setIsFileTypeDropdownOpen(false);
      }
    };

    if (isSortDropdownOpen || isFileTypeDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isSortDropdownOpen, isFileTypeDropdownOpen]);

  // Toggle file type selection
  const toggleFileType = (fileType: FileType) => {
    setSelectedFileTypes((prev) =>
      prev.includes(fileType)
        ? prev.filter((ft) => ft !== fileType)
        : [...prev, fileType],
    );
  };

  // Toggle favorite
  const toggleFavorite = (hymnId: ContentId) => {
    // Check if user is authenticated
    if (!user || !profile) {
      setShowLoginModal(true);
      return;
    }

    setFavoritedHymns((prev) => {
      const isIn = prev.some((id) => String(id) === String(hymnId));
      const next = isIn
        ? prev.filter((id) => String(id) !== String(hymnId))
        : [...prev, hymnId];
      return next;
    });
  };

  // Toggle lyrics expansion
  const toggleLyricsExpansion = (hymnId: ContentId) => {
    setExpandedLyricsIds((prev) =>
      prev.some((id) => String(id) === String(hymnId))
        ? prev.filter((id) => String(id) !== String(hymnId))
        : [...prev, hymnId],
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

  const handleDelete = async (id: ContentId) => {
    if (confirm("هل أنت متأكد من حذف هذه الترنيمة؟")) {
      if (typeof id !== "string") {
        setShareMessage("لا يمكن حذف عنصر غير متزامن مع الخادم");
        setTimeout(() => setShareMessage(null), 2000);
        return;
      }
      try {
        await deleteHymn(id, accessToken);
        setHymns((prev) => prev.filter((h) => h.id !== id));
        setShareMessage("تم الحذف بنجاح");
      } catch (error) {
        setShareMessage("فشل الحذف من الخادم");
      } finally {
        setTimeout(() => setShareMessage(null), 2000);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedHymnIds.length === 0) return;
    if (confirm(`هل أنت متأكد من حذف ${selectedHymnIds.length} ترنيمة؟`)) {
      const ids = selectedHymnIds.filter(
        (id): id is string => typeof id === "string",
      );
      await Promise.allSettled(ids.map((id) => deleteHymn(id, accessToken)));
      setHymns((prev) => prev.filter((h) => !ids.includes(String(h.id))));
      setSelectedHymnIds([]);
      setBulkEditMode(false);
      setShareMessage("تم الحذف بنجاح");
      setTimeout(() => setShareMessage(null), 2000);
    }
  };

  const handleSelectAll = () => {
    const allVisibleIds = filteredHymns.map((hymn) => hymn.id);
    if (selectedHymnIds.length === allVisibleIds.length) {
      // Deselect all
      setSelectedHymnIds([]);
    } else {
      // Select all
      setSelectedHymnIds(allVisibleIds);
    }
  };

  const handleSaveHymn = async (hymn: Hymn) => {
    try {
      if (editingHymn && typeof editingHymn.id === "string") {
        const updated = await updateHymn(editingHymn.id, hymn, accessToken);
        setHymns((prev) =>
          prev.map((h) => (h.id === updated.id ? updated : h)),
        );
        setShareMessage("تم التحديث بنجاح");
      } else {
        const created = await createHymn(hymn, accessToken);
        setHymns((prev) => [...prev, created]);
        setShareMessage("تمت الإضافة بنجاح");
      }
    } catch {
      setShareMessage("فشل الحفظ على الخادم");
    } finally {
      setTimeout(() => setShareMessage(null), 2000);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(hymns, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `hymns-backup-${new Date().toISOString().split("T")[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setShareMessage("تم التصدير بنجاح");
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
          if (
            confirm(
              "هل تريد استبدال البيانات الحالية أم دمجها؟\n\nاضغط OK للاستبدال، أو Cancel للدمج",
            )
          ) {
            // Replace
            setHymns(imported);
            setShareMessage("تم الاستيراد بنجاح (استبدال)");
          } else {
            // Merge
            const existingIds = new Set(hymns.map((h) => h.id));
            const newHymns = imported.filter(
              (h: Hymn) => !existingIds.has(h.id),
            );
            setHymns((prev) => [...prev, ...newHymns]);
            setShareMessage(
              `تم الاستيراد بنجاح (${newHymns.length} عنصر جديد)`,
            );
          }
          setTimeout(() => setShareMessage(null), 2000);
        } else {
          alert("ملف غير صالح. يجب أن يحتوي على مصفوفة JSON.");
        }
      } catch (error) {
        alert("خطأ في قراءة الملف");
      }
    };
    reader.readAsText(file);

    // Reset input
    event.target.value = "";
  };

  // Multi-select helper functions
  const toggleHymnSelection = (hymnId: ContentId) => {
    setSelectedHymnIds((prev) =>
      prev.some((id) => String(id) === String(hymnId))
        ? prev.filter((id) => String(id) !== String(hymnId))
        : [...prev, hymnId],
    );
  };

  const selectAllHymns = () => {
    setSelectedHymnIds(filteredHymns.map((hymn) => hymn.id));
  };

  const clearSelection = () => {
    setSelectedHymnIds([]);
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedHymnIds([]);
  };

  // Long press handlers for touch devices
  const handleTouchStart = (hymnId: ContentId) => {
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
    const selectedHymns = hymns.filter((hymn) =>
      selectedHymnIds.some((id) => String(id) === String(hymn.id)),
    );
    console.log(
      "Downloading files for hymns:",
      selectedHymns.map((h) => h.title),
    );

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
    setFavoritedHymns((prev) => {
      const newFavorites = [...prev];
      selectedHymnIds.forEach((id) => {
        if (!newFavorites.some((x) => String(x) === String(id))) {
          newFavorites.push(id);
        }
      });
      return newFavorites;
    });

    // Show success message
    setShareMessage(`تم إضافة ${selectedHymnIds.length} ترنيمة إلى المفضلة`);
    setTimeout(() => setShareMessage(null), 3000);

    // Exit selection mode
    exitSelectionMode();
  };

  // Share hymn
  const shareHymn = async (hymn: (typeof hymns)[0]) => {
    // Try native share API first (works on mobile and some modern browsers)
    if (navigator.share) {
      try {
        await navigator.share({
          title: hymn.title,
          text: `ترنيمة: ${hymn.title}`,
          url: window.location.href,
        });
        setShareMessage("تم مشاركة الترنيمة بنجاح");
        setTimeout(() => setShareMessage(null), 3000);
        return;
      } catch (err) {
        // User cancelled or share failed
        console.log("Share cancelled or failed:", err);
      }
    }

    // Fallback: Create a temporary textarea to copy text
    try {
      const shareText = `${hymn.title}\n${window.location.href}`;
      const textarea = document.createElement("textarea");
      textarea.value = shareText;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);

      setShareMessage("تم نسخ معلومات الترنيمة");
      setTimeout(() => setShareMessage(null), 3000);
    } catch (err) {
      console.log("Copy failed:", err);
      setShareMessage("فشل النسخ - الرجاء المحاولة مرة أخرى");
      setTimeout(() => setShareMessage(null), 3000);
    }
  };

  // Convert duration string to seconds for comparison
  const durationToSeconds = (duration: string) => {
    const [minutes, seconds] = duration.split(":").map(Number);
    return minutes * 60 + seconds;
  };

  // Filter and sort hymns
  const filteredHymns = useMemo(() => {
    let result = hymns.filter((hymn) => {
      // Filter by search query - search in title and tags
      const matchesSearch =
        searchQuery === "" || hymnMatchesSearch(hymn, searchQuery);

      // Filter by tags
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((tag) => hymn.tags.includes(tag));

      // Filter by file types
      const matchesFileTypes =
        selectedFileTypes.length === 0 ||
        selectedFileTypes.some((fileType) => hymn.fileTypes.includes(fileType));

      // Filter by favorites
      const matchesFavorites =
        !showFavoritesOnly ||
        favoritedHymns.some((f) => String(f) === String(hymn.id));

      return (
        matchesSearch && matchesTags && matchesFileTypes && matchesFavorites
      );
    });

    // Sort the results
    result.sort((a, b) => {
      switch (sortBy) {
        case "alpha-asc":
          return a.title.localeCompare(b.title, "ar");
        case "alpha-desc":
          return b.title.localeCompare(a.title, "ar");
        case "length-asc":
          return durationToSeconds(a.duration) - durationToSeconds(b.duration);
        case "length-desc":
          return durationToSeconds(b.duration) - durationToSeconds(a.duration);
        case "date-asc":
          return (
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
          );
        case "date-desc":
          return (
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );
        default:
          return 0;
      }
    });

    return result;
  }, [
    hymns,
    selectedTags,
    selectedFileTypes,
    searchQuery,
    sortBy,
    showFavoritesOnly,
    favoritedHymns,
  ]);

  const availableHymnsForTags = useMemo(
    () =>
      getHymnsForFacet(hymns, {
        searchQuery,
        selectedTags,
        selectedFileTypes,
        showFavoritesOnly,
        favoritedHymns,
        excludeFacet: "tags",
      }),
    [
      hymns,
      searchQuery,
      selectedTags,
      selectedFileTypes,
      showFavoritesOnly,
      favoritedHymns,
    ],
  );

  const availableHymnsForFileTypes = useMemo(
    () =>
      getHymnsForFacet(hymns, {
        searchQuery,
        selectedTags,
        selectedFileTypes,
        showFavoritesOnly,
        favoritedHymns,
        excludeFacet: "fileTypes",
      }),
    [
      hymns,
      searchQuery,
      selectedTags,
      selectedFileTypes,
      showFavoritesOnly,
      favoritedHymns,
    ],
  );

  const availableTagNames = useMemo(
    () => uniqueSorted(availableHymnsForTags.flatMap((hymn) => hymn.tags)),
    [availableHymnsForTags],
  );

  const availableFileTypeNames = useMemo(
    () =>
      uniqueSorted(
        availableHymnsForFileTypes.flatMap((hymn) => hymn.fileTypes),
      ),
    [availableHymnsForFileTypes],
  );

  const availableFileTypeSet = useMemo(
    () => new Set(availableFileTypeNames),
    [availableFileTypeNames],
  );

  const visibleFileTypes = useMemo(
    () =>
      allFileTypes.filter(
        (fileType) =>
          availableFileTypeSet.has(fileType) ||
          selectedFileTypes.includes(fileType),
      ),
    [availableFileTypeSet, selectedFileTypes],
  );

  const displayedHymns = useMemo(() => {
    return filteredHymns.slice(0, visibleCount);
  }, [filteredHymns, visibleCount]);

  if (hymnsLoading && hymns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-2 text-muted-foreground">
        <p>جاري تحميل الترانيم...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header Section */}
      <div className="sticky top-0 bg-background z-40 pb-3 sm:pb-4 border-b border-border/50">
        <div
          className={`transition-all duration-500 ease-in-out overflow-hidden ${
            isScrolled
              ? "max-h-0 opacity-0 mb-0 pointer-events-none transform -translate-y-2"
              : "max-h-[250px] opacity-100 mb-4 transform translate-y-0"
          }`}
        >
          <div>
            <h1 className="mb-2 font-bold text-[36px]">مكتبة الترانيم</h1>
            <p className="text-muted-foreground leading-relaxed">
              مكتبة شاملة تضم مئات الترانيم والألحان القبطية مع فيديوهات وعروض
              PowerPoint وملفات صوتية ونصوص. استخدم البحث والفلاتر للعثور على
              الترنيمة المطلوبة، وأضف المفضلات لديك، وحمّل الملفات للاستخدام في
              الخدمة والصلاة.
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
                <span className="text-sm font-medium text-primary">
                  أدوات التحرير:
                </span>
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
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border hover:bg-muted"
                  }`}
                  title="تحديد متعدد"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>{bulkEditMode ? "إلغاء" : "تحديد"}</span>
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
                {selectedHymnIds.length === filteredHymns.length
                  ? "إلغاء الكل"
                  : "تحديد الكل"}
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
              onClick={() =>
                isSelectionMode ? exitSelectionMode() : setIsSelectionMode(true)
              }
              className={`flex items-center justify-center gap-2 px-4 py-3 h-[50px] border rounded-xl transition-all whitespace-nowrap ${
                isSelectionMode
                  ? "bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/20"
                  : "bg-card border-border hover:bg-muted"
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
            <div
              className="relative flex-shrink-0 sm:hidden"
              ref={sortDropdownRef}
            >
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
                            ? "bg-primary text-primary-foreground font-medium"
                            : "hover:bg-muted"
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
            <div
              className="relative flex items-center gap-3 w-full sm:w-auto"
              ref={filtersContainerRef}
            >
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

              {/* File Type Filter */}
              <div className="relative flex-1 sm:flex-initial sm:flex-shrink-0">
                <button
                  onClick={() =>
                    setIsFileTypeDropdownOpen(!isFileTypeDropdownOpen)
                  }
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
                      <span className="group-hover:hidden">
                        {selectedFileTypes.length}
                      </span>
                      <X className="w-3.5 h-3.5 hidden group-hover:block" />
                    </span>
                  )}
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${isFileTypeDropdownOpen ? "rotate-180" : ""}`}
                  />
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
                        {visibleFileTypes.length > 0 ? (
                          <div className="space-y-2">
                            {visibleFileTypes.map((fileType) => {
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
                                      ? "bg-primary text-primary-foreground font-medium"
                                      : "hover:bg-muted"
                                  }`}
                                >
                                  <Icon className="w-5 h-5" />
                                  <span>{getFileTypeLabel(fileType)}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            لا توجد خيارات متاحة
                          </div>
                        )}
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
                        {visibleFileTypes.length > 0 ? (
                          visibleFileTypes.map((fileType) => {
                            const Icon = getFileTypeIcon(fileType);
                            return (
                              <button
                                key={fileType}
                                onClick={() => toggleFileType(fileType)}
                                className={`w-full text-right px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                                  selectedFileTypes.includes(fileType)
                                    ? "bg-primary/10 text-primary"
                                    : "hover:bg-muted"
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                                <span>{getFileTypeLabel(fileType)}</span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="text-center py-6 text-sm text-muted-foreground">
                            لا توجد خيارات متاحة
                          </div>
                        )}
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
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-card border-border hover:bg-muted"
                  }`}
                  title={
                    showFavoritesOnly ? "إظهار كل الترانيم" : "عرض المفضلة فقط"
                  }
                >
                  <Heart
                    className={`w-4 h-4 flex-shrink-0 transition-all ${showFavoritesOnly ? "fill-current" : ""}`}
                  />
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
            <div
              className="relative flex-shrink-0 order-1 sm:order-2 hidden sm:block"
              ref={sortDropdownRef}
            >
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="flex items-center gap-2 px-4 py-2.5 bg-card border border-border rounded-xl hover:bg-muted transition-colors text-sm w-full sm:w-auto justify-between"
              >
                <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                <span>
                  {sortOptions.find((option) => option.value === sortBy)?.label}
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${isSortDropdownOpen ? "rotate-180" : ""}`}
                />
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
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted"
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
                ref={(element) => {
                  if (element) {
                    hymnCardRefs.current[String(hymn.id)] = element;
                  } else {
                    delete hymnCardRefs.current[String(hymn.id)];
                  }
                }}
                className="bg-card rounded-xl border border-border relative group/card hover:z-10"
              >
                {/* Collapsed State - Always Visible */}
                <div
                  className={`p-4 hover:bg-muted transition-all cursor-pointer relative ${
                    (isSelectionMode || bulkEditMode) &&
                    selectedHymnIds.some((x) => String(x) === String(hymn.id))
                      ? "bg-primary/5 border-2 border-primary"
                      : ""
                  }`}
                  onClick={() => {
                    if (isSelectionMode || bulkEditMode) {
                      toggleHymnSelection(hymn.id);
                    } else {
                      setExpandedHymnId(
                        expandedHymnId === hymn.id ? null : hymn.id,
                      );
                    }
                  }}
                  onTouchStart={() => handleTouchStart(hymn.id)}
                  onTouchEnd={handleTouchEnd}
                  onTouchMove={handleTouchMove}
                  style={{
                    borderRadius:
                      expandedHymnId === hymn.id
                        ? "0.75rem 0.75rem 0 0"
                        : "0.75rem",
                  }}
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
                          selectedHymnIds.some(
                            (x) => String(x) === String(hymn.id),
                          )
                            ? "bg-primary border-primary"
                            : "border-border bg-background hover:border-primary"
                        }`}
                      >
                        {selectedHymnIds.some(
                          (x) => String(x) === String(hymn.id),
                        ) && (
                          <Check className="w-4 h-4 text-primary-foreground" />
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4">
                    {/* Mobile Layout: Title + Icons */}
                    <div
                      className={`flex md:hidden items-center justify-between w-full gap-3 ${isSelectionMode || bulkEditMode ? "pr-8" : ""}`}
                    >
                      {/* Title */}
                      <div
                        className="flex-1 flex items-center"
                        style={{ minHeight: "44px" }}
                      >
                        <h3
                          className="leading-tight font-bold"
                          style={{
                            fontSize:
                              expandedHymnId === hymn.id
                                ? "1.5rem"
                                : "1.125rem",
                            transition:
                              "font-size 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                            transformOrigin: "top right",
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
                              console.log(
                                `Downloading all files for ${hymn.title}`,
                              );
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          {/* Favorite Button */}
                          <button
                            className={`flex items-center justify-center p-2.5 rounded-lg hover:opacity-90 transition-all ${
                              favoritedHymns.some(
                                (f) => String(f) === String(hymn.id),
                              )
                                ? "bg-red-500 text-white"
                                : "bg-background/50 border border-border text-muted-foreground"
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(hymn.id);
                            }}
                          >
                            <Heart
                              className={`w-4 h-4 ${favoritedHymns.some((f) => String(f) === String(hymn.id)) ? "fill-current" : ""}`}
                            />
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
                    <div
                      className={`hidden md:flex items-center gap-4 w-full ${isSelectionMode || bulkEditMode ? "pr-10" : ""}`}
                    >
                      {/* Title */}
                      <div
                        className="flex-shrink-0 min-w-[200px] flex items-center"
                        style={{ minHeight: "44px" }}
                      >
                        <h3
                          className="leading-tight font-bold"
                          style={{
                            fontSize:
                              expandedHymnId === hymn.id
                                ? "1.5rem"
                                : "1.125rem",
                            transition:
                              "font-size 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                            transformOrigin: "top right",
                          }}
                        >
                          {hymn.title}
                        </h3>
                      </div>

                      {/* Spacer to push file types to the left */}
                      <div className="flex-1"></div>

                      {!isSelectionMode && !bulkEditMode && (
                        <>
                          {/* File Types as Download/Preview Buttons */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {hymn.fileTypes.map((fileType) => {
                              const Icon = getFileTypeIcon(fileType);
                              const label = getFileTypeLabel(fileType);

                              // جلب كائن الملف والـ URL الخاص به ديناميكياً بناءً على النوع
                              const fileObj = hymn.files?.find(
                                (f) => f.type === fileType,
                              );
                              const fileUrl = fileObj ? fileObj.url : "";

                              return (
                                <div
                                  key={fileType}
                                  className="relative group/tooltip"
                                >
                                  <a
                                    href={fileUrl}
                                    download={
                                      fileType === "Music"
                                        ? `${hymn.title || "ترنيمة"}.mp3`
                                        : fileType === "PowerPoint file"
                                          ? `${hymn.title || "بوربوينت"}.pptx`
                                          : `${hymn.title || "فيديو"}.mp4`
                                    }
                                    className="flex items-center justify-center p-3 bg-background/50 border border-border rounded-lg text-muted-foreground hover:bg-primary/10 hover:border-primary hover:text-primary transition-all w-11 h-11"
                                    onClick={(e) => {
                                      // لو الملف فيديو أو بوربوينت يفتح المعاينة، الموسيقى تنزل علطول
                                      if (fileType !== "Music") {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleOpenPreview(
                                          fileUrl,
                                          fileType,
                                          hymn.title,
                                        );
                                      } else {
                                        e.stopPropagation();
                                      }
                                    }}
                                  >
                                    <Icon className="w-5 h-5" />
                                  </a>
                                  {/* Tooltip */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-popover text-popover-foreground text-sm rounded-lg shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                                    {fileType === "Music"
                                      ? "تحميل"
                                      : "معاينة وتحميل"}{" "}
                                    {label}
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

                                // المرور على كافة الملفات المتاحة للترنيمة وتحميلها تلقائياً
                                hymn.files?.forEach((file) => {
                                  if (file.url) {
                                    const link = document.createElement("a");
                                    link.href = file.url;
                                    const ext =
                                      file.type === "Music"
                                        ? "mp3"
                                        : file.type === "PowerPoint file"
                                          ? "pptx"
                                          : "mp4";
                                    link.download = `${hymn.title || "ملف"}.${ext}`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  }
                                });
                              }}
                            >
                              <Download className="w-5 h-5" />
                            </button>
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-popover text-popover-foreground text-sm rounded-lg shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                              تحميل الكل
                              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-popover"></div>
                            </div>
                          </div>

                          {/* Favorite Button */}
                          <div className="relative group/tooltip flex-shrink-0">
                            <button
                              className={`flex items-center justify-center p-3 rounded-lg hover:opacity-90 transition-all w-11 h-11 ${
                                favoritedHymns.some(
                                  (f) => String(f) === String(hymn.id),
                                )
                                  ? "bg-red-500 text-white"
                                  : "bg-background/50 border border-border text-muted-foreground"
                              }`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(hymn.id);
                              }}
                            >
                              <Heart
                                className={`w-5 h-5 ${favoritedHymns.some((f) => String(f) === String(hymn.id)) ? "fill-current" : ""}`}
                              />
                            </button>
                            {/* Tooltip */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-popover text-popover-foreground text-sm rounded-lg shadow-lg opacity-0 group-hover/tooltip:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-10">
                              {favoritedHymns.some(
                                (f) => String(f) === String(hymn.id),
                              )
                                ? "إزالة من المفضلة"
                                : "إضافة إلى المفضلة"}
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
                  className="overflow-hidden transition-all duration-500 ease-in-out"
                  style={{
                    maxHeight: expandedHymnId === hymn.id ? '9999px' : '0',
                    opacity: expandedHymnId === hymn.id ? 1 : 0,
                  }}
                >
                  <div>
                    <div className="border-t border-border bg-muted/30 p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Right Column - Details */}
                        <div className="space-y-4">
                          <div className="flex flex-wrap gap-2">
                            {hymn.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs px-3 py-1 bg-primary/10 text-primary rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>

                          {/* Lyrics Section */}
                          <div className="pt-2">
                            <h3 className="text-sm font-semibold mb-2 text-muted-foreground">
                              كلمات الترنيمة
                            </h3>
                            <div className="bg-card/50 border border-border rounded-lg p-4 relative">
                              <div
                                className="relative overflow-hidden transition-all duration-500 ease-in-out"
                                style={{
                                  maxHeight: expandedLyricsIds.some(
                                    (x) => String(x) === String(hymn.id),
                                  )
                                    ? "260px"
                                    : "103px",
                                }}
                              >
                                <div
                                  className="overflow-y-auto pr-1"
                                  style={{
                                    height: expandedLyricsIds.some(
                                      (x) => String(x) === String(hymn.id),
                                    )
                                      ? "260px"
                                      : "103px",
                                  }}
                                >
                                  <p className="text-sm leading-relaxed whitespace-pre-line text-center">
                                    {hymn.lyrics}
                                  </p>
                                </div>
                                {!expandedLyricsIds.some(
                                  (x) => String(x) === String(hymn.id),
                                ) &&
                                  hymn.lyrics.split("\n").length > 4 && (
                                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card/50 via-card/50 to-transparent pointer-events-none"></div>
                                  )}
                              </div>

                              {hymn.lyrics.split("\n").length > 4 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleLyricsExpansion(hymn.id);
                                  }}
                                  className="mt-3 w-full text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                                >
                                  {expandedLyricsIds.some(
                                    (x) => String(x) === String(hymn.id),
                                  )
                                    ? "قراءة أقل"
                                    : "قراءة المزيد"}
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm text-muted-foreground">
                            <div className="rounded-lg bg-muted/20 p-3">
                              <div className="text-xs font-semibold text-muted-foreground/80">
                                المدة
                              </div>
                              <div className="mt-1 font-medium">{hymn.duration}</div>
                            </div>
                            <div className="rounded-lg bg-muted/20 p-3">
                              <div className="text-xs font-semibold text-muted-foreground/80">
                                تاريخ الإنشاء
                              </div>
                              <div className="mt-1 font-medium">
                                {new Date(hymn.createdAt).toLocaleDateString(
                                  "ar-EG",
                                )}
                              </div>
                            </div>
                            <div className="rounded-lg bg-muted/20 p-3">
                              <div className="text-xs font-semibold text-muted-foreground/80">
                                آخر تحديث
                              </div>
                              <div className="mt-1 font-medium">
                                {new Date(hymn.updatedAt).toLocaleDateString(
                                  "ar-EG",
                                )}
                              </div>
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
                              const canPreview =
                                fileType === "Video montage" ||
                                fileType === "Video PowerPoint" ||
                                fileType === "Music" ||
                                fileType === "PowerPoint file";

                              //  العثور على الملف الفعلي المرفوع من الداتابيز اللي نوعه يطابق هذا الزر
                              const actualFile = hymn.files?.find(
                                (f) => f.type === fileType,
                              );
                              // لو ملقتش ملف حقيقي، بنعمل Fallback على بورت السيرفر اللوكل أو مسار افتراضي عشان الداتا التجريبية تشغل معاك علطول
                              const fileUrl =
                                actualFile?.url ||
                                `http://localhost:8080/uploads/${hymn.id}_${fileType}`;

                              return (
                                <div
                                  key={fileType}
                                  className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg"
                                >
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
                                        ? "bg-card border border-border hover:bg-primary/10 hover:border-primary"
                                        : "bg-muted/50 text-muted-foreground opacity-50 cursor-not-allowed border border-border/50"
                                    }`}
                                    onClick={() => {
                                      if (canPreview) {
                                        // 🚀 تشغيل المعاينة المباشرة لايف على الموقع
                                        setPreviewUrl(fileUrl);
                                        setPreviewTitle(
                                          `${label} - ${hymn.title}`,
                                        );
                                        setPreviewType(fileType);
                                        setIsPreviewOpen(true);
                                      }
                                    }}
                                  >
                                    <Eye className="w-4 h-4" />
                                    <span className="text-sm hidden min-[500px]:inline">
                                      معاينة
                                    </span>
                                  </button>

                                  {/* Download Button */}
                                  <a
                                    href={fileUrl}
                                    download={`${label} - ${hymn.title}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-primary/10 hover:border-primary transition-all text-foreground"
                                  >
                                    <Download className="w-4 h-4" />
                                    <span className="text-sm hidden min-[500px]:inline">
                                      تحميل
                                    </span>
                                  </a>
                                </div>
                              );
                            })}
                          </div>

                          {/* Download All */}
                          <button
                            className="w-full flex items-center justify-center gap-3 p-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all"
                            onClick={() => {
                              console.log(
                                `Downloading all files for ${hymn.title}`,
                              );
                              // كود ذكي لتحميل كل الملفات المتاحة للترنيمة دي ورا بعض
                              hymn.files?.forEach((file, index) => {
                                setTimeout(() => {
                                  const link = document.createElement("a");
                                  link.href = file.url;
                                  link.download = `${getFileTypeLabel(file.type)} - ${hymn.title}`;
                                  document.body.appendChild(link);
                                  link.click();
                                  document.body.removeChild(link);
                                }, index * 300); // تأخير بسيط بين كل ملف عشان المتصفح ميعملش Block للتحميل المتعدد
                              });
                            }}
                          >
                            <Download className="w-5 h-5" />
                            <span>تحميل جميع الملفات</span>
                          </button>

                          {/* Action Buttons */}
                          <div className="grid grid-cols-2 gap-2 pt-2">
                            <button
                              className={`flex items-center justify-center gap-2 p-3 rounded-lg transition-all ${
                                favoritedHymns.some(
                                  (f) => String(f) === String(hymn.id),
                                )
                                  ? "bg-red-500 text-white hover:opacity-90"
                                  : "bg-card border border-border hover:bg-muted"
                              }`}
                              onClick={() => toggleFavorite(hymn.id)}
                            >
                              <Heart
                                className={`w-4 h-4 ${favoritedHymns.some((f) => String(f) === String(hymn.id)) ? "fill-current" : ""}`}
                              />
                              <span className="text-sm">
                                {favoritedHymns.some(
                                  (f) => String(f) === String(hymn.id),
                                )
                                  ? "المفضلة"
                                  : "إضافة للمفضلة"}
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

                          {/* ----------------------------------------------------------------------------- */}
                          {/* 🖥️ شاشة المعاينة المنبثقة التفاعلية (Inline Preview Modal Modal) */}
                          {/* ----------------------------------------------------------------------------- */}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <p className="text-muted-foreground">
                لا توجد ترانيم مطابقة للبحث أو التصنيفات المحددة
              </p>
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
        <div
          className={`fixed bottom-0 left-8 right-8 lg:right-[18rem] z-[100] bg-card border border-border rounded-t-xl shadow-2xl animate-in slide-in-from-bottom duration-300 pb-safe transition-all ${
            isSidebarCollapsed ? "lg:right-[7rem]" : "lg:right-[18rem]"
          }`}
        >
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
          window.dispatchEvent(new CustomEvent("openLoginModal"));
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
      {/* مودال معاينة الملفات لايف على الموقع قبل التحميل */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/80 z-[250] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl w-full max-w-3xl overflow-hidden shadow-2xl relative">
            {/* الهيدر */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
              <h3 className="font-bold text-lg text-right flex-1">
                {previewTitle}
              </h3>
              <button
                onClick={() => {
                  setIsPreviewOpen(false);
                  setPreviewUrl("");
                  setPreviewType(null);
                }}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-muted hover:bg-destructive hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* منطقة العرض (المعاينة الحية) */}
            <div className="p-6 flex flex-col items-center justify-center min-h-[200px] bg-background/50">
              {/* 1. لو نوع الملف موسيقى / صوت ترنيمة */}
              {previewType === "Music" && (
                <div className="w-full py-6 text-center space-y-4">
                  <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto animate-pulse">
                    <FileAudio className="w-8 h-8" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    مشغل الصوت المدمج
                  </p>
                  <audio
                    controls
                    src={previewUrl}
                    className="w-full accent-primary mt-2"
                    autoPlay
                  />
                </div>
              )}

              {/* 2. لو نوع الملف فيديو مونتاج أو فيديو بوربوينت */}
              {(previewType === "Video montage" ||
                previewType === "Video PowerPoint") && (
                <div className="w-full aspect-video rounded-lg overflow-hidden bg-black">
                  <video
                    controls
                    src={previewUrl}
                    className="w-full h-full"
                    autoPlay
                  />
                </div>
              )}

              {/* 3. لو نوع الملف بوربوينت عادي (PPTX) - المعاينة السحرية */}
              {previewType === "PowerPoint file" && (
                <div className="w-full h-[450px] rounded-lg overflow-hidden border border-border bg-black">
                  <iframe
                    src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(previewUrl)}`}
                    className="w-full h-full border-0"
                    allowFullScreen
                    title="PowerPoint Preview"
                  />
                </div>
              )}
            </div>

            {/* الفوتر - زرار التحميل المباشر بعد المعاينة */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/10">
              <a
                href={previewUrl}
                /*  التعديل السحري هنا:
      بنمرر اسم الترنيمة الفعلي جوه الـ download وبنحدد الامتداد بناءً على الـ previewType
    */
                download={
                  previewType === "Music"
                    ? `${previewTitle || "ترنيمة"}.mp3`
                    : previewType === "PowerPoint file"
                      ? `${previewTitle || "بوربوينت"}.pptx`
                      : `${previewTitle || "فيديو"}.mp4`
                }
                className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all font-medium text-sm"
                onClick={() => setIsPreviewOpen(false)}
              >
                <Download className="w-4 h-4" />
                <span>تحميل الملف الآن</span>
              </a>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2.5 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-all text-sm"
              >
                إغلاق المعاينة
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
