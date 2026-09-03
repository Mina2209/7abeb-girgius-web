import { ArrowRight, Edit2, BookOpen, Calendar, MessageSquareQuote } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsEditor } from '../utils/adminUtils';
import { AdminEditFatherModal } from './AdminEditFatherModal';
import { fetchFatherById, updateFather, createFather, fetchFatherByName } from '../services/contentWriteService';
import { loadSayingsData } from '../services/contentLoaders';
import { getFatherById as getStaticFatherById } from '../data/fathers';
import type { Father } from '../data/fathers';
import { getImageUrl } from '../utils/getImageUrl';
import type { Saying } from '../types/content';

export function FatherDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const isEditor = useIsEditor();

  const [father, setFather] = useState<Father | null>(null);
  const [sayings, setSayings] = useState<Saying[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    const loadFather = async () => {
      try {
        const [f, s] = await Promise.all([
          fetchFatherById(id, accessToken),
          loadSayingsData(),
        ]);

        if (f) {
          setFather(f);
          setSayings(s);
        } else {
          const staticFather = getStaticFatherById(id);
          if (staticFather) {
            setFather(staticFather);
            setSayings(s);
          } else if (id.startsWith('author-')) {
            const decodedName = decodeURIComponent(id.replace('author-', ''));
            const serverFather = await fetchFatherByName(decodedName, accessToken);
            if (serverFather) {
              setFather(serverFather);
            } else {
              setFather({
                id,
                name: decodedName,
                title: '',
                bio: '',
                profileImage: '',
              });
            }
            setSayings(s);
          } else {
            setSayings(s);
          }
        }
      } catch {
        setMessage('فشل تحميل البيانات');
      } finally {
        setLoading(false);
      }
    };

    loadFather();
  }, [id, accessToken]);

  const fatherSayings = useMemo(() => {
    if (!father) return [];
    return sayings.filter(s => s.author === father.name);
  }, [sayings, father]);

  const handleSave = async (fatherData: Father) => {
    try {
      if (id?.startsWith('static-') || id?.startsWith('author-')) {
        try {
          const created = await createFather(fatherData, accessToken);
          setFather(created);
          setMessage('تم حفظ بيانات الآب بنجاح');
        } catch (createErr: any) {
          if (createErr?.message?.includes('409') || createErr?.message?.includes('موجود')) {
            const existing = await fetchFatherByName(fatherData.name, accessToken);
            if (existing) {
              const updated = await updateFather(existing.id, fatherData, accessToken);
              setFather(updated);
              setMessage('تم تحديث بيانات الآب بنجاح');
            } else {
              throw createErr;
            }
          } else {
            throw createErr;
          }
        }
      } else {
        const updated = await updateFather(id!, fatherData, accessToken);
        setFather(updated);
        setMessage('تم تحديث بيانات الآب بنجاح');
      }
    } catch {
      setMessage('فشل حفظ بيانات الآب');
    }
    setTimeout(() => setMessage(''), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-2 text-muted-foreground">
        <p>جاري تحميل بيانات الآب...</p>
      </div>
    );
  }

  if (!father) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <p className="text-muted-foreground">لم يتم العثور على الآب</p>
        <button
          onClick={() => navigate('/sayings')}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl"
        >
          <ArrowRight className="w-4 h-4" />
          <span>العودة إلى الأقوال</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <button
        onClick={() => navigate('/sayings')}
        className="flex items-center gap-2 text-primary hover:text-primary/80 transition-colors mb-4 w-fit"
      >
        <ArrowRight className="w-5 h-5" />
        <span>العودة إلى الأقوال</span>
      </button>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-8 pb-6">
          <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {father.profileImage ? (
                <img
                  src={getImageUrl(father.profileImage)}
                  alt={father.name}
                  loading="lazy"
                  decoding="async"
                  className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full object-cover border-4 border-primary/20 shadow-xl flex-shrink-0"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-24 h-24 sm:w-32 sm:h-32 md:w-40 md:h-40 rounded-full border-4 border-primary/20 shadow-xl bg-muted flex items-center justify-center flex-shrink-0">
                  <MessageSquareQuote className="w-16 h-16 text-muted-foreground" />
                </div>
              )}

              <div className="flex-1 text-center md:text-right space-y-4">
                <div className="flex items-center justify-center md:justify-between gap-4">
                  <h1 className="text-3xl md:text-4xl font-bold">{father.name}</h1>
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

                {father.title && <p className="text-primary font-bold text-lg">{father.title}</p>}

                <div className="flex items-center justify-center md:justify-start gap-4 text-sm flex-wrap">
                  <div className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl font-medium">
                    <BookOpen className="w-5 h-5" />
                    <span>{fatherSayings.length} قول</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {father.bio && (
            <div className="bg-card border border-border rounded-2xl p-6 md:p-8">
              <h2 className="font-bold text-2xl mb-4">نبذة عن الآب</h2>
              <p className="text-muted-foreground leading-relaxed text-lg">{father.bio}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-2xl">أقوال الآب</h2>
              <span className="text-muted-foreground">{fatherSayings.length} قول</span>
            </div>

            {fatherSayings.length > 0 ? (
              <div className="space-y-4">
                {fatherSayings.map((saying) => (
                  <div
                    key={saying.id}
                    className="bg-card rounded-xl border border-border p-5 hover:bg-muted transition-all"
                  >
                    <blockquote className="text-foreground/90 leading-relaxed mb-4 text-base">
                      &ldquo;{saying.quote}&rdquo;
                    </blockquote>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {saying.tags.map((tag, index) => (
                        <span
                          key={index}
                          className="text-xs px-2.5 py-1 bg-primary/10 text-primary rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border/50">
                      <span className="text-sm text-muted-foreground">
                        <BookOpen className="w-4 h-4 inline ml-1" />
                        المصدر: {saying.source || 'غير محدد'}
                      </span>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        {new Date(saying.dateAdded).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-card rounded-xl border border-border">
                <p className="text-muted-foreground">لا توجد أقوال لهذا الآب بعد</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AdminEditFatherModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleSave}
        father={father}
      />

      {message && (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground px-6 py-3 rounded-xl shadow-lg z-50 animate-fade-in">
          {message}
        </div>
      )}
    </div>
  );
}
