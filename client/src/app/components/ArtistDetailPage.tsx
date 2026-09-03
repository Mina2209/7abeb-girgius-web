import { ArrowRight, Facebook, Instagram, Globe, Mail, Calendar, Image as ImageIcon, Edit2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Masonry, { ResponsiveMasonry } from 'react-responsive-masonry';
import { useAuth } from '../contexts/AuthContext';
import { useIsEditor } from '../utils/adminUtils';
import { AdminEditArtistModal } from './AdminEditArtistModal';
import { apiGetJson } from '../services/apiClient';
import { updateArtist } from '../services/contentWriteService';
import { mapServerAuthorToClient, mapServerImageToClient, type ServerAuthorRow, type ServerImageRow } from '../services/contentMappers';
import type { Artist } from '../data/artists';
import type { GalleryImage } from '../types/content';
import { getImageUrl } from '../utils/getImageUrl';

export function ArtistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const isEditor = useIsEditor();

  const [artist, setArtist] = useState<Artist | null>(null);
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiGetJson<ServerAuthorRow>(`/api/images/meta/authors/${id}`)
      .then((row) => {
        const a = mapServerAuthorToClient(row);
        setArtist(a);
        return a;
      })
      .then((a) => {
        return apiGetJson<{ data: ServerImageRow[] }>(
          `/api/images?artists=${encodeURIComponent(a.name)}&limit=100`,
        ).then((res) => setImages((res.data ?? []).map(mapServerImageToClient)));
      })
      .catch(() => setMessage('فشل تحميل بيانات الفنان'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (artistData: Artist) => {
    try {
      const updated = await updateArtist(id!, artistData, accessToken);
      setArtist(updated);
      setMessage('تم تحديث بيانات الفنان بنجاح');
    } catch {
      setMessage('فشل تحديث بيانات الفنان');
    }
    setTimeout(() => setMessage(''), 2000);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long' });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-2 text-muted-foreground">
        <p>جاري تحميل بيانات الفنان...</p>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-muted-foreground">لم يتم العثور على الفنان</p>
        <button
          onClick={() => navigate('/artists')}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى الفنانين</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <button
        onClick={() => navigate('/artists')}
        className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-4 w-fit"
      >
        <ArrowRight className="w-5 h-5" />
        <span>العودة إلى الفنانين</span>
      </button>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-8 pb-6">
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {artist.profileImage ? (
                <img
                  src={getImageUrl(artist.profileImage)}
                  alt={artist.name}
                  loading="lazy"
                  decoding="async"
                  className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-primary/20 shadow-xl flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full border-4 border-primary/20 shadow-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="w-16 h-16 text-muted-foreground" />
                </div>
              )}

              <div className="flex-1 text-center md:text-right space-y-4">
                <div className="flex items-center justify-center md:justify-between gap-4">
                  <h1 className="text-3xl md:text-4xl font-bold">{artist.name}</h1>
                  {isEditor && (
                    <button
                      onClick={() => setIsEditModalOpen(true)}
                      className="p-2 bg-muted hover:bg-primary hover:text-primary-foreground rounded-xl transition-colors"
                      title="تعديل"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                  )}
                </div>

                {artist.role && <p className="text-primary font-bold text-lg">{artist.role}</p>}

                <div className="flex items-center justify-center md:justify-start gap-4 text-sm flex-wrap">
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl font-medium">
                    <ImageIcon className="w-5 h-5" />
                    <span>{images.length} صورة في المكتبة</span>
                  </div>
                  {artist.joinDate && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="w-4 h-4" />
                      <span>انضم في {formatDate(artist.joinDate)}</span>
                    </div>
                  )}
                </div>

                {(artist.socialMedia.facebook || artist.socialMedia.instagram || artist.socialMedia.website || artist.socialMedia.email) && (
                  <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
                    {artist.socialMedia.facebook && (
                      <a href={artist.socialMedia.facebook} target="_blank" rel="noopener noreferrer"
                        className="p-3 bg-muted hover:bg-primary hover:text-primary-foreground rounded-xl transition-colors" title="Facebook">
                        <Facebook className="w-5 h-5" />
                      </a>
                    )}
                    {artist.socialMedia.instagram && (
                      <a href={artist.socialMedia.instagram} target="_blank" rel="noopener noreferrer"
                        className="p-3 bg-muted hover:bg-primary hover:text-primary-foreground rounded-xl transition-colors" title="Instagram">
                        <Instagram className="w-5 h-5" />
                      </a>
                    )}
                    {artist.socialMedia.website && (
                      <a href={artist.socialMedia.website} target="_blank" rel="noopener noreferrer"
                        className="p-3 bg-muted hover:bg-primary hover:text-primary-foreground rounded-xl transition-colors" title="الموقع الإلكتروني">
                        <Globe className="w-5 h-5" />
                      </a>
                    )}
                    {artist.socialMedia.email && (
                      <a href={`mailto:${artist.socialMedia.email}`}
                        className="p-3 bg-muted hover:bg-primary hover:text-primary-foreground rounded-xl transition-colors" title="البريد الإلكتروني">
                        <Mail className="w-5 h-5" />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {artist.specialty && artist.specialty.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-6 pt-6 border-t border-border">
                {artist.specialty.map((spec, index) => (
                  <span key={index} className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-sm font-medium">
                    {spec}
                  </span>
                ))}
              </div>
            )}
          </div>

          {artist.bio && (
            <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <h2 className="font-bold text-2xl mb-4">نبذة عن الفنان</h2>
              <p className="text-muted-foreground leading-relaxed text-lg">{artist.bio}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-2xl">أعمال الفنان</h2>
              <span className="text-muted-foreground">{images.length} صورة</span>
            </div>

            {images.length > 0 ? (
              <ResponsiveMasonry columnsCountBreakPoints={{ 0: 1, 350: 1, 750: 2, 900: 3, 1200: 4 }}>
                <Masonry gutter="16px">
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className="group relative overflow-hidden rounded-xl bg-card border border-border cursor-pointer transition-all hover:shadow-lg"
                    >
                      <img
                        src={getImageUrl(image.src)}
                        alt={image.title}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        <h3 className="text-white font-bold mb-2">{image.title}</h3>
                      </div>
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

      <AdminEditArtistModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSave}
        artist={artist}
      />

      {message && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-xl shadow-lg z-50 animate-fade-in">
          {message}
        </div>
      )}
    </div>
  );
}
