import {
  Download,
  Eye,
  ArrowUpDown,
  Search,
  ChevronDown,
  X,
  ChevronLeft,
  ChevronRight,
  Heart,
  Sparkles,
  Tags,
  User,
  Image as ImageIcon,
  Check,
  Plus,
  Edit2,
  Trash2,
  Upload,
  CheckSquare,
  CheckCheck,
} from 'lucide-react';
import { useState, useMemo, useRef, useEffect, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import { TagFilter } from './TagFilter';
import { MultiSelectFilter } from './MultiSelectFilter';
import { AIGeneratedFilter } from './AIGeneratedFilter';
import { useFavorites } from '../hooks/useFavorites';
import Masonry, { ResponsiveMasonry } from 'react-responsive-masonry';
import { useAuth } from '../contexts/AuthContext';
import { LoginRequiredModal } from './LoginRequiredModal';
import { ArtistProfileModal } from './ArtistProfileModal';
import { getArtistByName, type Artist } from '../data/artists';
import { useIsEditor } from '../utils/adminUtils';
import { AdminEditImageModal } from './AdminEditImageModal';
import { AdminEditArtistModal } from './AdminEditArtistModal';
import { AdminBulkEditImagesModal, BulkImageUpdates } from './AdminBulkEditImagesModal';
import { useGalleryImagesPaged } from '../hooks/useGalleryImagesPaged';
import {
  fetchGalleryIds,
  fetchGalleryFacets,
  fetchImageArtists,
  fetchImageTypes,
} from '../services/contentLoaders';
import { fetchAllTags } from '../services/tagsService';
import type { ContentId, GalleryImage } from '../types/content';
import { createImage, deleteImage, updateImage, updateArtist } from '../services/contentWriteService';
import { getApiBaseUrl } from '../config/api';
import { getImageUrl } from '../utils/getImageUrl';
import { normalizeArabic } from '../utils/arabicUtils';
import { downloadFile } from '../utils/download';
import { trackEvent } from '../services/analytics';
import { useSearchAnalytics } from '../hooks/useSearchAnalytics';

type SortOption = 'alpha-asc' | 'alpha-desc' | 'date-asc' | 'date-desc';

type ImageFacet = 'tags' | 'artists' | 'types' | 'ai';

const sortOptions = [
  { value: 'alpha-asc' as SortOption, label: 'أبجدياً (أ - ي)' },
  { value: 'alpha-desc' as SortOption, label: 'أبجدياً (ي - أ)' },
  { value: 'date-asc' as SortOption, label: 'الأقدم' },
  { value: 'date-desc' as SortOption, label: 'الأحدث' },
];

const sortArabic = (a: string, b: string) => a.localeCompare(b, 'ar');

const uniqueSorted = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean))).sort(sortArabic);

const normalizeSearchText = (text: string) => normalizeArabic(text).toLowerCase();

function imageMatchesSearch(image: GalleryImage, query: string) {
  if (!query) return true;
  const normalizedQuery = normalizeSearchText(query);
  return (
    normalizeSearchText(image.title).includes(normalizedQuery) ||
    image.tags.some((tag) => normalizeSearchText(tag).includes(normalizedQuery)) ||
    normalizeSearchText(image.artist).includes(normalizedQuery) ||
    normalizeSearchText(image.type).includes(normalizedQuery)
  );
}

function imageMatchesPublished(image: GalleryImage, isEditor: boolean) {
  return isEditor || image.published;
}

function imageMatchesFavorites(
  image: GalleryImage,
  showFavoritesOnly: boolean,
  favoritedIds: Set<string>,
) {
  return !showFavoritesOnly || favoritedIds.has(String(image.id));
}

function imageMatchesTags(image: GalleryImage, selectedTags: string[]) {
  return (
    selectedTags.length === 0 ||
    selectedTags.some((tag) => image.tags.includes(tag))
  );
}

function imageMatchesArtists(image: GalleryImage, selectedArtists: string[]) {
  return (
    selectedArtists.length === 0 || selectedArtists.includes(image.artist)
  );
}

function imageMatchesTypes(image: GalleryImage, selectedTypes: string[]) {
  return selectedTypes.length === 0 || selectedTypes.includes(image.type);
}

function imageMatchesAi(image: GalleryImage, aiFilter: 'all' | 'yes' | 'no') {
  return (
    aiFilter === 'all' ||
    (aiFilter === 'yes' && image.aiGenerated) ||
    (aiFilter === 'no' && !image.aiGenerated)
  );
}

function getImagesForFacet(
  images: GalleryImage[],
  params: {
    isEditor: boolean;
    searchQuery: string;
    selectedTags: string[];
    selectedArtists: string[];
    selectedTypes: string[];
    aiFilter: 'all' | 'yes' | 'no';
    showFavoritesOnly: boolean;
    favoritedIds: Set<string>;
    excludeFacet?: ImageFacet;
  },
) {
  const {
    isEditor,
    searchQuery,
    selectedTags,
    selectedArtists,
    selectedTypes,
    aiFilter,
    showFavoritesOnly,
    favoritedIds,
    excludeFacet,
  } = params;

  return images.filter((image) => {
    if (!imageMatchesPublished(image, isEditor)) return false;
    if (!imageMatchesSearch(image, searchQuery)) return false;
    if (!imageMatchesFavorites(image, showFavoritesOnly, favoritedIds)) return false;
    if (excludeFacet !== 'tags' && !imageMatchesTags(image, selectedTags)) return false;
    if (excludeFacet !== 'artists' && !imageMatchesArtists(image, selectedArtists)) return false;
    if (excludeFacet !== 'types' && !imageMatchesTypes(image, selectedTypes)) return false;
    if (excludeFacet !== 'ai' && !imageMatchesAi(image, aiFilter)) return false;
    return true;
  });
}

// The grid shows small thumbnails. Rewrite the stable image-proxy URL to the
// thumbnail endpoint; external/data URLs are returned unchanged. The lightbox and
// downloads keep using the full-size original.
function toThumbUrl(url: string, width = 700): string {
  if (!url.includes('/api/uploads/url?key=')) return url;
  return url.replace('/api/uploads/url?key=', '/api/uploads/thumb?key=') + `&w=${width}`;
}

export function ImageLibrarySection({
  isSidebarCollapsed,
  scrollContainerRef,
}: {
  isSidebarCollapsed: boolean;
  scrollContainerRef: RefObject<HTMLElement | null>;
}) {
  const navigate = useNavigate();
  const { user, profile, accessToken } = useAuth();
  const isEditor = useIsEditor();
  const {
    items: images,
    setItems: setImages,
    total: totalImages,
    loading: imagesLoading,
    loadingMore,
    hasMore,
    applyFilters,
    loadMore,
    refetch: refetchGallery,
  } = useGalleryImagesPaged(30);

  // Full filter option lists come from the meta endpoints (the whole catalog),
  // independent of the currently-loaded page.
  const [allArtists, setAllArtists] = useState<string[]>([]);
  const [allTypes, setAllTypes] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  useEffect(() => {
    fetchImageArtists().then(setAllArtists).catch(() => {});
    fetchImageTypes().then(setAllTypes).catch(() => {});
    fetchAllTags()
      .then((t) => setAllTags(t.map((x) => x.name)))
      .catch(() => {});
  }, []);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [aiFilter, setAiFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { favoriteIds: favoritedImageIds, isFavorited, toggleFavorite: apiToggleFavorite, count: favoritedCount } = useFavorites('IMAGE');
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<ContentId[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const [artistProfileOpen, setArtistProfileOpen] = useState(false);
  const [selectedArtistName, setSelectedArtistName] = useState<string | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<GalleryImage | null>(null);

  const [isEditArtistModalOpen, setIsEditArtistModalOpen] = useState(false);
  const [editingArtistName, setEditingArtistName] = useState<string | null>(null);

  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);

  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const filtersContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        sortDropdownRef.current &&
        !sortDropdownRef.current.contains(event.target as Node)
      ) {
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

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lightboxOpen) {
        setLightboxOpen(false);
      }
    };

    if (lightboxOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [lightboxOpen]);

  const openLightbox = (index: number) => {
    setCurrentImageIndex(index);
    setLightboxOpen(true);
    const img = sortedImages[index];
    if (img) {
      trackEvent('image_view', {
        contentType: 'image',
        contentId: img.id,
        contentName: img.title,
      });
    }
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => {
      const next = prev + 1;
      if (next >= sortedImages.length) {
        if (hasMore) loadMore(); // pull in the next page; stay until it arrives
        return prev;
      }
      return next;
    });
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : prev));
  };

  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      prevImage();
    }
    if (isRightSwipe) {
      nextImage();
    }
  };

  const toggleFavorite = (imageId: ContentId) => {
    if (!user || !profile) {
      setShowLoginModal(true);
      return;
    }
    apiToggleFavorite(imageId);
  };

  const downloadImage = (image: GalleryImage) => {
    downloadFile(image.src, `${image.title}.png`, {
      contentType: 'image',
      contentId: image.id,
      contentName: image.title,
    });
  };

  const toggleImageSelection = (imageId: ContentId) => {
    setSelectedImages((prev) =>
      prev.some((id) => String(id) === String(imageId))
        ? prev.filter((id) => String(id) !== String(imageId))
        : [...prev, imageId],
    );
  };

  // Select every image matching the current filters (across all pages, not just loaded).
  const selectAllMatching = async () => {
    if (showFavoritesOnly) {
      setSelectedImages(sortedImages.map((img) => img.id));
      return;
    }
    try {
      setSelectedImages(await fetchGalleryIds(currentFilters));
    } catch {
      setSelectedImages(sortedImages.map((img) => img.id));
    }
  };

  const selectAllImages = () => {
    void selectAllMatching();
  };

  const clearSelection = () => {
    setSelectedImages([]);
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedImages([]);
  };

  const handleAddNew = () => {
    setEditingImage(null);
    setIsEditModalOpen(true);
  };

  const handleEdit = (image: GalleryImage) => {
    setEditingImage(image);
    setIsEditModalOpen(true);
  };

  const handleDelete = async (id: ContentId) => {
    if (confirm('هل أنت متأكد من حذف هذه الصورة؟')) {
      if (typeof id !== 'string') {
        setShareMessage('لا يمكن حذف عنصر غير متزامن مع الخادم');
        setTimeout(() => setShareMessage(''), 2000);
        return;
      }
      try {
        await deleteImage(id, accessToken);
        setImages((prev) => prev.filter((img) => String(img.id) !== String(id)));
        setShareMessage('تم الحذف بنجاح');
      } catch {
        setShareMessage('فشل الحذف من الخادم');
      } finally {
        setTimeout(() => setShareMessage(''), 2000);
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedImages.length === 0) return;
    if (confirm(`هل أنت متأكد من حذف ${selectedImages.length} صورة؟`)) {
      const ids = selectedImages.filter((id): id is string => typeof id === 'string');
      await Promise.allSettled(ids.map((id) => deleteImage(id, accessToken)));
      setImages((prev) => prev.filter((img) => !ids.includes(String(img.id))));
      setSelectedImages([]);
      setBulkEditMode(false);
      setShareMessage('تم الحذف بنجاح');
      setTimeout(() => setShareMessage(''), 2000);
    }
  };

  const handleBulkPublish = () => {
    if (selectedImages.length === 0) return;
    setImages((prev) =>
      prev.map((img) =>
        selectedImages.some((sid) => String(sid) === String(img.id))
          ? { ...img, published: true }
          : img,
      ),
    );
    setSelectedImages([]);
    setBulkEditMode(false);
    setShareMessage(`تم نشر ${selectedImages.length} صورة`);
    setTimeout(() => setShareMessage(''), 2000);
  };

  const handleBulkHide = () => {
    if (selectedImages.length === 0) return;
    setImages((prev) =>
      prev.map((img) =>
        selectedImages.some((sid) => String(sid) === String(img.id))
          ? { ...img, published: false }
          : img,
      ),
    );
    setSelectedImages([]);
    setBulkEditMode(false);
    setShareMessage(`تم إخفاء ${selectedImages.length} صورة`);
    setTimeout(() => setShareMessage(''), 2000);
  };

  const handleSelectAllImages = () => {
    if (totalImages > 0 && selectedImages.length >= totalImages) {
      setSelectedImages([]);
    } else {
      void selectAllMatching();
    }
  };

  const handleBulkEditSave = (updates: BulkImageUpdates) => {
    setImages((prev) =>
      prev.map((img) => {
        if (!selectedImages.some((sid) => String(sid) === String(img.id))) return img;

        const updatedImage = { ...img };

        if (updates.applyArtist && updates.artist) {
          updatedImage.artist = updates.artist;
        }

        if (updates.applyType && updates.type) {
          updatedImage.type = updates.type;
        }

        if (updates.applyAiStatus) {
          updatedImage.aiGenerated = updates.aiGenerated;
        }

        if (updates.applyTags) {
          if (updates.tagOperation === 'add') {
            updatedImage.tags = [...new Set([...updatedImage.tags, ...updates.tags])];
          } else if (updates.tagOperation === 'replace') {
            updatedImage.tags = updates.tags;
          } else if (updates.tagOperation === 'remove') {
            updatedImage.tags = updatedImage.tags.filter((tag) => !updates.tags.includes(tag));
          }
        }

        if (updates.applyPublished) {
          updatedImage.published = updates.published;
        }

        return updatedImage;
      }),
    );

    setIsBulkEditModalOpen(false);
    setSelectedImages([]);
    setBulkEditMode(false);
    setShareMessage('تم تحديث الصور بنجاح');
    setTimeout(() => setShareMessage(''), 2000);
  };

  const handleSaveImage = async (image: GalleryImage) => {
    try {
      if (editingImage && typeof editingImage.id === 'string') {
        const updated = await updateImage(editingImage.id, image, accessToken);
        setImages((prev) => prev.map((img) => (img.id === updated.id ? updated : img)));
        setShareMessage('تم التحديث بنجاح');
      } else {
        const created = await createImage(image, accessToken);
        setImages((prev) => [...prev, created]);
        setShareMessage('تمت الإضافة بنجاح');
      }
    } catch (err: any) {
      console.error('[ImageLibrary] Save failed:', err?.message || err);
      setShareMessage('فشل الحفظ على الخادم');
    } finally {
      setTimeout(() => setShareMessage(''), 2000);
    }
  };

  const handleSaveMultipleImages = async (images: GalleryImage[]) => {
    const created = await Promise.allSettled(images.map((img) => createImage(img, accessToken)));
    const ok = created
      .filter((x): x is PromiseFulfilledResult<GalleryImage> => x.status === 'fulfilled')
      .map((x) => x.value);
    setImages((prev) => [...prev, ...ok]);
    setShareMessage(`تمت إضافة ${ok.length} صورة بنجاح`);
    setTimeout(() => setShareMessage(''), 2000);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(images, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `gallery-images-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setShareMessage('تم التصدير بنجاح');
    setTimeout(() => setShareMessage(''), 2000);
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
              'هل تريد استبدال البيانات الحالية أم دمجها?\n\nاضغط OK للاستبدال، أو Cancel للدمج',
            )
          ) {
            setImages(imported);
            setShareMessage('تم الاستيراد بنجاح (استبدال)');
          } else {
            const existingIds = new Set(images.map((img) => img.id));
            const newImages = imported.filter(
              (img: GalleryImage) => !existingIds.has(img.id),
            );
            setImages((prev) => [...prev, ...newImages]);
            setShareMessage(`تم الاستيراد بنجاح (${newImages.length} عنصر جديد)`);
          }
          setTimeout(() => setShareMessage(''), 2000);
        } else {
          alert('ملف غير صالح. يجب أن يحتوي على مصفوفة JSON.');
        }
      } catch (error) {
        alert('خطأ في قراءة الملف');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleBatchDownload = () => {
    const toDownload = sortedImages.filter((img) =>
      selectedImages.some((sid) => String(sid) === String(img.id)),
    );
    toDownload.forEach((image) => downloadImage(image));

    setShareMessage(`تم تحميل ${toDownload.length} صورة`);
    setTimeout(() => setShareMessage(''), 3000);
    exitSelectionMode();
  };

  const handleBatchAddToFavorites = () => {
    if (!user || !profile) {
      setShowLoginModal(true);
      return;
    }

    selectedImages.forEach((id) => {
      if (!favoritedImageIds.has(String(id))) {
        apiToggleFavorite(id);
      }
    });

    setShareMessage(`تم إضافة ${selectedImages.length} صورة إلى المفضلة`);
    setTimeout(() => setShareMessage(''), 3000);
    exitSelectionMode();
  };

  // Map the UI sort option to the server's sort key.
  const backendSort =
    sortBy === 'alpha-asc'
      ? 'title-asc'
      : sortBy === 'alpha-desc'
        ? 'title-desc'
        : sortBy; // 'date-asc' | 'date-desc' pass through

  // Debounce the search box so we don't query the server on every keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Active server-side filter set ("favorites only" -> id list).
  const currentFilters = useMemo(
    () => ({
      search: debouncedSearch,
      tags: selectedTags,
      artists: selectedArtists,
      types: selectedTypes,
      ai: aiFilter,
      ids: showFavoritesOnly ? Array.from(favoritedImageIds) : undefined,
      token: accessToken,
    }),
    [
      debouncedSearch,
      selectedTags,
      selectedArtists,
      selectedTypes,
      aiFilter,
      showFavoritesOnly,
      favoritedImageIds,
      accessToken,
    ],
  );

  // Refetch page 1 whenever the filters or sort change.
  useEffect(() => {
    applyFilters({ ...currentFilters, sort: backendSort });
  }, [currentFilters, backendSort, applyFilters]);

  // Server-computed faceted options (each facet narrows by the OTHER active filters).
  const [facets, setFacets] = useState<{
    tags: string[];
    artists: string[];
    types: string[];
    ai: ('yes' | 'no')[];
  }>({ tags: [], artists: [], types: [], ai: [] });
  useEffect(() => {
    let cancelled = false;
    fetchGalleryFacets(currentFilters)
      .then((f) => {
        if (!cancelled) setFacets(f);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentFilters]);

  // Infinite scroll: load the next page when the sentinel nears the viewport.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { root: scrollContainerRef.current ?? null, rootMargin: '600px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore, hasMore]);

  // Faceted option lists now come from the server (computed against the current filters).
  const availableTopicNames = facets.tags;
  const availableArtistNames = facets.artists;
  const availableTypeNames = facets.types;
  const availableAiValues = facets.ai;

  // The server already filtered + sorted; `images` holds the pages loaded so far.
  const sortedImages = images;

  useSearchAnalytics(searchQuery, { section: "images" });

  const handleLogin = () => {
    setShowLoginModal(false);
    window.dispatchEvent(new CustomEvent('openLoginModal'));
  };

  if (imagesLoading && images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-2 text-muted-foreground">
        <p>جاري تحميل الصور...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Title / Description */}
      <div>
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="font-bold text-2xl sm:text-3xl lg:text-[36px]">مكتبة الصور</h1>
          <button
            onClick={() => navigate('/artists')}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium shrink-0"
          >
            <User className="w-4 h-4" />
            <span>الفنانون</span>
          </button>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          مجموعة شاملة من الصور والأيقونات الكنسية والمناظر الطبيعية. استخدم
          البحث والفلاتر للعثور على الصور حسب النوع أو الفنان أو الموضوع،
          واعرض معرض الصور بوضع ملء الشاشة، وأضف المفضلات لديك، وحمّل الصور
          للاستخدام في الخدمة.
        </p>
      </div>

      {/* Sticky Header Section */}
      <div className="sticky top-0 bg-background z-40 pb-2 pt-2 sm:pb-4 border-b border-border/50">

        {isEditor && (
          <div className="mt-4 mb-4 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">أدوات التحرير:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
                  title="إضافة صورة يدوية واحدة"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة صورة يدوية</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBulkEditMode(!bulkEditMode);
                    setSelectedImages([]);
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
                  type="button"
                  onClick={handleExport}
                  className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg hover:bg-muted transition-colors text-sm"
                  title="تصدير JSON"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير</span>
                </button>
                <button
                  type="button"
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

        {isEditor && bulkEditMode && selectedImages.length > 0 && (
          <div className="mt-4 p-3 bg-primary/10 border border-primary rounded-xl flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-medium">{selectedImages.length} عنصر محدد</span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleSelectAllImages}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors text-sm"
              >
                <CheckCheck className="w-4 h-4" />
                {totalImages > 0 && selectedImages.length >= totalImages ? 'إلغاء الكل' : 'تحديد الكل'}
              </button>
              <button
                onClick={() => setIsBulkEditModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                <Edit2 className="w-4 h-4" />
                تعديل المحدد
              </button>
              <button
                onClick={handleBulkPublish}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
              >
                <Eye className="w-4 h-4" />
                نشر المحدد
              </button>
              <button
                onClick={handleBulkHide}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm"
              >
                <Eye className="w-4 h-4" />
                إخفاء المحدد
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
              >
                <Trash2 className="w-4 h-4" />
                حذف المحدد
              </button>
            </div>
          </div>
        )}

        {/* Search and Filters Container */}
        <div className="space-y-4 sm:space-y-8">
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

            <button
              onClick={() =>
                isSelectionMode ? exitSelectionMode() : setIsSelectionMode(true)
              }
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

            <div className="relative flex-shrink-0 sm:hidden" ref={sortDropdownRef}>
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="flex items-center justify-center min-w-[44px] min-h-[44px] w-[50px] h-[50px] bg-card border border-border rounded-xl hover:bg-muted transition-colors"
              >
                <ArrowUpDown className="w-5 h-5 text-muted-foreground" />
              </button>

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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 -mt-2 sm:-mt-3.5">
            <div
              className="relative flex items-center gap-2 sm:gap-3 w-full sm:w-auto"
              ref={filtersContainerRef}
            >
              <div className="flex-1 sm:flex-initial">
                <TagFilter
                  selectedTags={selectedTags}
                  onTagsChange={setSelectedTags}
                  onSearchChange={setSearchQuery}
                  searchQuery={searchQuery}
                  showSearch={false}
                  icon={Tags}
                  containerRef={filtersContainerRef}
                  availableTopics={availableTopicNames}
                />
              </div>

              <div className="flex-1 sm:flex-initial">
                <MultiSelectFilter
                  label="الفنانون"
                  options={allArtists}
                  selectedOptions={selectedArtists}
                  onOptionsChange={setSelectedArtists}
                  icon={User}
                  availableOptions={availableArtistNames}
                />
              </div>

              <div className="flex-1 sm:flex-initial">
                <MultiSelectFilter
                  label="النواع"
                  options={allTypes}
                  selectedOptions={selectedTypes}
                  onOptionsChange={setSelectedTypes}
                  icon={ImageIcon}
                  availableOptions={availableTypeNames}
                />
              </div>

              <div className="flex-1 sm:flex-initial">
                <AIGeneratedFilter
                  value={aiFilter}
                  onChange={setAiFilter}
                  availableValues={availableAiValues}
                />
              </div>

              {user && profile && (
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] border rounded-xl transition-all relative whitespace-nowrap ${
                    showFavoritesOnly
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-card border-border hover:bg-muted'
                  }`}
                  title={
                    showFavoritesOnly ? 'إظهار كل الصور' : 'عرض المفضلة فقط'
                  }
                >
                  <Heart
                    className={`w-4 h-4 flex-shrink-0 transition-all ${
                      showFavoritesOnly ? 'fill-current' : ''
                    }`}
                  />
                  <span className="text-sm hidden lg:inline">المفضلة فقط</span>
                  {showFavoritesOnly && favoritedCount > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-2 py-0.5">
                      {favoritedCount}
                    </span>
                  )}
                </button>
              )}

              <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] bg-muted/50 border border-border/50 rounded-xl pointer-events-none">
                <ImageIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">
                  {sortedImages.length} / {totalImages}
                </span>
              </div>
            </div>

            <div
              className="relative flex-shrink-0 order-1 sm:order-2 hidden sm:block"
              ref={sortDropdownRef}
            >
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-card border border-border rounded-xl hover:bg-muted transition-colors text-sm w-full sm:w-auto justify-between"
              >
                <ArrowUpDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span>
                  {sortOptions.find((option) => option.value === sortBy)?.label}
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform flex-shrink-0 ${
                    isSortDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

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

      <div className="flex-1 pt-6">
        <ResponsiveMasonry
          columnsCountBreakPoints={{ 0: 1, 350: 1, 750: 2, 900: 3, 1200: 4 }}
        >
          <Masonry gutter="16px">
            {sortedImages.length > 0 ? (
              sortedImages.map((image, index) => (
                <div
                  key={image.id}
                  className={`group relative z-0 isolate overflow-hidden rounded-xl bg-card border cursor-pointer transition-all ${
                    (isSelectionMode || bulkEditMode) &&
                    selectedImages.some((x) => String(x) === String(image.id))
                      ? 'border-2 border-primary ring-2 ring-primary/20'
                      : 'border-border'
                  }`}
                  onClick={() => {
                    if (isSelectionMode || bulkEditMode) {
                      toggleImageSelection(image.id);
                    } else {
                      openLightbox(index);
                    }
                  }}
                >
                  {(() => {
                    if (image.src.startsWith('blob:')) return null;
                    const fullImageUrl = getImageUrl(image.src);

                    return (
                      <img
                        src={toThumbUrl(fullImageUrl, 700)}
                        alt={image.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-auto object-cover transition-transform duration-300 bg-muted min-h-[200px]"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    );
                  })()}

                  {isEditor && !image.published && !(isSelectionMode || bulkEditMode) && (
                    <div className="absolute top-3 right-3 z-10">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg shadow-lg text-xs font-semibold">
                        <Eye className="w-3.5 h-3.5" />
                        <span>مخفية</span>
                      </div>
                    </div>
                  )}

                  {(isSelectionMode || bulkEditMode) && (
                    <div
                      className="absolute top-3 right-3 z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleImageSelection(image.id);
                      }}
                    >
                      <div
                        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all cursor-pointer shadow-lg ${
                          selectedImages.some((x) => String(x) === String(image.id))
                            ? 'bg-primary border-primary'
                            : 'border-white bg-white/90 hover:bg-white'
                        }`}
                      >
                        {selectedImages.some((x) => String(x) === String(image.id)) && (
                          <Check className="w-4 h-4 text-primary-foreground" />
                        )}
                      </div>
                    </div>
                  )}

                  {!isSelectionMode && !bulkEditMode && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        <div className="flex items-center justify-center gap-2">
                          {isEditor ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(image);
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-black rounded-lg transition-colors text-xs shadow-lg"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>تعديل</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(image.id);
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-colors text-xs shadow-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadImage(image);
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-black rounded-lg transition-colors text-xs shadow-lg"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>تحميل</span>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadImage(image);
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-black rounded-lg transition-colors text-xs"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>تحميل</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div
                        className={`absolute top-3 left-3 z-10 transition-opacity duration-300 ${
                          isFavorited(image.id)
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(image.id);
                          }}
                          className={`p-2 rounded-lg transition-all shadow-lg ${
                            isFavorited(image.id)
                              ? 'bg-red-500 text-white'
                              : 'bg-white/90 hover:bg-white text-black'
                          }`}
                        >
                          <Heart
                            className={`w-4 h-4 ${
                              isFavorited(image.id) ? 'fill-current' : ''
                            }`}
                          />
                        </button>
                      </div>
                    </>
                  )}

                  {(isSelectionMode || bulkEditMode) &&
                    selectedImages.some((x) => String(x) === String(image.id)) && (
                      <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
                    )}
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 bg-card rounded-xl border border-border">
                <p className="text-muted-foreground">
                  لا توجد صور مطابقة للبحث أو التصنيفات المحددة
                </p>
              </div>
            )}
          </Masonry>
        </ResponsiveMasonry>

        {/* Infinite-scroll sentinel + loading indicator */}
        {hasMore && <div ref={sentinelRef} className="h-px w-full" />}
        {loadingMore && (
          <div className="flex justify-center py-6 text-muted-foreground">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent" />
          </div>
        )}
      </div>

      {lightboxOpen && sortedImages.length > 0 && (
        <div
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-[300]"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-full p-3 transition-colors z-10"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute top-4 right-4 left-20 bg-black/60 backdrop-blur-sm text-white rounded-xl p-4 z-10 max-w-2xl">
            <h2 className="font-bold mb-1">{sortedImages[currentImageIndex].title}</h2>
            <div className="flex items-center gap-2 text-xs text-white/70 flex-wrap">
              <span>الفنان: </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const artist = getArtistByName(sortedImages[currentImageIndex].artist);
                  if (artist) {
                    setSelectedArtistName(sortedImages[currentImageIndex].artist);
                    setArtistProfileOpen(true);
                  }
                }}
                className="hover:text-white hover:underline transition-colors cursor-pointer"
              >
                {sortedImages[currentImageIndex].artist}
              </button>
              <span>•</span>
              <span>{sortedImages[currentImageIndex].type}</span>
              {sortedImages[currentImageIndex].aiGenerated && (
                <>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    AI Generated
                  </span>
                </>
              )}
            </div>
            <p className="text-sm text-white/80 mt-2">
              {sortedImages[currentImageIndex].tags.join(', ')}
            </p>
          </div>

          <div className="absolute bottom-4 right-4 left-4 flex flex-wrap items-center justify-center gap-3 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                downloadImage(sortedImages[currentImageIndex]);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-xl transition-colors text-white"
            >
              <Download className="w-5 h-5" />
              <span>تحميل الصورة</span>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(sortedImages[currentImageIndex].id);
              }}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-colors backdrop-blur-sm ${
                isFavorited(sortedImages[currentImageIndex].id)
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
            >
              <Heart
                className={`w-5 h-5 ${
                  isFavorited(sortedImages[currentImageIndex].id)
                    ? 'fill-current'
                    : ''
                }`}
              />
              <span>
                {isFavorited(sortedImages[currentImageIndex].id)
                  ? 'مفضلة'
                  : 'إضافة للمفضلة'}
              </span>
            </button>
          </div>

          {sortedImages.length > 1 && (
            <>
              <button
                className="absolute top-1/2 right-4 -translate-y-1/2 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-full p-4 transition-colors z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  nextImage();
                }}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
              <button
                className="absolute top-1/2 left-4 -translate-y-1/2 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-full p-4 transition-colors z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  prevImage();
                }}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            </>
          )}

          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white rounded-full px-4 py-2 text-sm z-10">
            {currentImageIndex + 1} / {sortedImages.length}
          </div>

          <div
            className="absolute inset-0 flex items-center justify-center px-4 py-32 md:px-20"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {(() => {
              const currentSrc = sortedImages[currentImageIndex].src;
              if (currentSrc.startsWith('blob:')) return null;
              const fullLightboxUrl = getImageUrl(currentSrc);

              return (
                <img
                  src={fullLightboxUrl}
                  alt={sortedImages[currentImageIndex].title}
                  className="max-w-full max-h-full object-contain"
                />
              );
            })()}
          </div>
        </div>
      )}

      {shareMessage && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-xl shadow-lg z-50 animate-fade-in">
          {shareMessage}
        </div>
      )}

      {isSelectionMode && (
        <div
          className={`fixed bottom-0 left-0 sm:left-8 right-0 lg:right-[18rem] z-[100] bg-card border border-border rounded-t-xl shadow-2xl animate-in slide-in-from-bottom duration-300 pb-safe transition-all ${
            isSidebarCollapsed ? 'lg:right-[7rem]' : 'lg:right-[18rem]'
          }`}
        >
          <div className="hidden sm:flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {selectedImages.length} من {totalImages} محدد
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBatchDownload}
                disabled={selectedImages.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Download className="w-4 h-4" />
                <span>تحميل ({selectedImages.length})</span>
              </button>
              <button
                onClick={handleBatchAddToFavorites}
                disabled={selectedImages.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-red-500 text-red-500 rounded-lg hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                <Heart className="w-4 h-4" />
                <span>مفضلة ({selectedImages.length})</span>
              </button>
              <div className="w-px h-6 bg-border mx-2" />
              <button
                onClick={selectAllImages}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-all text-sm"
              >
                <Check className="w-4 h-4" />
                <span>تحديد الكل</span>
              </button>
              <button
                onClick={clearSelection}
                disabled={selectedImages.length === 0}
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

          <div className="sm:hidden">
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">
                {selectedImages.length} من {totalImages} محدد
              </p>
              <button
                onClick={exitSelectionMode}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg hover:bg-destructive/20 transition-all text-sm"
              >
                <X className="w-4 h-4" />
                <span>إلغاء</span>
              </button>
            </div>
            <div className="p-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={selectAllImages}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-card border border-border rounded-xl hover:bg-muted transition-all text-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>تحديد الكل</span>
                </button>
                <button
                  onClick={clearSelection}
                  disabled={selectedImages.length === 0}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-card border border-border rounded-xl hover:bg-muted transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <X className="w-4 h-4" />
                  <span>إلغاء التحديد</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleBatchDownload}
                  disabled={selectedImages.length === 0}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                >
                  <Download className="w-5 h-5" />
                  <span>تحميل ({selectedImages.length})</span>
                </button>
                <button
                  onClick={handleBatchAddToFavorites}
                  disabled={selectedImages.length === 0}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-card border border-red-500 text-red-500 rounded-xl hover:bg-red-500/10 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
                >
                  <Heart className="w-5 h-5" />
                  <span>مفضلة ({selectedImages.length})</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <LoginRequiredModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginClick={handleLogin}
      />

      <ArtistProfileModal
        isOpen={artistProfileOpen}
        onClose={() => setArtistProfileOpen(false)}
        artist={
          selectedArtistName
            ? (getArtistByName(selectedArtistName) ?? null)
            : null
        }
        images={images as any}
        onImageClick={openLightbox}
        favoritedImages={Array.from(favoritedImageIds) as any}
        onToggleFavorite={toggleFavorite as any}
        onDownloadImage={downloadImage as any}
        isEditor={isEditor}
        onEditArtist={() => {
          setEditingArtistName(selectedArtistName);
          setIsEditArtistModalOpen(true);
        }}
      />

      {isEditor && editingArtistName && (
        <AdminEditArtistModal
          isOpen={isEditArtistModalOpen}
          onClose={() => {
            setIsEditArtistModalOpen(false);
            setEditingArtistName(null);
          }}
          onSave={async (artistData) => {
            try {
              const artist = getArtistByName(editingArtistName);
              if (artist && typeof artist.id === 'string') {
                await updateArtist(artist.id, artistData, accessToken);
              }
              setShareMessage('تم تحديث بيانات الفنان بنجاح');
            } catch {
              setShareMessage('فشل تحديث بيانات الفنان');
            }
            setTimeout(() => setShareMessage(''), 2000);
          }}
          artist={
            editingArtistName
              ? (getArtistByName(editingArtistName) ?? {
                  id: editingArtistName,
                  name: editingArtistName,
                  bio: '',
                  role: '',
                  profileImage: '',
                  socialMedia: {},
                  joinDate: new Date().toISOString().split('T')[0],
                  specialty: [],
                })
              : {
                  id: '',
                  name: '',
                  bio: '',
                  role: '',
                  profileImage: '',
                  socialMedia: {},
                  joinDate: new Date().toISOString().split('T')[0],
                  specialty: [],
                }
          }
        />
      )}

      {isEditor && (
        <AdminEditImageModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditingImage(null);
          }}
          onSave={handleSaveImage}
          onSaveMultiple={handleSaveMultipleImages}
          image={editingImage}
          allArtists={allArtists}
          allTypes={allTypes}
        />
      )}

      {isEditor && (
        <AdminBulkEditImagesModal
          isOpen={isBulkEditModalOpen}
          onClose={() => setIsBulkEditModalOpen(false)}
          onSave={handleBulkEditSave}
          selectedCount={selectedImages.length}
          availableArtists={allArtists}
          availableTypes={allTypes}
        />
      )}
    </div>
  );
}
