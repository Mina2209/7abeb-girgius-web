import { X, Save, Upload } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Father } from '../data/fathers';
import { getImageUrl } from '../utils/getImageUrl';

interface AdminEditFatherModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (father: Father) => void;
  father?: Father | null;
  isNew?: boolean;
}

const emptyFather: Father = {
  id: '',
  name: '',
  title: '',
  bio: '',
  profileImage: '',
};

export function AdminEditFatherModal({
  isOpen,
  onClose,
  onSave,
  father,
  isNew = false,
}: AdminEditFatherModalProps) {
  const [formData, setFormData] = useState<Father>(father || emptyFather);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (isOpen) {
      setFormData(father || emptyFather);
      setErrors({});
    }
  }, [isOpen, father, isNew]);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name.trim()) newErrors.name = 'اسم الآب مطلوب';
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div
        className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <h2 className="text-2xl font-bold">
            {isNew ? 'إضافة آب جديد' : `تعديل بيانات الآب: ${father?.name || ''}`}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                الاسم <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="edit-father-name"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="اسم الآب..."
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                اللقب
              </label>
              <input
                type="text"
                id="edit-father-title"
                name="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="مثلاً: أب الرهبان"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                صورة البروفايل
              </label>
              {formData.profileImage ? (
                <div className="space-y-2">
                  <div className="w-20 h-20 rounded-full overflow-hidden border border-border">
                    <img
                      src={getImageUrl(formData.profileImage)}
                      alt="Preview"
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, profileImage: '' })}
                    className="text-sm text-red-500 hover:text-red-600 transition-colors"
                  >
                    إزالة الصورة
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center gap-2 border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 transition-colors">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">اضغط لرفع صورة</span>
                  <input
                    type="file"
                    id="edit-father-profile-image"
                    name="profileImage"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                          setFormData({ ...formData, profileImage: reader.result as string });
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                السيرة الذاتية
              </label>
              <textarea
                id="edit-father-bio"
                name="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[200px] resize-y"
                placeholder="نبذة عن الآب..."
              />
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-card flex-wrap">
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
            {isNew ? 'إضافة' : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
}
