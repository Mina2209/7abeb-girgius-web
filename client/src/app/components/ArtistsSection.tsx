import { Image as ImageIcon, Facebook, Instagram, Globe, Mail, ExternalLink } from 'lucide-react';
//  التعديل هنا: عملنا import للاسم الصح (artists) وعملنا له alias باسم artistsData عشان مفيش حاجة تضرب تحت
import { artists as artistsData, Artist } from '../data/artists'; 
import { galleryImages } from '../data/galleryImages';
import { useState, useEffect, useRef } from 'react';

//  التعديل هنا: الـ artistId لازم يكون number عشان يطابق الـ Interface بتاعك
interface ArtistsSectionProps {
  onArtistClick: (artistId: number) => void;
}

export function ArtistsSection({ onArtistClick }: ArtistsSectionProps) {
  // إعدادات السكرول والـ Ref الموحدة لـ "7abeb-girgius"
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

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
      handleScroll(); // الفحص الفوري والمباشر
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", handleScroll);
      }
    };
  }, [scrollContainerRef.current, artistsData]);

  // حساب عدد الصور لكل فنان
  const getArtistImageCount = (artistName: string) => {
    return galleryImages.filter(img => img.artist === artistName).length;
  };

  return (
    // الحاوية الرئيسية ذات السكرول الموحد
    <div ref={scrollContainerRef} className="h-screen overflow-y-auto flex flex-col">
      <div className="p-6 flex flex-col flex-1">
        
        {/* هيدر الصفحة الحركي المستقر */}
        <div
          className={`transition-all duration-500 ease-in-out overflow-hidden ${
            isScrolled
              ? "max-h-0 opacity-0 mb-0 pointer-events-none transform -translate-y-2"
              : "max-h-[200px] opacity-100 mb-6 transform translate-y-0"
          }`}
        >
          <div>
            <h1 className="mb-2 font-bold text-[36px]">الفنانون</h1>
            <p className="text-muted-foreground leading-relaxed">
              تعرف على الفنانين المشاركين في مكتبة الصور
            </p>
          </div>
        </div>

        {/* Artists Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
            {/* استخدمنا الـ Artist المجلوب من ملف الداتا مباشرة لمنع أي تعارض */}
            {artistsData.map((artist: Artist) => {
              const imageCount = getArtistImageCount(artist.name);
              
              return (
                <div
                  key={artist.id}
                  className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-all group cursor-pointer"
                  onClick={() => onArtistClick(artist.id)}
                >
                  {/* Artist Image */}
                  <div className="relative h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center overflow-hidden">
                    <img
                      src={artist.profileImage}
                      alt={artist.name}
                      className="w-32 h-32 rounded-full object-cover border-4 border-background shadow-xl group-hover:scale-110 transition-transform duration-300"
                    />
                  </div>

                  {/* Content */}
                  <div className="p-6 space-y-4">
                    {/* Name and Role */}
                    <div className="text-center space-y-1">
                      <h3 className="text-xl font-bold">{artist.name}</h3>
                      {artist.nameEnglish && (
                        <p className="text-sm text-muted-foreground">{artist.nameEnglish}</p>
                      )}
                      <p className="text-primary font-medium text-sm">{artist.role}</p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-lg">
                        <ImageIcon className="w-4 h-4 text-primary" />
                        <span className="font-medium">{imageCount} صورة</span>
                      </div>
                    </div>

                    {/* Specialty Tags */}
                    {artist.specialty && artist.specialty.length > 0 && (
                      <div className="flex flex-wrap gap-2 justify-center">
                        {artist.specialty.slice(0, 2).map((spec: string, index: number) => (
                          <span
                            key={index}
                            className="px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-xs font-medium"
                          >
                            {spec}
                          </span>
                        ))}
                        {artist.specialty.length > 2 && (
                          <span className="px-2.5 py-1 bg-muted text-muted-foreground rounded-lg text-xs font-medium">
                            +{artist.specialty.length - 2}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Social Media Icons */}
                    {(artist.socialMedia.facebook || artist.socialMedia.instagram || artist.socialMedia.website || artist.socialMedia.email) && (
                      <div className="flex items-center justify-center gap-2 pt-2">
                        {artist.socialMedia.facebook && (
                          <a
                            href={artist.socialMedia.facebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 bg-muted hover:bg-primary hover:text-primary-foreground rounded-lg transition-colors"
                            title="Facebook"
                          >
                            <Facebook className="w-4 h-4" />
                          </a>
                        )}
                        {artist.socialMedia.instagram && (
                          <a
                            href={artist.socialMedia.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 bg-muted hover:bg-primary hover:text-primary-foreground rounded-lg transition-colors"
                            title="Instagram"
                          >
                            <Instagram className="w-4 h-4" />
                          </a>
                        )}
                        {artist.socialMedia.website && (
                          <a
                            href={artist.socialMedia.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 bg-muted hover:bg-primary hover:text-primary-foreground rounded-lg transition-colors"
                            title="الموقع الإلكتروني"
                          >
                            <Globe className="w-4 h-4" />
                          </a>
                        )}
                        {artist.socialMedia.email && (
                          <a
                            href={`mailto:${artist.socialMedia.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 bg-muted hover:bg-primary hover:text-primary-foreground rounded-lg transition-colors"
                            title="البريد الإلكتروني"
                          >
                            <Mail className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    )}

                    {/* View Profile Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onArtistClick(artist.id);
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-xl transition-colors font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>عرض الملف الشخصي</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}