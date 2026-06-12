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
  Square,
  CheckCheck,
  Video,
} from 'lucide-react';
import { useState, useMemo, useRef, useEffect, type RefObject } from 'react';
import { TagFilter } from './TagFilter';
import { MultiSelectFilter } from './MultiSelectFilter';
import { AIGeneratedFilter } from './AIGeneratedFilter';
import Masonry, { ResponsiveMasonry } from 'react-responsive-masonry';
import { useAuth } from '../contexts/AuthContext';
import { LoginRequiredModal } from './LoginRequiredModal';
import { ArtistProfileModal } from './ArtistProfileModal';
import { getArtistByName } from '../data/artists';
import { useIsEditor } from '../utils/adminUtils';
import { AdminEditImageModal } from './AdminEditImageModal';
import {
  AdminBulkEditImagesModal,
  BulkImageUpdates,
} from './AdminBulkEditImagesModal';
import { VideoModal } from './VideoModal';
import { useGalleryImagesData } from '../hooks/useGalleryImagesData';
import type { ContentId, GalleryImage } from '../types/content';
import {
  createImage,
  deleteImage,
  updateImage,
} from '../services/contentWriteService';
import { getApiBaseUrl } from '../config/api'; // تأكد إن مسار ملف api.ts صح بالنسبة للملف ده

type SortOption = 'alpha-asc' | 'alpha-desc' | 'date-asc' | 'date-desc';

const sortOptions = [
  { value: 'alpha-asc' as SortOption, label: 'أبجدياً (أ - ي)' },
  { value: 'alpha-desc' as SortOption, label: 'أبجدياً (ي - أ)' },
  { value: 'date-asc' as SortOption, label: 'الأقدم' },
  { value: 'date-desc' as SortOption, label: 'الأحدث' },
];

export function ImageLibrarySection({
  isSidebarCollapsed,
}: {
  isSidebarCollapsed: boolean;
}) {
  const [visibleCount, setVisibleCount] = useState(20);
  const { user, profile, accessToken } = useAuth();
  const isEditor = useIsEditor();
  const { images, setImages, loading: imagesLoading } = useGalleryImagesData();

  // Get unique artists, tags, and types from current images
  const allArtists = useMemo(
    () => Array.from(new Set(images.map((img) => img.artist))),
    [images],
  );
  const allTypes = useMemo(
    () => Array.from(new Set(images.map((img) => img.type))),
    [images],
  );
  const allTags = useMemo(
    () => Array.from(new Set(images.flatMap((img) => img.tags))),
    [images],
  );

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [aiFilter, setAiFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [favoritedImages, setFavoritedImages] = useState<ContentId[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<ContentId[]>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Artist Profile Modal state
  const [artistProfileOpen, setArtistProfileOpen] = useState(false);
  const [selectedArtistName, setSelectedArtistName] = useState<string | null>(
    null,
  );

  // Admin states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingImage, setEditingImage] = useState<GalleryImage | null>(null);

  // Video tutorial modal state
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);

  // Touch/swipe detection state for lightbox
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const filtersContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Favorites are kept in-memory only.

  // 1. أضف هذا الـ Ref في أعلى الكومبوننت بجانب الـ refs الأخرى (حوالي السطر 80):
  const imageBulkInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingBulk, setIsUploadingBulk] = useState(false); // لحالة التحميل أثناء الرفع الجماعي
  // 2. أضف دالة معالجة الـ Bulk Upload الجماعي داخل الكومبوننت:
  const handleImageBulkChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingBulk(true);
    setShareMessage(`جاري تحضير ورفع ${files.length} صورة...`);

    try {
      const newImagesPromises = Array.from(files).map((file) => {
        return new Promise<GalleryImage>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              // تجهيز مصفوفة بيانات الصورة بالقيم الافتراضية
              const base64String = e.target.result as string;
              resolve({
                id: 0, // السيرفر هيولد الـ id تلقائياً
                title:
                  file.name.split('.').slice(0, -1).join('.') || 'صورة جديدة',
                src: base64String,
                artist: 'غير محدد',
                type: 'متنوع',
                tags: [],
                aiGenerated: false,
                published: true, // رفع ونشر تلقائي مثل الـ Dashboard
                uploadDate: new Date().toISOString(),
              });
            } else {
              reject(new Error('فشل قراءة الملف'));
            }
          };
          reader.onerror = () => reject(new Error('خطأ في الملف'));
          reader.readAsDataURL(file);
        });
      });

      const preparedImages = await Promise.all(newImagesPromises);

      // استدعاء الدالة المجهزة مسبقاً في السيكشن لرفع المصفوفة كاملة للسيرفر
      await handleSaveMultipleImages(preparedImages);
    } catch (error) {
      console.error(error);
      setShareMessage('حدث خطأ أثناء رفع الصور الجماعي');
    } finally {
      setIsUploadingBulk(false);
      if (imageBulkInputRef.current) imageBulkInputRef.current.value = ''; // تصفير الـ input
      setTimeout(() => setShareMessage(''), 3000);
    }
  };
  // --- لوجيك إخفاء الهيدر عند السكرول (Figma Style) ---
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const lastScrollY = useRef(0);
  useEffect(() => {
    setVisibleCount(20);
  }, [
    searchQuery,
    selectedTags,
    selectedArtists,
    selectedTypes,
    aiFilter,
    showFavoritesOnly,
  ]);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // إذا سكرول لأسفل ومعدي مسافة 50 بكسل عشان ميتأثرش بالهزات البسيطة
      if (currentScrollY > lastScrollY.current && currentScrollY > 50) {
        setIsHeaderVisible(false); // إخفاء
      } else {
        setIsHeaderVisible(true); // إظهار عند السكرول لأعلى
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  // Detect scroll to hide title/description
  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const scrollTop = scrollContainerRef.current.scrollTop;
        setIsScrolled(scrollTop > 20);
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      handleScroll();
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [scrollContainerRef.current, images]);

  // Close sort dropdown when clicking outside
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

  // Close lightbox on escape key
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
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % sortedImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex(
      (prev) => (prev - 1 + sortedImages.length) % sortedImages.length,
    );
  };

  // Minimum swipe distance (in px) to be considered a swipe
  const minSwipeDistance = 50;

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null); // Reset touchEnd
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
      // Swipe left - go to previous image (RTL)
      prevImage();
    }
    if (isRightSwipe) {
      // Swipe right - go to next image (RTL)
      nextImage();
    }
  };

  const toggleFavorite = (imageId: ContentId) => {
    if (!user || !profile) {
      setShowLoginModal(true);
      return;
    }

    setFavoritedImages((prev) => {
      const isIn = prev.some((id) => String(id) === String(imageId));
      const newFavorites = isIn
        ? prev.filter((id) => String(id) !== String(imageId))
        : [...prev, imageId];
      return newFavorites;
    });
  };

  const downloadImage = (image: GalleryImage) => {
    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = image.src;
    link.download = `${image.title}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Multi-select helper functions
  const toggleImageSelection = (imageId: ContentId) => {
    setSelectedImages((prev) =>
      prev.some((id) => String(id) === String(imageId))
        ? prev.filter((id) => String(id) !== String(imageId))
        : [...prev, imageId],
    );
  };

  const selectAllImages = () => {
    setSelectedImages(sortedImages.map((img) => img.id));
  };

  const clearSelection = () => {
    setSelectedImages([]);
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedImages([]);
  };

  // Admin Functions
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
        setImages((prev) =>
          prev.filter((img) => String(img.id) !== String(id)),
        );
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
      const ids = selectedImages.filter(
        (id): id is string => typeof id === 'string',
      );
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
    const allVisibleIds = sortedImages.map((img) => img.id);
    if (selectedImages.length === allVisibleIds.length) {
      // Deselect all
      setSelectedImages([]);
    } else {
      // Select all
      setSelectedImages(allVisibleIds);
    }
  };

  const handleBulkEditSave = (updates: BulkImageUpdates) => {
    setImages((prev) =>
      prev.map((img) => {
        if (!selectedImages.some((sid) => String(sid) === String(img.id)))
          return img;

        const updatedImage = { ...img };

        // Apply artist if checked
        if (updates.applyArtist && updates.artist) {
          updatedImage.artist = updates.artist;
        }

        // Apply type if checked
        if (updates.applyType && updates.type) {
          updatedImage.type = updates.type;
        }

        // Apply AI status if checked
        if (updates.applyAiStatus) {
          updatedImage.aiGenerated = updates.aiGenerated;
        }

        // Apply tags if checked
        if (updates.applyTags) {
          if (updates.tagOperation === 'add') {
            // Add new tags without duplicates
            const newTags = [
              ...new Set([...updatedImage.tags, ...updates.tags]),
            ];
            updatedImage.tags = newTags;
          } else if (updates.tagOperation === 'replace') {
            // Replace all tags
            updatedImage.tags = updates.tags;
          } else if (updates.tagOperation === 'remove') {
            // Remove specified tags
            updatedImage.tags = updatedImage.tags.filter(
              (tag) => !updates.tags.includes(tag),
            );
          }
        }

        // Apply published status if checked
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
        setImages((prev) =>
          prev.map((img) => (img.id === updated.id ? updated : img)),
        );
        setShareMessage('تم التحديث بنجاح');
      } else {
        const created = await createImage(image, accessToken);
        setImages((prev) => [...prev, created]);
        setShareMessage('تمت الإضافة بنجاح');
      }
    } catch {
      setShareMessage('فشل الحفظ على الخادم');
    } finally {
      setTimeout(() => setShareMessage(''), 2000);
    }
  };

  const handleSaveMultipleImages = async (images: GalleryImage[]) => {
    const created = await Promise.allSettled(
      images.map((img) => createImage(img, accessToken)),
    );
    const ok = created
      .filter(
        (x): x is PromiseFulfilledResult<GalleryImage> =>
          x.status === 'fulfilled',
      )
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
            // Replace
            setImages(imported);
            setShareMessage('تم الاستيراد بنجاح (استبدال)');
          } else {
            // Merge
            const existingIds = new Set(images.map((img) => img.id));
            const newImages = imported.filter(
              (img: GalleryImage) => !existingIds.has(img.id),
            );
            setImages((prev) => [...prev, ...newImages]);
            setShareMessage(
              `تم الاستيراد بنجاح (${newImages.length} عنصر جديد)`,
            );
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

    // Reset input
    event.target.value = '';
  };

  const handleBatchDownload = () => {
    const toDownload = sortedImages.filter((img) =>
      selectedImages.some((sid) => String(sid) === String(img.id)),
    );
    toDownload.forEach((image) => downloadImage(image));

    setShareMessage(`تم تحميل ${toDownload.length} صورة`);
    setTimeout(() => setShareMessage(''), 3000);

    // Exit selection mode after download
    exitSelectionMode();
  };

  const handleBatchAddToFavorites = () => {
    if (!user || !profile) {
      setShowLoginModal(true);
      return;
    }

    // Add all selected images to favorites
    setFavoritedImages((prev) => {
      const newFavorites = [...prev];
      selectedImages.forEach((id) => {
        if (!newFavorites.some((x) => String(x) === String(id))) {
          newFavorites.push(id);
        }
      });
      return newFavorites;
    });

    // Show success message
    setShareMessage(`تم إضافة ${selectedImages.length} صورة إلى المفضلة`);
    setTimeout(() => setShareMessage(''), 3000);

    // Exit selection mode
    exitSelectionMode();
  };

  // Filter image categories based on selected tags and search query
  const filteredImages = useMemo(() => {
    return images.filter((image) => {
      // Filter by published status - hide unpublished images for non-editor users
      if (!isEditor && !image.published) {
        return false;
      }

      // Filter by search query
      const matchesSearch =
        searchQuery === '' ||
        image.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        image.tags.some((tag) =>
          tag.toLowerCase().includes(searchQuery.toLowerCase()),
        );

      // Filter by tags
      const matchesTags =
        selectedTags.length === 0 ||
        selectedTags.some((tag) => image.tags.includes(tag));

      // Filter by artists
      const matchesArtists =
        selectedArtists.length === 0 || selectedArtists.includes(image.artist);

      // Filter by types
      const matchesTypes =
        selectedTypes.length === 0 || selectedTypes.includes(image.type);

      // Filter by AI generated
      const matchesAi =
        aiFilter === 'all' ||
        (aiFilter === 'yes' && image.aiGenerated) ||
        (aiFilter === 'no' && !image.aiGenerated);

      // Filter by favorites
      const matchesFavorites =
        !showFavoritesOnly ||
        favoritedImages.some((f) => String(f) === String(image.id));

      return (
        matchesSearch &&
        matchesTags &&
        matchesArtists &&
        matchesTypes &&
        matchesAi &&
        matchesFavorites
      );
    });
  }, [
    images,
    selectedTags,
    selectedArtists,
    selectedTypes,
    aiFilter,
    searchQuery,
    showFavoritesOnly,
    favoritedImages,
    isEditor,
  ]);

  // Sort filtered categories based on sort key and order
  const sortedImages = useMemo(() => {
    return [...filteredImages].sort((a, b) => {
      if (sortBy === 'alpha-asc') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'alpha-desc') {
        return b.title.localeCompare(a.title);
      } else if (sortBy === 'date-asc') {
        return (
          new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime()
        );
      } else if (sortBy === 'date-desc') {
        return (
          new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
        );
      }
      return 0;
    });
  }, [filteredImages, sortBy]);
  const displayedImages = useMemo(() => {
    return sortedImages.slice(0, visibleCount);
  }, [sortedImages, visibleCount]);

  useEffect(() => {
    setVisibleCount(20);
  }, [
    searchQuery,
    selectedTags,
    selectedArtists,
    selectedTypes,
    aiFilter,
    showFavoritesOnly,
  ]);

  const handleLogin = () => {
    setShowLoginModal(false);
    // Dispatch custom event to open the login modal
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
      {/* Sticky Header Section */}
      <div className="sticky top-0 bg-background z-40 pb-3 sm:pb-4 border-b border-border/50">
        <div
          className={`transition-all duration-500 ease-in-out overflow-hidden ${
            isScrolled
              ? 'max-h-0 opacity-0 mb-0 pointer-events-none transform -translate-y-2'
              : 'max-h-[250px] opacity-100 mb-4 transform translate-y-0'
          }`}
        >
          <div>
            <h1 className="mb-2 font-bold text-[36px]">مكتبة الصور</h1>
            <p className="text-muted-foreground leading-relaxed">
              مجموعة شاملة من الصور والأيقونات الكنسية والمناظر الطبيعية. استخدم
              البحث والفلاتر للعثور على الصور حسب النوع أو الفنان أو الموضوع،
              واعرض معرض الصور بوضع ملء الشاشة، وأضف المفضلات لديك، وحمّل الصور
              للاستخدام في الخدمة.
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
                {/* Manual Add button in the format of a group upload button */}
                <button
                  type="button"
                  onClick={handleAddNew}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-50"
                  title="إضافة صورة يدوية واحدة"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة صورة يدوية</span>
                </button>

                {/* 3. زر التحديد المتعدد */}
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

                {/* 4. زر تصدير JSON */}
                <button
                  type="button"
                  onClick={handleExport}
                  className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg hover:bg-muted transition-colors text-sm"
                  title="تصدير JSON"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير</span>
                </button>

                {/* 5. زر استيراد JSON */}
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

        {/* Bulk Actions Bar */}
        {isEditor && bulkEditMode && selectedImages.length > 0 && (
          <div className="mt-4 p-3 bg-primary/10 border border-primary rounded-xl flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-medium">
              {selectedImages.length} عنصر محدد
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleSelectAllImages}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors text-sm"
              >
                <CheckCheck className="w-4 h-4" />
                {selectedImages.length === sortedImages.length
                  ? 'إلغاء الكل'
                  : 'تحديد الكل'}
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
            <div
              className="relative flex items-center gap-2 sm:gap-3 w-full sm:w-auto"
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
                />
              </div>

              {/* Artist Filter */}
              <div className="flex-1 sm:flex-initial">
                <MultiSelectFilter
                  label="الفنانون"
                  options={allArtists}
                  selectedOptions={selectedArtists}
                  onOptionsChange={setSelectedArtists}
                  icon={User}
                />
              </div>

              {/* Type Filter */}
              <div className="flex-1 sm:flex-initial">
                <MultiSelectFilter
                  label="النواع"
                  options={allTypes}
                  selectedOptions={selectedTypes}
                  onOptionsChange={setSelectedTypes}
                  icon={ImageIcon}
                />
              </div>

              {/* AI Generated Filter */}
              <div className="flex-1 sm:flex-initial">
                <AIGeneratedFilter value={aiFilter} onChange={setAiFilter} />
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
                  title={
                    showFavoritesOnly ? 'إظهار كل الصور' : 'عرض المفضلة فقط'
                  }
                >
                  <Heart
                    className={`w-4 h-4 flex-shrink-0 transition-all ${showFavoritesOnly ? 'fill-current' : ''}`}
                  />
                  <span className="text-sm hidden lg:inline">المفضلة فقط</span>
                  {showFavoritesOnly && favoritedImages.length > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-2 py-0.5">
                      {favoritedImages.length}
                    </span>
                  )}
                </button>
              )}

              {/* Results Count Info Chip */}
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] bg-muted/50 border border-border/50 rounded-xl pointer-events-none">
                <ImageIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">
                  {sortedImages.length} / {images.length}
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
                className="flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-card border border-border rounded-xl hover:bg-muted transition-colors text-sm w-full sm:w-auto justify-between"
              >
                <ArrowUpDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span>
                  {sortOptions.find((option) => option.value === sortBy)?.label}
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform flex-shrink-0 ${isSortDropdownOpen ? 'rotate-180' : ''}`}
                />
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
        {/* Image Gallery Grid */}
        <ResponsiveMasonry
          columnsCountBreakPoints={{ 350: 1, 750: 2, 900: 3, 1200: 4 }}
        >
          <Masonry gutter="16px">
            {sortedImages.length > 0 ? (
              sortedImages.map((image, index) => (
                <div
                  key={image.id}
                  className={`group relative overflow-hidden rounded-xl bg-card border cursor-pointer transition-all ${
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
                  {/* Image */}
                  {(() => {
                    const baseUrl = getApiBaseUrl();
                    const fullImageUrl =
                      image.src.startsWith('http') ||
                      image.src.startsWith('data:')
                        ? image.src
                        : `${baseUrl}${image.src.startsWith('/') ? '' : '/'}${image.src}`;

                    return (
                      <img
                        src={fullImageUrl}
                        alt={image.title}
                        loading="lazy"
                        className="w-full h-auto object-cover transition-transform duration-300"
                      />
                    );
                  })()}

                  {/* Unpublished Badge - Only visible to editors/admins - TOP RIGHT */}
                  {isEditor &&
                    !image.published &&
                    !(isSelectionMode || bulkEditMode) && (
                      <div className="absolute top-3 right-3 z-10">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 text-white rounded-lg shadow-lg text-xs font-semibold">
                          <Eye className="w-3.5 h-3.5" />
                          <span>مخفية</span>
                        </div>
                      </div>
                    )}

                  {/* Selection Checkbox - Shows ONLY in selection mode or bulk edit mode */}
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
                          selectedImages.some(
                            (x) => String(x) === String(image.id),
                          )
                            ? 'bg-primary border-primary'
                            : 'border-white bg-white/90 hover:bg-white'
                        }`}
                      >
                        {selectedImages.some(
                          (x) => String(x) === String(image.id),
                        ) && (
                          <Check className="w-4 h-4 text-primary-foreground" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Overlay - Shows on hover OR when favorited (for heart button visibility) */}
                  {!isSelectionMode && !bulkEditMode && (
                    <>
                      {/* Background overlay - only on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        {/* Bottom buttons - Download for regular users, Edit/Delete/Download for editors */}
                        <div className="flex items-center gap-2">
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

                      {/* Heart button - Always visible when favorited, only on hover when not favorited */}
                      <div
                        className={`absolute top-3 left-3 z-10 transition-opacity duration-300 ${
                          favoritedImages.includes(image.id)
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
                            favoritedImages.includes(image.id)
                              ? 'bg-red-500 text-white'
                              : 'bg-white/90 hover:bg-white text-black'
                          }`}
                        >
                          <Heart
                            className={`w-4 h-4 ${favoritedImages.includes(image.id) ? 'fill-current' : ''}`}
                          />
                        </button>
                      </div>
                    </>
                  )}

                  {/* Selection overlay - Show when image is selected */}
                  {(isSelectionMode || bulkEditMode) &&
                    selectedImages.some(
                      (x) => String(x) === String(image.id),
                    ) && (
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
      </div>

      {/* Lightbox Modal */}
      {lightboxOpen && sortedImages.length > 0 && (
        <div
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-[300]"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close button */}
          <button
            className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-full p-3 transition-colors z-10"
            onClick={() => setLightboxOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Image info header */}
          <div className="absolute top-4 right-4 left-20 bg-black/60 backdrop-blur-sm text-white rounded-xl p-4 z-10 max-w-2xl">
            <h2 className="font-bold mb-1">
              {sortedImages[currentImageIndex].title}
            </h2>
            <div className="flex items-center gap-2 text-xs text-white/70 flex-wrap">
              <span>الفنان: </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const artist = getArtistByName(
                    sortedImages[currentImageIndex].artist,
                  );
                  if (artist) {
                    setSelectedArtistName(
                      sortedImages[currentImageIndex].artist,
                    );
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

          {/* Action buttons at bottom */}
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
                favoritedImages.some(
                  (f) =>
                    String(f) === String(sortedImages[currentImageIndex].id),
                )
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
            >
              <Heart
                className={`w-5 h-5 ${favoritedImages.some((f) => String(f) === String(sortedImages[currentImageIndex].id)) ? 'fill-current' : ''}`}
              />
              <span>
                {favoritedImages.some(
                  (f) =>
                    String(f) === String(sortedImages[currentImageIndex].id),
                )
                  ? 'مفضلة'
                  : 'إضافة للمفضلة'}
              </span>
            </button>
          </div>

          {/* Navigation buttons */}
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

          {/* Image counter */}
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white rounded-full px-4 py-2 text-sm z-10">
            {currentImageIndex + 1} / {sortedImages.length}
          </div>

          {/* Main image - centered with proper fitting */}
          <div
            className="absolute inset-0 flex items-center justify-center px-4 py-32 md:px-20"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {(() => {
              const baseUrl = getApiBaseUrl();
              const currentSrc = sortedImages[currentImageIndex].src;
              const fullLightboxUrl =
                currentSrc.startsWith('http') || currentSrc.startsWith('data:')
                  ? currentSrc
                  : `${baseUrl}${currentSrc.startsWith('/') ? '' : '/'}${currentSrc}`;

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

      {/* Share Message */}
      {shareMessage && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-xl shadow-lg z-50 animate-fade-in">
          {shareMessage}
        </div>
      )}

      {/* Selection Mode Bottom Bar */}
      {isSelectionMode && (
        <div
          className={`fixed bottom-0 left-8 right-8 z-[100] bg-card border-t border-border shadow-2xl animate-in slide-in-from-bottom duration-300 pb-safe transition-all ${
            isSidebarCollapsed ? 'lg:mr-20' : 'lg:mr-64'
          }`}
        >
          {/* Desktop Bar */}
          <div className="hidden sm:flex items-center justify-between gap-4 p-4">
            {/* Left Side - Counter */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {selectedImages.length} من {sortedImages.length} محدد
              </span>
            </div>

            {/* Right Side - Actions */}
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

          {/* Mobile Bar */}
          <div className="sm:hidden">
            {/* Counter and Cancel on same row */}
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
              <p className="text-sm font-medium">
                {selectedImages.length} من {sortedImages.length} محدد
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

              {/* Download and Favorite side by side */}
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

      {/* Login Required Modal */}
      <LoginRequiredModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginClick={handleLogin}
      />

      {/* Artist Profile Modal */}
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
        favoritedImages={favoritedImages as any}
        onToggleFavorite={toggleFavorite as any}
        onDownloadImage={downloadImage as any}
      />

      {/* Admin Edit Modal */}
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

      {/* Admin Bulk Edit Modal */}
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

      {/* Video Tutorial Modal */}
      <VideoModal
        isOpen={isVideoModalOpen}
        onClose={() => setIsVideoModalOpen(false)}
        videoUrl="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
        title="شرح استخدام مكتبة الصور"
      />
    </div>
  );
}
