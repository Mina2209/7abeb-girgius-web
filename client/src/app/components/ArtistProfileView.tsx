import { ChevronRight, Facebook, Instagram, Globe, Mail, Download, Heart, Image as ImageIcon, ArrowLeft } from 'lucide-react';
import { Artist } from '../data/artists';
import { GalleryImage, galleryImages } from '../data/galleryImages';
import { useState, useMemo } from 'react';
import Masonry, { ResponsiveMasonry } from 'react-responsive-masonry';
import { useAuth } from '../contexts/AuthContext';

interface ArtistProfileViewProps {
  artist: Artist;
  onBack: () => void;
  onImageClick: (image: GalleryImage, index: number) => void;
  favoritedImages: number[];
  onToggleFavorite: (imageId: number) => void;
  onDownloadImage: (image: GalleryImage) => void;
}

export function ArtistProfileView({ 
  artist, 
  onBack, 
  onImageClick,
  favoritedImages,
  onToggleFavorite,
  onDownloadImage 
}: ArtistProfileViewProps) {
  const { user, profile } = useAuth();
  
  // Filter images by this artist
  const artistImages = useMemo(() => {
    return galleryImages.filter(img => img.artist === artist.name);
  }, [artist.name]);

  return (
    <div className="flex flex-col h-full">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-4 w-fit"
      >
        <ArrowLeft className="w-5 h-5" />
        <span>العودة إلى الفنانون</span>
      </button>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-8 pb-6">
          {/* Artist Profile Header */}
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Profile Image */}
              <img
                src={artist.profileImage}
                alt={artist.name}
                className="w-40 h-40 rounded-full object-cover border-4 border-primary/20 shadow-xl flex-shrink-0"
              />

              {/* Info */}
              <div className="flex-1 text-center md:text-right space-y-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold mb-2">{artist.name}</h1>
                </div>

                <p className="text-primary font-bold text-lg">{artist.role}</p>

                {/* Stats */}
                <div className="flex items-center justify-center md:justify-start gap-4 text-sm flex-wrap">
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl font-medium">
                    <ImageIcon className="w-5 h-5" />
                    <span>{artistImages.length} صورة في المكتبة</span>
                  </div>
                  <div className="text-muted-foreground">
                    انضم {new Date(artist.joinDate).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' })}
                  </div>
                </div>

                {/* Social Media Links */}
                {(artist.socialMedia.facebook || artist.socialMedia.instagram || artist.socialMedia.website || artist.socialMedia.email) && (
                  <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
                    {artist.socialMedia.facebook && (
                      <a
                        href={artist.socialMedia.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 bg-muted hover:bg-primary hover:text-primary-foreground rounded-xl transition-colors"
                        title="Facebook"
                      >
                        <Facebook className="w-5 h-5" />
                      </a>
                    )}
                    {artist.socialMedia.instagram && (
                      <a
                        href={artist.socialMedia.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 bg-muted hover:bg-primary hover:text-primary-foreground rounded-xl transition-colors"
                        title="Instagram"
                      >
                        <Instagram className="w-5 h-5" />
                      </a>
                    )}
                    {artist.socialMedia.website && (
                      <a
                        href={artist.socialMedia.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 bg-muted hover:bg-primary hover:text-primary-foreground rounded-xl transition-colors"
                        title="الموقع الإلكتروني"
                      >
                        <Globe className="w-5 h-5" />
                      </a>
                    )}
                    {artist.socialMedia.email && (
                      <a
                        href={`mailto:${artist.socialMedia.email}`}
                        className="p-3 bg-muted hover:bg-primary hover:text-primary-foreground rounded-xl transition-colors"
                        title="البريد الإلكتروني"
                      >
                        <Mail className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Specialty Tags */}
            {artist.specialty && artist.specialty.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-6 pt-6 border-t border-border">
                {artist.specialty.map((spec, index) => (
                  <span
                    key={index}
                    className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-medium"
                  >
                    {spec}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Bio Section */}
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
            <h2 className="font-bold text-2xl mb-4">نبذة عن الفنان</h2>
            <p className="text-muted-foreground leading-relaxed text-lg">
              {artist.bio}
            </p>
          </div>

          {/* Works Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-2xl">أعمال الفنان</h2>
              <span className="text-muted-foreground">
                {artistImages.length} صورة
              </span>
            </div>

            {/* Gallery Grid */}
            {artistImages.length > 0 ? (
              <ResponsiveMasonry
                columnsCountBreakPoints={{0: 1, 350: 1, 750: 2, 900: 3, 1200: 4}}
              >
                <Masonry gutter="16px">
                  {artistImages.map((image, index) => (
                    <div
                      key={image.id}
                      className="group relative overflow-hidden rounded-xl bg-card border border-border cursor-pointer transition-all hover:shadow-lg"
                      onClick={() => onImageClick(image, index)}
                    >
                      {/* Image */}
                      <img
                        src={image.src}
                        alt={image.title}
                        className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      
                      {/* Overlay - Shows on hover OR when favorited */}
                      <>
                        {/* Background overlay - only on hover */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                          {/* Title */}
                          <h3 className="text-white font-bold mb-2">{image.title}</h3>
                          
                          {/* Download button - only shows on hover */}
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
                        
                        {/* Heart button - Always visible when favorited, only on hover when not favorited */}
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
                    </div>
                  ))}
                </Masonry>
              </ResponsiveMasonry>
            ) : (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <p className="text-muted-foreground">لا توجد صور لهذا الفنان حالياً</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
