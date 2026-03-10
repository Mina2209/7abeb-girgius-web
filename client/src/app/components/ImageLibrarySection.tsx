import { Download, Eye, ArrowUpDown, Search, ChevronDown, X, ChevronLeft, ChevronRight, Heart, Sparkles, Tags, User, Image as ImageIcon, Check, Plus, Edit2, Trash2, Upload, CheckSquare, Square, CheckCheck, Video } from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
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
import { AdminBulkEditImagesModal, BulkImageUpdates } from './AdminBulkEditImagesModal';
import { VideoModal } from './VideoModal';

interface GalleryImage {
  id: number;
  src: string;
  title: string;
  tags: string[];
  artist: string;
  type: string;
  aiGenerated: boolean;
  uploadDate: string;
  published: boolean;
}

const defaultGalleryImages: GalleryImage[] = [
  {
    id: 1,
    src: 'https://images.unsplash.com/photo-1764010572690-8b3ab023d9a0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaHVyY2glMjBjaGlsZHJlbiUyMGpveXxlbnwxfHx8fDE3NjgzMjM0MjB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'فرح الطفولة',
    tags: ['الأطفال', 'الفرح', 'الحياة الكنسية'],
    artist: 'أمير موريس',
    type: 'صورة مرسومة',
    aiGenerated: false,
    uploadDate: '2024-03-15',
    published: true,
  },
  {
    id: 2,
    src: 'https://images.unsplash.com/photo-1556760647-90d218f7ca5b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcmF5ZXIlMjBtZWRpdGF0aW9uJTIwZmFpdGh8ZW58MXx8fHwxNzY4MzIzNDIwfDA&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'التأمل والصلاة',
    tags: ['الصلاة', 'التأمل', 'الإيمان'],
    artist: 'Kevin Carden',
    type: 'صورة مصورة',
    aiGenerated: true,
    uploadDate: '2024-03-14',
    published: true,
  },
  {
    id: 3,
    src: 'https://images.unsplash.com/photo-1767411972023-b15cecf74e7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW1pbHklMjBsb3ZlJTIwdG9nZXRoZXJuZXNzfGVufDF8fHx8MTc2ODMyMzQyMHww&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'محبة الأسرة',
    tags: ['الأسرة', 'المحبة', 'الحياة الكنسية'],
    artist: 'مينا انطون',
    type: 'فن قبطى',
    aiGenerated: false,
    uploadDate: '2024-03-13',
    published: true,
  },
  {
    id: 4,
    src: 'https://images.unsplash.com/photo-1584727638096-042c45049ebe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZWxpZ2lvdXMlMjBhcnQlMjBwYWludGluZ3xlbnwxfHx8fDE3NjgzMDQwMjV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'الإيمان والرجاء',
    tags: ['الإيمان', 'الرجاء', 'التأمل'],
    artist: 'أمير موريس',
    type: 'صورة تلوين',
    aiGenerated: true,
    uploadDate: '2024-03-12',
    published: true,
  },
  {
    id: 5,
    src: 'https://images.unsplash.com/photo-1764010572690-8b3ab023d9a0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaHVyY2glMjBjaGlsZHJlbiUyMGpveXxlbnwxfHx8fDE3NjgzMjM0MjB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'براءة الطفولة',
    tags: ['الأطفال', 'الفرح', 'البراءة'],
    artist: 'Kevin Carden',
    type: 'صورة مرسومة',
    aiGenerated: false,
    uploadDate: '2024-03-11',
    published: true,
  },
  {
    id: 6,
    src: 'https://images.unsplash.com/photo-1556760647-90d218f7ca5b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcmF5ZXIlMjBtZWRpdGF0aW9uJTIwZmFpdGh8ZW58MXx8fHwxNzY4MzIzNDIwfDA&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'قوة الصلاة',
    tags: ['الصلاة', 'القوة', 'الإيمان'],
    artist: 'مينا انطون',
    type: 'صورة مصورة',
    aiGenerated: true,
    uploadDate: '2024-03-10',
    published: true,
  },
  {
    id: 7,
    src: 'https://images.unsplash.com/photo-1767411972023-b15cecf74e7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW1pbHklMjBsb3ZlJTIwdG9nZXRoZXJuZXNzfGVufDF8fHx8MTc2ODMyMzQyMHww&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'حب العائلة',
    tags: ['الأسرة', 'المحبة', 'الأطفال'],
    artist: 'أمير موريس',
    type: 'فن قبطى',
    aiGenerated: false,
    uploadDate: '2024-03-09',
    published: true,
  },
  {
    id: 8,
    src: 'https://images.unsplash.com/photo-1584727638096-042c45049ebe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZWxpZ2lvdXMlMjBhcnQlMjBwYWludGluZ3xlbnwxfHx8fDE3NjgzMDQwMjV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'السلام الداخلي',
    tags: ['السلام', 'التأمل', 'الصلاة'],
    artist: 'Kevin Carden',
    type: 'صورة تلوين',
    aiGenerated: false,
    uploadDate: '2024-03-08',
    published: true,
  },
  {
    id: 9,
    src: 'https://images.unsplash.com/photo-1764010572690-8b3ab023d9a0?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaHVyY2glMjBjaGlsZHJlbiUyMGpveXxlbnwxfHx8fDE3NjgzMjM0MjB8MA&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'الفرح بالرب',
    tags: ['الفرح', 'الإيمان', 'الأطفال'],
    artist: 'مينا انطون',
    type: 'صورة مرسومة',
    aiGenerated: true,
    uploadDate: '2024-03-07',
    published: true,
  },
  {
    id: 10,
    src: 'https://images.unsplash.com/photo-1556760647-90d218f7ca5b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcmF5ZXIlMjBtZWRpdGF0aW9uJTIwZmFpdGh8ZW58MXx8fHwxNzY4MzIzNDIwfDA&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'محبة الله',
    tags: ['المحبة', 'الإيمان', 'الصلاة'],
    artist: 'أمير موريس',
    type: 'صورة مصورة',
    aiGenerated: false,
    uploadDate: '2024-03-06',
    published: true,
  },
  {
    id: 11,
    src: 'https://images.unsplash.com/photo-1767411972023-b15cecf74e7a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxmYW1pbHklMjBsb3ZlJTIwdG9nZXRoZXJuZXNzfGVufDF8fHx8MTc2ODMyMzQyMHww&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'بركة الأطفال',
    tags: ['الأطفال', 'البركة', 'الحياة الكنسية'],
    artist: 'Kevin Carden',
    type: 'فن قبطى',
    aiGenerated: true,
    uploadDate: '2024-03-05',
    published: true,
  },
  {
    id: 12,
    src: 'https://images.unsplash.com/photo-1584727638096-042c45049ebe?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxyZWxpZ2lvdXMlMjBhcnQlMjBwYWludGluZ3xlbnwxfHx8fDE3NjgzMDQwMjV8MA&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'النعمة الإلهية',
    tags: ['النعمة', 'الإيمان', 'التأمل'],
    artist: 'مينا انطون',
    type: 'صورة تلوين',
    aiGenerated: false,
    uploadDate: '2024-03-04',
    published: true,
  },
  // Unpublished images (only visible to admins)
  {
    id: 13,
    src: 'https://images.unsplash.com/photo-1651774031266-867983eccc83?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaHVyY2glMjB3b3JzaGlwJTIwY2FuZGxlc3xlbnwxfHx8fDE3NjgzMjM1ODF8MA&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'شموع العبادة',
    tags: ['العبادة', 'الصلاة', 'الحياة الكنسية'],
    artist: 'أمير موريس',
    type: 'صورة مصورة',
    aiGenerated: false,
    uploadDate: '2024-03-03',
    published: false,
  },
  {
    id: 14,
    src: 'https://images.unsplash.com/photo-1766306252230-d1e3026f4f66?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxiaWJsZSUyMHNjcmlwdHVyZSUyMHJlYWRpbmd8ZW58MXx8fHwxNzY4MzIzNTgyfDA&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'قراءة الكتاب المقدس',
    tags: ['الكتاب المقدس', 'القراءة', 'التأمل'],
    artist: 'Kevin Carden',
    type: 'صورة مصورة',
    aiGenerated: false,
    uploadDate: '2024-03-02',
    published: false,
  },
  {
    id: 15,
    src: 'https://images.unsplash.com/photo-1760319726429-fcda77d3cb05?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjaHVyY2glMjBzZXJ2aWNlJTIwY29tbXVuaXR5fGVufDF8fHx8MTc2ODMyMzU4Mnww&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'خدمة الكنيسة',
    tags: ['الخدمة', 'المجتمع', 'الحياة الكنسية'],
    artist: 'مينا انطون',
    type: 'صورة مصورة',
    aiGenerated: false,
    uploadDate: '2024-03-01',
    published: false,
  },
  {
    id: 16,
    src: 'https://images.unsplash.com/photo-1666097296328-28bdb4800a5a?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjcm9zcyUyMGZhaXRoJTIwc3Bpcml0dWFsaXR5fGVufDF8fHx8MTc2ODMyMzU4Mnww&ixlib=rb-4.1.0&q=80&w=1080',
    title: 'الصليب المقدس',
    tags: ['الصليب', 'الإيمان', 'الروحانية'],
    artist: 'أمير موريس',
    type: 'صورة مرسومة',
    aiGenerated: false,
    uploadDate: '2024-02-28',
    published: false,
  },
];

const STORAGE_KEY = 'gallery_images_data';
const STORAGE_VERSION_KEY = 'gallery_images_version';
const CURRENT_VERSION = '2.0'; // Increment this to force reload of default images

type SortOption = 'alpha-asc' | 'alpha-desc' | 'date-asc' | 'date-desc';

const sortOptions = [
  { value: 'alpha-asc' as SortOption, label: 'أبجدياً (أ - ي)' },
  { value: 'alpha-desc' as SortOption, label: 'أبجدياً (ي - أ)' },
  { value: 'date-asc' as SortOption, label: 'الأقدم' },
  { value: 'date-desc' as SortOption, label: 'الأحدث' },
];

export function ImageLibrarySection({ isSidebarCollapsed }: { isSidebarCollapsed: boolean }) {
  const { user, profile } = useAuth();
  const isEditor = useIsEditor();

  // Load images from localStorage or use defaults (with version checking)
  const [images, setImages] = useState<GalleryImage[]>(() => {
    const savedVersion = localStorage.getItem(STORAGE_VERSION_KEY);
    const saved = localStorage.getItem(STORAGE_KEY);
    
    // If version doesn't match or no version exists, use defaults and update version
    if (savedVersion !== CURRENT_VERSION) {
      localStorage.setItem(STORAGE_VERSION_KEY, CURRENT_VERSION);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(defaultGalleryImages));
      return defaultGalleryImages;
    }
    
    // Otherwise load from localStorage
    return saved ? JSON.parse(saved) : defaultGalleryImages;
  });

  // Get unique artists, tags, and types from current images
  const allArtists = useMemo(() => Array.from(new Set(images.map(img => img.artist))), [images]);
  const allTypes = useMemo(() => Array.from(new Set(images.map(img => img.type))), [images]);
  const allTags = useMemo(() => Array.from(new Set(images.flatMap(img => img.tags))), [images]);

  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [aiFilter, setAiFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [favoritedImages, setFavoritedImages] = useState<number[]>([]);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<number[]>([]);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  // Artist Profile Modal state
  const [artistProfileOpen, setArtistProfileOpen] = useState(false);
  const [selectedArtistName, setSelectedArtistName] = useState<string | null>(null);

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

  // Save to localStorage whenever images change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(images));
  }, [images]);

  // Load favorites from localStorage on mount
  useEffect(() => {
    if (user && profile) {
      const saved = localStorage.getItem('favoriteImages');
      if (saved) {
        setFavoritedImages(JSON.parse(saved));
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
    setCurrentImageIndex((prev) => (prev - 1 + sortedImages.length) % sortedImages.length);
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

  const toggleFavorite = (imageId: number) => {
    if (!user || !profile) {
      setShowLoginModal(true);
      return;
    }
    
    setFavoritedImages(prev => {
      const newFavorites = prev.includes(imageId) 
        ? prev.filter(id => id !== imageId) 
        : [...prev, imageId];
      
      // Save to localStorage
      localStorage.setItem('favoriteImages', JSON.stringify(newFavorites));
      
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
  const toggleImageSelection = (imageId: number) => {
    setSelectedImages(prev =>
      prev.includes(imageId)
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  };

  const selectAllImages = () => {
    setSelectedImages(sortedImages.map(img => img.id));
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

  const handleDelete = (id: number) => {
    if (confirm('هل أنت متأكد من حذف هذه الصورة؟')) {
      setImages(prev => prev.filter(img => img.id !== id));
      setShareMessage('تم الحذف بنجاح');
      setTimeout(() => setShareMessage(''), 2000);
    }
  };

  const handleBulkDelete = () => {
    if (selectedImages.length === 0) return;
    if (confirm(`هل أنت متأكد من حذف ${selectedImages.length} صورة؟`)) {
      setImages(prev => prev.filter(img => !selectedImages.includes(img.id)));
      setSelectedImages([]);
      setBulkEditMode(false);
      setShareMessage('تم الحذف بنجاح');
      setTimeout(() => setShareMessage(''), 2000);
    }
  };

  const handleBulkPublish = () => {
    if (selectedImages.length === 0) return;
    setImages(prev => prev.map(img => 
      selectedImages.includes(img.id) ? { ...img, published: true } : img
    ));
    setSelectedImages([]);
    setBulkEditMode(false);
    setShareMessage(`تم نشر ${selectedImages.length} صورة`);
    setTimeout(() => setShareMessage(''), 2000);
  };

  const handleBulkHide = () => {
    if (selectedImages.length === 0) return;
    setImages(prev => prev.map(img => 
      selectedImages.includes(img.id) ? { ...img, published: false } : img
    ));
    setSelectedImages([]);
    setBulkEditMode(false);
    setShareMessage(`تم إخفاء ${selectedImages.length} صورة`);
    setTimeout(() => setShareMessage(''), 2000);
  };

  const handleSelectAllImages = () => {
    const allVisibleIds = sortedImages.map(img => img.id);
    if (selectedImages.length === allVisibleIds.length) {
      // Deselect all
      setSelectedImages([]);
    } else {
      // Select all
      setSelectedImages(allVisibleIds);
    }
  };

  const handleBulkEditSave = (updates: BulkImageUpdates) => {
    setImages(prev => prev.map(img => {
      if (!selectedImages.includes(img.id)) return img;
      
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
          const newTags = [...new Set([...updatedImage.tags, ...updates.tags])];
          updatedImage.tags = newTags;
        } else if (updates.tagOperation === 'replace') {
          // Replace all tags
          updatedImage.tags = updates.tags;
        } else if (updates.tagOperation === 'remove') {
          // Remove specified tags
          updatedImage.tags = updatedImage.tags.filter(tag => !updates.tags.includes(tag));
        }
      }
      
      // Apply published status if checked
      if (updates.applyPublished) {
        updatedImage.published = updates.published;
      }
      
      return updatedImage;
    }));
    
    setIsBulkEditModalOpen(false);
    setSelectedImages([]);
    setBulkEditMode(false);
    setShareMessage('تم تحديث الصور بنجاح');
    setTimeout(() => setShareMessage(''), 2000);
  };

  const handleSaveImage = (image: GalleryImage) => {
    if (editingImage) {
      // Update existing
      setImages(prev => prev.map(img => img.id === image.id ? image : img));
      setShareMessage('تم التحديث بنجاح');
    } else {
      // Add new
      setImages(prev => [...prev, image]);
      setShareMessage('تمت الإضافة بنجاح');
    }
    setTimeout(() => setShareMessage(''), 2000);
  };

  const handleSaveMultipleImages = (images: GalleryImage[]) => {
    setImages(prev => [...prev, ...images]);
    setShareMessage(`تمت إضافة ${images.length} صورة بنجاح`);
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
          if (confirm('هل تريد استبدال البيانات الحالية أم دمجها?\n\nاضغط OK للاستبدال، أو Cancel للدمج')) {
            // Replace
            setImages(imported);
            setShareMessage('تم الاستيراد بنجاح (استبدال)');
          } else {
            // Merge
            const existingIds = new Set(images.map(img => img.id));
            const newImages = imported.filter((img: GalleryImage) => !existingIds.has(img.id));
            setImages(prev => [...prev, ...newImages]);
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
    
    // Reset input
    event.target.value = '';
  };

  const handleBatchDownload = () => {
    // Download all selected images
    const selectedImages = sortedImages.filter(img => selectedImages.includes(img.id));
    selectedImages.forEach(image => downloadImage(image));
    
    // Show success message
    setShareMessage(`تم تحميل ${selectedImages.length} صورة`);
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
    setFavoritedImages(prev => {
      const newFavorites = [...prev];
      selectedImages.forEach(id => {
        if (!newFavorites.includes(id)) {
          newFavorites.push(id);
        }
      });
      
      // Save to localStorage
      localStorage.setItem('favoriteImages', JSON.stringify(newFavorites));
      
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
    return images.filter(image => {
      // Filter by published status - hide unpublished images for non-editor users
      if (!isEditor && !image.published) {
        return false;
      }

      // Filter by search query
      const matchesSearch = searchQuery === '' || 
        image.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        image.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));

      // Filter by tags
      const matchesTags = selectedTags.length === 0 || 
        selectedTags.some(tag => image.tags.includes(tag));

      // Filter by artists
      const matchesArtists = selectedArtists.length === 0 || 
        selectedArtists.includes(image.artist);

      // Filter by types
      const matchesTypes = selectedTypes.length === 0 || 
        selectedTypes.includes(image.type);

      // Filter by AI generated
      const matchesAi = aiFilter === 'all' || 
        (aiFilter === 'yes' && image.aiGenerated) ||
        (aiFilter === 'no' && !image.aiGenerated);

      // Filter by favorites
      const matchesFavorites = !showFavoritesOnly || favoritedImages.includes(image.id);

      return matchesSearch && matchesTags && matchesArtists && matchesTypes && matchesAi && matchesFavorites;
    });
  }, [images, selectedTags, selectedArtists, selectedTypes, aiFilter, searchQuery, showFavoritesOnly, favoritedImages, isEditor]);

  // Sort filtered categories based on sort key and order
  const sortedImages = useMemo(() => {
    return [...filteredImages].sort((a, b) => {
      if (sortBy === 'alpha-asc') {
        return a.title.localeCompare(b.title);
      } else if (sortBy === 'alpha-desc') {
        return b.title.localeCompare(a.title);
      } else if (sortBy === 'date-asc') {
        return new Date(a.uploadDate).getTime() - new Date(b.uploadDate).getTime();
      } else if (sortBy === 'date-desc') {
        return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
      }
      return 0;
    });
  }, [filteredImages, sortBy]);

  const handleLogin = () => {
    setShowLoginModal(false);
    // Dispatch custom event to open the login modal
    window.dispatchEvent(new CustomEvent('openLoginModal'));
  };

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
            <h1 className="mb-2 font-bold text-[36px]">مكتبة الصور</h1>
            <p className="text-muted-foreground">
              مجموعة شاملة من الصور والأيقونات الكنسية والمناظر الطبيعية. استخدم البحث والفلاتر للعثور على الصور حسب النوع أو الفنان أو الموضوع، واعرض معرض الصور بوضع ملء الشاشة، وأضف المفضلات لديك، وحمّل الصور للاستخدام في الخدمة.
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
                  title="إضافة صورة جديدة"
                >
                  <Plus className="w-4 h-4" />
                  <span>جديد</span>
                </button>
                <button
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
                  <span>است��راد</span>
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
                {selectedImages.length === sortedImages.length ? 'إلغاء الكل' : 'تحديد الكل'}
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
                <AIGeneratedFilter
                  value={aiFilter}
                  onChange={setAiFilter}
                />
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
                  title={showFavoritesOnly ? 'إظهار كل الصور' : 'عرض المفضلة فقط'}
                >
                  <Heart className={`w-4 h-4 flex-shrink-0 transition-all ${showFavoritesOnly ? 'fill-current' : ''}`} />
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
        {/* Image Gallery Grid */}
        <ResponsiveMasonry
          columnsCountBreakPoints={{350: 1, 750: 2, 900: 3, 1200: 4}}
        >
          <Masonry gutter="16px">
            {sortedImages.length > 0 ? (
              sortedImages.map((image, index) => (
                <div
                  key={image.id}
                  className={`group relative overflow-hidden rounded-xl bg-card border cursor-pointer transition-all ${
                    (isSelectionMode || bulkEditMode) && selectedImages.includes(image.id)
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
                  <img
                    src={image.src}
                    alt={image.title}
                    className="w-full h-auto object-cover transition-transform duration-300"
                  />
                  
                  {/* Unpublished Badge - Only visible to editors/admins - TOP RIGHT */}
                  {isEditor && !image.published && !(isSelectionMode || bulkEditMode) && (
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
                          selectedImages.includes(image.id)
                            ? 'bg-primary border-primary'
                            : 'border-white bg-white/90 hover:bg-white'
                        }`}
                      >
                        {selectedImages.includes(image.id) && (
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
                          favoritedImages.includes(image.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
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
                          <Heart className={`w-4 h-4 ${favoritedImages.includes(image.id) ? 'fill-current' : ''}`} />
                        </button>
                      </div>
                    </>
                  )}
                  
                  {/* Selection overlay - Show when image is selected */}
                  {(isSelectionMode || bulkEditMode) && selectedImages.includes(image.id) && (
                    <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
                  )}
                </div>
              ))
            ) : (
              <div className="col-span-full text-center py-12 bg-card rounded-xl border border-border">
                <p className="text-muted-foreground">لا توجد صور مطابقة للبحث أو التصنيفات المحددة</p>
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
            <p className="text-sm text-white/80 mt-2">{sortedImages[currentImageIndex].tags.join(', ')}</p>
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
                favoritedImages.includes(sortedImages[currentImageIndex].id)
                  ? 'bg-red-500 hover:bg-red-600 text-white'
                  : 'bg-white/20 hover:bg-white/30 text-white'
              }`}
            >
              <Heart className={`w-5 h-5 ${favoritedImages.includes(sortedImages[currentImageIndex].id) ? 'fill-current' : ''}`} />
              <span>{favoritedImages.includes(sortedImages[currentImageIndex].id) ? 'مفضلة' : 'إضافة للمفضلة'}</span>
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
            <img
              src={sortedImages[currentImageIndex].src}
              alt={sortedImages[currentImageIndex].title}
              className="max-w-full max-h-full object-contain"
            />
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
        <div className={`fixed bottom-0 left-8 right-8 z-[100] bg-card border-t border-border shadow-2xl animate-in slide-in-from-bottom duration-300 pb-safe transition-all duration-300 ${
          isSidebarCollapsed ? 'lg:mr-20' : 'lg:mr-64'
        }`}>
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
        artist={selectedArtistName ? getArtistByName(selectedArtistName) : null}
        images={images}
        onImageClick={openLightbox}
        favoritedImages={favoritedImages}
        onToggleFavorite={toggleFavorite}
        onDownloadImage={downloadImage}
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