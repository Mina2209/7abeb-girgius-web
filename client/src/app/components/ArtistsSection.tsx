import { Image as ImageIcon, Facebook, Instagram, Globe, Mail, ExternalLink, Edit2, Trash2, Plus, X } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsEditor } from '../utils/adminUtils';
import { AdminEditArtistModal } from './AdminEditArtistModal';
import { apiGetJson, apiRequest } from '../services/apiClient';
import { createArtist, updateArtist } from '../services/contentWriteService';
import { mapServerAuthorToClient, type ServerAuthorRow } from '../services/contentMappers';
import type { Artist } from '../data/artists';

export function ArtistsSection() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const isEditor = useIsEditor();
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [editArtist, setEditArtist] = useState<Artist | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const loadArtists = async () => {
    try {
      setLoading(true);
      const rows = await apiGetJson<ServerAuthorRow[]>('/api/images/meta/authors?hasImages=true');
      setArtists((rows ?? []).map(mapServerAuthorToClient));
    } catch {
      setMessage('فشل تحميل الفنانين');
      setTimeout(() => setMessage(''), 2000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArtists();
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        setIsScrolled(scrollContainerRef.current.scrollTop > 20);
      }
    };
    const el = scrollContainerRef.current;
    if (el) {
      el.addEventListener('scroll', handleScroll);
      handleScroll();
    }
    return () => {
      if (el) el.removeEventListener('scroll', handleScroll);
    };
  }, [loading]);

  const handleEdit = (artist: Artist) => {
    setEditArtist(artist);
    setIsEditModalOpen(true);
  };

  const handleSave = async (artistData: Artist) => {
    try {
      if (editArtist && typeof editArtist.id === 'string') {
        const updated = await updateArtist(editArtist.id, artistData, accessToken);
        setArtists(prev => prev.map(a => (a.id === updated.id ? updated : a)));
        setMessage('تم تحديث بيانات الفنان بنجاح');
      } else {
        const created = await createArtist(artistData, accessToken);
        setArtists(prev => [...prev, created]);
        setMessage('تم إضافة الفنان بنجاح');
      }
    } catch {
      setMessage(editArtist ? 'فشل تحديث بيانات الفنان' : 'فشل إضافة الفنان');
    }
    setTimeout(() => setMessage(''), 2000);
  };

  const handleDelete = async (artist: Artist) => {
    if (typeof artist.id !== 'string') return;
    if (!confirm(`هل أنت متأكد من حذف الفنان "${artist.name}"؟`)) return;
    try {
      const res = await apiRequest(`/api/images/meta/authors/${artist.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل الحذف');
      }
      setArtists(prev => prev.filter(a => a.id !== artist.id));
      setMessage('تم حذف الفنان بنجاح');
    } catch (e: any) {
      setMessage(e.message || 'فشل حذف الفنان');
    }
    setTimeout(() => setMessage(''), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-2 text-muted-foreground">
        <p>جاري تحميل الفنانين...</p>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="h-screen overflow-y-auto flex flex-col">
      <div className="p-6 flex flex-col flex-1">
        <div
          className={`transition-all duration-500 ease-in-out overflow-hidden ${
            isScrolled
              ? 'max-h-0 opacity-0 mb-0 pointer-events-none transform -translate-y-2'
              : 'max-h-[200px] opacity-100 mb-6 transform translate-y-0'
          }`}
        >
          <div>
            <div className="flex items-start justify-between gap-4 mb-2">
              <h1 className="font-bold text-2xl sm:text-3xl lg:text-[36px]">الفنانون</h1>
              <button
                onClick={() => navigate('/images')}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium shrink-0"
              >
                <ImageIcon className="w-4 h-4" />
                <span>العودة إلى مكتبة الصور</span>
              </button>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              تعرف على الفنانين المشاركين في مكتبة الصور
            </p>
          </div>
        </div>

        {isEditor && (
          <div className="mb-6 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">أدوات التحرير:</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setEditArtist(null);
                    setIsEditModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة فنان جديد</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1">
          {artists.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <p className="text-muted-foreground">لا يوجد فنانين بعد</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
              {artists.map((artist) => (
                <div
                  key={artist.id}
                  className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-all group cursor-pointer"
                  onClick={() => navigate(`/artists/${artist.id}`)}
                >
                  <div className="relative h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center overflow-hidden">
                    {artist.profileImage ? (
                      <img
                        src={artist.profileImage}
                        alt={artist.name}
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

                    {isEditor && (
                      <div className="absolute top-3 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(artist); }}
                          className="p-2 bg-white/90 hover:bg-white text-black rounded-lg transition-colors shadow-lg"
                          title="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(artist); }}
                          className="p-2 bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-colors shadow-lg"
                          title="حذف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="text-center space-y-1">
                      <h3 className="text-xl font-bold">{artist.name}</h3>
                      {artist.role && <p className="text-primary font-medium text-sm">{artist.role}</p>}
                    </div>

                    {artist.specialty && artist.specialty.length > 0 && (
                      <div className="flex flex-wrap gap-2 justify-center">
                        {artist.specialty.slice(0, 2).map((spec, index) => (
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
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AdminEditArtistModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditArtist(null);
        }}
        onSave={handleSave}
        artist={
          editArtist ?? {
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

      {message && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-xl shadow-lg z-50 animate-fade-in">
          {message}
        </div>
      )}
    </div>
  );
}
