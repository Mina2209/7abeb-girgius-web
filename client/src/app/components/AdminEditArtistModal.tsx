import { X, Save, HelpCircle } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Artist } from '../data/artists';

interface AdminEditArtistModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (artist: Artist) => void;
  artist: Artist;
}

export function AdminEditArtistModal({
  isOpen,
  onClose,
  onSave,
  artist,
}: AdminEditArtistModalProps) {
  const [formData, setFormData] = useState<Artist>(artist);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [specialtyInput, setSpecialtyInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setFormData(artist);
      setErrors({});
      setSpecialtyInput('');
    }
  }, [isOpen, artist]);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name.trim()) newErrors.name = 'اسم الفنان مطلوب';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
      onClose();
    }
  };

  const addSpecialty = () => {
    const val = specialtyInput.trim();
    if (val && !formData.specialty.includes(val)) {
      setFormData({ ...formData, specialty: [...formData.specialty, val] });
    }
    setSpecialtyInput('');
  };

  const removeSpecialty = (index: number) => {
    setFormData({
      ...formData,
      specialty: formData.specialty.filter((_, i) => i !== index),
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div
        className="bg-background rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <h2 className="text-2xl font-bold">
            تعديل بيانات الفنان: {artist.name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  الاسم <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="اسم الفنان..."
                />
                {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">
                  الدور/الوصف
                </label>
                <input
                  type="text"
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="مثلاً: فنان قبطي معاصر"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  صورة البروفايل (URL)
                </label>
                <input
                  type="text"
                  value={formData.profileImage}
                  onChange={(e) => setFormData({ ...formData, profileImage: e.target.value })}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="https://example.com/image.jpg"
                />
                {formData.profileImage && (
                  <div className="mt-2 w-20 h-20 rounded-full overflow-hidden border border-border">
                    <img
                      src={formData.profileImage}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  السيرة الذاتية
                </label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                  className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[120px] resize-y"
                  placeholder="نبذة عن الفنان..."
                />
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground items-center gap-2">
                  <HelpCircle className="w-4 h-4" />
                  التخصصات
                </label>
                <div className="flex gap-2 mb-2 flex-wrap">
                  {formData.specialty.map((spec, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                    >
                      {spec}
                      <button
                        type="button"
                        onClick={() => removeSpecialty(index)}
                        className="hover:text-destructive transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={specialtyInput}
                    onChange={(e) => setSpecialtyInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSpecialty(); } }}
                    className="flex-1 px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="أضف تخصصاً..."
                  />
                  <button
                    type="button"
                    onClick={addSpecialty}
                    className="px-4 py-3 bg-primary/10 text-primary rounded-xl hover:bg-primary/20 transition-colors"
                  >
                    إضافة
                  </button>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="text-sm font-medium mb-3 text-muted-foreground">روابط التواصل الاجتماعي</h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">فيسبوك</label>
                    <input
                      type="text"
                      value={formData.socialMedia.facebook || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        socialMedia: { ...formData.socialMedia, facebook: e.target.value }
                      })}
                      className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="https://facebook.com/..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">انستغرام</label>
                    <input
                      type="text"
                      value={formData.socialMedia.instagram || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        socialMedia: { ...formData.socialMedia, instagram: e.target.value }
                      })}
                      className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="https://instagram.com/..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">الموقع الإلكتروني</label>
                    <input
                      type="text"
                      value={formData.socialMedia.website || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        socialMedia: { ...formData.socialMedia, website: e.target.value }
                      })}
                      className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium mb-1">البريد الإلكتروني</label>
                    <input
                      type="text"
                      value={formData.socialMedia.email || ''}
                      onChange={(e) => setFormData({
                        ...formData,
                        socialMedia: { ...formData.socialMedia, email: e.target.value }
                      })}
                      className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="email@example.com"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-card">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 border border-border rounded-xl hover:bg-muted transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors"
          >
            <Save className="w-4 h-4" />
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}
