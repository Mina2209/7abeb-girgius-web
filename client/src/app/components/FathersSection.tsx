import { Image as ImageIcon, Edit2, Trash2, Plus } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useIsEditor } from '../utils/adminUtils';
import { AdminEditFatherModal } from './AdminEditFatherModal';
import { apiRequest } from '../services/apiClient';
import { fetchFathers, createFather, updateFather } from '../services/contentWriteService';
import type { Father } from '../data/fathers';

export function FathersSection() {
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const isEditor = useIsEditor();
  const [fathers, setFathers] = useState<Father[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [editFather, setEditFather] = useState<Father | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const loadFathers = async () => {
    try {
      setLoading(true);
      const data = await fetchFathers(accessToken);
      setFathers(data ?? []);
    } catch {
      setMessage('فشل تحميل الآباء');
      setTimeout(() => setMessage(''), 2000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFathers();
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

  const handleEdit = (father: Father) => {
    setEditFather(father);
    setIsEditModalOpen(true);
  };

  const handleSave = async (fatherData: Father) => {
    try {
      if (editFather && typeof editFather.id === 'string') {
        const updated = await updateFather(editFather.id, fatherData, accessToken);
        setFathers(prev => prev.map(f => (f.id === updated.id ? updated : f)));
        setMessage('تم تحديث بيانات الآب بنجاح');
      } else {
        const created = await createFather(fatherData, accessToken);
        setFathers(prev => [...prev, created]);
        setMessage('تم إضافة الآب بنجاح');
      }
    } catch {
      setMessage(editFather ? 'فشل تحديث بيانات الآب' : 'فشل إضافة الآب');
    }
    setTimeout(() => setMessage(''), 2000);
  };

  const handleDelete = async (father: Father) => {
    if (typeof father.id !== 'string') return;
    if (!confirm(`هل أنت متأكد من حذف "${father.name}"؟`)) return;
    try {
      const res = await apiRequest(`/api/fathers/${father.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'فشل الحذف');
      }
      setFathers(prev => prev.filter(f => f.id !== father.id));
      setMessage('تم حذف الآب بنجاح');
    } catch (e: any) {
      setMessage(e.message || 'فشل حذف الآب');
    }
    setTimeout(() => setMessage(''), 2000);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-2 text-muted-foreground">
        <p>جاري تحميل الآباء...</p>
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
            <h1 className="mb-2 font-bold text-[36px]">الآباء</h1>
            <p className="text-muted-foreground leading-relaxed">
              آباء الكنيسة وقديسيها
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
                    setEditFather(null);
                    setIsEditModalOpen(true);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة آب جديد</span>
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1">
          {fathers.length === 0 ? (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <p className="text-muted-foreground">لا يوجد آباء بعد</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-6">
              {fathers.map((father) => (
                <div
                  key={father.id}
                  className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-lg transition-all group cursor-pointer"
                  onClick={() => navigate(`/fathers/${father.id}`)}
                >
                  <div className="relative h-48 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center overflow-hidden">
                    {father.profileImage ? (
                      <img
                        src={father.profileImage}
                        alt={father.name}
                        className="w-32 h-32 rounded-full object-cover border-4 border-background shadow-xl group-hover:scale-110 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '';
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-32 h-32 rounded-full border-4 border-background shadow-xl bg-muted flex items-center justify-center">
                        <ImageIcon className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}

                    {isEditor && (
                      <div className="absolute top-3 left-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(father); }}
                          className="p-2 bg-white/90 hover:bg-white text-black rounded-lg transition-colors shadow-lg"
                          title="تعديل"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(father); }}
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
                      <h3 className="text-xl font-bold">{father.name}</h3>
                      {father.title && <p className="text-primary font-medium text-sm">{father.title}</p>}
                    </div>

                    {father.bio && (
                      <p className="text-muted-foreground text-sm leading-relaxed line-clamp-3 text-center">
                        {father.bio}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AdminEditFatherModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditFather(null);
        }}
        onSave={handleSave}
        father={
          editFather ?? {
            id: '',
            name: '',
            title: '',
            bio: '',
            profileImage: '',
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
