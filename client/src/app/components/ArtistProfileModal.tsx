import { X, Edit2, Facebook, Instagram, Globe, Mail, Calendar, Tag, Download, Heart, Check, User } from 'lucide-react';
import { Artist } from '../data/artists';
import { useState, useMemo } from 'react';
import Masonry, { ResponsiveMasonry } from 'react-responsive-masonry';
import { useAuth } from '../contexts/AuthContext';
import { getImageUrl } from '../utils/getImageUrl';

interface GalleryImage {
  id: number;
  src: string;
  title: string;
  tags: string[];
  artist: string;
  type: string;
  aiGenerated: boolean;
  uploadDate: string;
}

interface ArtistProfileModalProps {
  artist: Artist | null;
  images: GalleryImage[];
  isOpen: boolean;
  onClose: () => void;
  onImageClick: (index: number) => void;
  favoritedImages: number[];
  onToggleFavorite: (imageId: number) => void;
  onDownloadImage: (image: GalleryImage) => void;
  isEditor?: boolean;
  onEditArtist?: () => void;
}

export function ArtistProfileModal({
  artist,
  images,
  isOpen,
  onClose,
  onImageClick,
  favoritedImages,
  onToggleFavorite,
  onDownloadImage,
  isEditor,
  onEditArtist,
}: ArtistProfileModalProps) {
  const { user, profile } = useAuth();
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<number[]>([]);

  // Filter images by this artist
  const artistImages = useMemo(() => {
    if (!artist) return [];
    return images.filter(img => img.artist === artist.name);
  }, [images, artist]);

  if (!isOpen || !artist) return null;

  const toggleImageSelection = (imageId: number) => {
    setSelectedImages(prev =>
      prev.includes(imageId)
        ? prev.filter(id => id !== imageId)
        : [...prev, imageId]
    );
  };

  const selectAllImages = () => {
    setSelectedImages(artistImages.map(img => img.id));
  };

  const clearSelection = () => {
    setSelectedImages([]);
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedImages([]);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-[1000] flex items-center justify-center p-4 overflow-hidden">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-full p-3 transition-colors z-10"
        aria-label="إغلاق"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Edit button for admins */}
      {isEditor && onEditArtist && (
        <button
          onClick={(e) => { e.stopPropagation(); onEditArtist(); }}
          className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white rounded-full p-3 transition-colors z-10"
          aria-label="تعديل الفنان"
          title="تعديل بيانات الفنان"
        >
          <Edit2 className="w-5 h-5" />
        </button>
      )}

      {/* Main content - scrollable */}
      <div className="w-full max-w-7xl h-full overflow-y-auto bg-background rounded-2xl shadow-2xl">
        {/* Header Section with Artist Info */}
        <div className="relative bg-gradient-to-b from-primary/10 to-background p-4 md:p-8 border-b border-border">
          <div className="max-w-4xl mx-auto">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              {/* Profile Image */}
              <img
                src={getImageUrl(artist.profileImage)}
                alt={artist.name}
                loading="lazy"
                decoding="async"
                className="w-32 h-32 rounded-full object-cover border-4 border-primary/20 shadow-lg"
              />

              {/* Artist Info */}
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-1">{artist.name}</h1>
                <p className="text-primary font-medium mb-3">{artist.role}</p>

                {/* Stats */}
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>انضم في {formatDate(artist.joinDate)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    <span>{artistImages.length} عمل في المكتبة</span>
                  </div>
                </div>

                {/* Specialties */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {artist.specialty.map((spec, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                    >
                      {spec}
                    </span>
                  ))}
                </div>

                {/* Social Media Links */}
                <div className="flex gap-3">
                  {artist.socialMedia.facebook && (
                    <a
                      href={artist.socialMedia.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-card hover:bg-muted rounded-lg transition-colors"
                      aria-label="Facebook"
                    >
                      <Facebook className="w-5 h-5" />
                    </a>
                  )}
                  {artist.socialMedia.instagram && (
                    <a
                      href={artist.socialMedia.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-card hover:bg-muted rounded-lg transition-colors"
                      aria-label="Instagram"
                    >
                      <Instagram className="w-5 h-5" />
                    </a>
                  )}
                  {artist.socialMedia.website && (
                    <a
                      href={artist.socialMedia.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-card hover:bg-muted rounded-lg transition-colors"
                      aria-label="الموقع الإلكتروني"
                    >
                      <Globe className="w-5 h-5" />
                    </a>
                  )}
                  {artist.socialMedia.email && (
                    <a
                      href={`mailto:${artist.socialMedia.email}`}
                      className="p-2 bg-card hover:bg-muted rounded-lg transition-colors"
                      aria-label="البريد الإلكتروني"
                    >
                      <Mail className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Bio Section */}
            <div className="mt-6 p-6 bg-card rounded-xl border border-border">
              <h2 className="text-lg font-bold mb-3">نبذة عن الفنان</h2>
              <p className="text-muted-foreground leading-relaxed">{artist.bio}</p>
            </div>
          </div>
        </div>

        {/* Works Section */}
        <div className="p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {/* Section Header with Selection Mode Toggle */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold mb-1">أعمال الفنان</h2>
                <p className="text-muted-foreground">{artistImages.length} عمل</p>
              </div>

              {/* Selection Mode Toggle */}
              <button
                onClick={() => isSelectionMode ? exitSelectionMode() : setIsSelectionMode(true)}
                className={`flex items-center gap-2 px-4 py-2 border rounded-xl transition-all ${ 
                  isSelectionMode
                    ? 'bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/20'
                    : 'bg-card border-border hover:bg-muted'
                }`}
              >
                {isSelectionMode ? (
                  <>
                    <X className="w-5 h-5" />
                    <span>إلغاء</span>
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" />
                    <span>تحديد</span>
                  </>
                )}
              </button>
            </div>

            {/* Images Grid */}
            {artistImages.length > 0 ? (
              <ResponsiveMasonry columnsCountBreakPoints={{0: 1, 350: 1, 750: 2, 900: 3, 1200: 4}}>
                <Masonry gutter="16px">
                  {artistImages.map((image, index) => (
                    <div
                      key={image.id}
                      className={`group relative overflow-hidden rounded-xl bg-card border cursor-pointer transition-all ${
                        isSelectionMode && selectedImages.includes(image.id)
                          ? 'border-2 border-primary ring-2 ring-primary/20'
                          : 'border-border'
                      }`}
                      onClick={() => {
                        if (isSelectionMode) {
                          toggleImageSelection(image.id);
                        } else {
                          onImageClick(images.findIndex(img => img.id === image.id));
                        }
                      }}
                    >
                      <img
                        src={getImageUrl(image.src)}
                        alt={image.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-auto object-cover transition-transform duration-300"
                      />

                      {/* Selection Checkbox */}
                      {isSelectionMode && (
                        <div className="absolute top-3 right-3 z-10">
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

                      {/* Overlay - hover effects */}
                      {!isSelectionMode && (
                        <>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDownloadImage(image);
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-black rounded-lg transition-colors text-xs"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>تحميل</span>
                              </button>
                            </div>
                          </div>

                          {/* Heart button */}
                          <div
                            className={`absolute top-3 left-3 z-10 transition-opacity duration-300 ${
                              favoritedImages.includes(image.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                            }`}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleFavorite(image.id);
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

                      {/* Selection overlay */}
                      {isSelectionMode && selectedImages.includes(image.id) && (
                        <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
                      )}
                    </div>
                  ))}
                </Masonry>
              </ResponsiveMasonry>
            ) : (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <p className="text-muted-foreground">لا توجد أعمال لهذا الفنان بعد</p>
              </div>
            )}

            {/* Selection Mode Bottom Bar */}
            {isSelectionMode && selectedImages.length > 0 && (
              <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-card border border-border rounded-2xl shadow-2xl p-4 z-50 max-w-2xl w-full mx-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-medium">
                    {selectedImages.length} من {artistImages.length} محدد
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={selectAllImages}
                      className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-all text-sm"
                    >
                      <Check className="w-4 h-4" />
                      <span className="hidden sm:inline">الكل</span>
                    </button>
                    <button
                      onClick={clearSelection}
                      className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-all text-sm"
                    >
                      <X className="w-4 h-4" />
                      <span className="hidden sm:inline">إلغاء التحديد</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}