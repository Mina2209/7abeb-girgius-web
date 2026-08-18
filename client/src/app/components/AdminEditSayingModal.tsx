import { X, Save, Upload } from 'lucide-react';
import { useState, useEffect } from 'react';
import { TagMultiSelect } from './TagMultiSelect';
import { useUniversalTopics } from '../hooks/useUniversalTopics';
import type { Saying } from '../types/content';

interface AdminEditSayingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (saying: Saying | Saying[]) => Promise<void> | void;
  saying?: Saying | null;
  allAuthors: string[];
  allSources: string[];
}


export function AdminEditSayingModal({
  isOpen,
  onClose,
  onSave,
  saying,
  allAuthors,
  allSources,
}: AdminEditSayingModalProps) {
  const { topicNames } = useUniversalTopics(); // Get centralized topics
  const [formData, setFormData] = useState<Saying>({
    id: 0,
    quote: '',
    author: '',
    authorImage: '',
    tags: [],
    source: '',
    dateAdded: new Date().toISOString().split('T')[0],
  });
  const [newTag, setNewTag] = useState('');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Reset form when saying changes or modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (saying) {
        setFormData(saying);
      } else {
        // New saying - generate new ID
        setFormData({
          id: Date.now(),
          quote: '',
          author: '',
          authorImage: 'https://images.unsplash.com/photo-1704276864429-9ed5be4cdd25?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxzYWludCUyMG9ydGhvZG94JTIwaWNvbnxlbnwxfHx8fDE3NjY5MjA1NTl8MA&ixlib=rb-4.1.0&q=80&w=1080',
          tags: [],
          source: '',
          dateAdded: new Date().toISOString().split('T')[0],
        });
      }
      setErrors({});
    }
  }, [isOpen, saying]);

  const parseQuotesFromTextarea = (raw: string) => {
    // Split by new lines; each non-empty line is considered a separate quote.
    // Also support pipes in case user pastes "a | b".
    const lines = raw
      .split('\n')
      .flatMap((l) => l.split('|'))
      .map((s) => s.trim())
      .filter(Boolean);
    // Preserve order but avoid exact duplicates
    return Array.from(new Set(lines));
  };

  const validateForm = (): { ok: boolean; parsedQuotes?: string[] } => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.author.trim()) {
      newErrors.author = 'اسم القائل مطلوب';
    }
    if (!formData.source.trim()) {
      newErrors.source = 'المصدر مطلوب';
    }
    if (formData.tags.length === 0) {
      newErrors.tags = 'يجب اختيار تصنيف واحد على الأقل';
    }

    const parsedQuotes = parseQuotesFromTextarea(formData.quote);
    if (!parsedQuotes || parsedQuotes.length === 0) {
      newErrors.quote = 'القول مطلوب (أدخل سطر واحد على الأقل)';
    }

    setErrors(newErrors);
    return { ok: Object.keys(newErrors).length === 0, parsedQuotes };
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { ok, parsedQuotes } = validateForm();
    if (!ok || !parsedQuotes || parsedQuotes.length === 0) return;

    // Same author/source/tags for all parsed quotes
    const base = { ...formData };
    const payload: Saying[] = parsedQuotes.map((q) => ({
      ...base,
      // Backend expects `content` in payload mapping as quote
      quote: q,
    }));

    // If only one quote -> keep old behavior (single Saying)
    if (payload.length === 1) {
      onSave(payload[0]);
    } else {
      onSave(payload);
    }
    onClose();
  };


  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(tag => tag !== tagToRemove) });
  };

  const handleToggleExistingTag = (tag: string) => {
    if (formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
    } else {
      setFormData({ ...formData, tags: [...formData.tags, tag] });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div 
        className="bg-background rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <h2 className="text-2xl font-bold">
            {saying ? 'تعديل القول' : 'إضافة قول جديد'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Quote */}
          <div>
            <label className="block text-sm font-medium mb-2">
              القول <span className="text-red-500">*</span>
            </label>
              <textarea
              value={formData.quote}
              onChange={(e) => setFormData({ ...formData, quote: e.target.value })}
              className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[120px] resize-y"
              placeholder="أدخل نص القول...\n(يمكنك إدخال عدة أقوال: كل سطر قول)"
            />
            <p className="text-xs text-muted-foreground mt-2">
              {parseQuotesFromTextarea(formData.quote).length > 1
                ? `سيتم إضافة ${parseQuotesFromTextarea(formData.quote).length} أقوال دفعة واحدة.`
                : 'كل سطر داخل هذا الحقل يُعتبر قولاً مستقلًا.'}
            </p>

            {errors.quote && <p className="text-red-500 text-sm mt-1">{errors.quote}</p>}
          </div>

          {/* Author */}
          <div>
            <label className="block text-sm font-medium mb-2">
              القائل <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.author}
              onChange={(e) => setFormData({ ...formData, author: e.target.value })}
              list="authors-list"
              className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="اسم القائل..."
            />
            <datalist id="authors-list">
              {allAuthors.map((author) => (
                <option key={author} value={author} />
              ))}
            </datalist>
            {errors.author && <p className="text-red-500 text-sm mt-1">{errors.author}</p>}
          </div>

          {/* Author Image */}
          <div>
            <label className="block text-sm font-medium mb-2">
              صورة القائل
            </label>
            {formData.authorImage ? (
              <div className="space-y-2">
                <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-border">
                  <img
                    src={formData.authorImage}
                    alt="Preview"
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, authorImage: '' })}
                  className="text-sm text-red-500 hover:text-red-600 transition-colors"
                >
                  إزالة الصورة
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center gap-2 border-2 border-dashed border-border rounded-xl p-6 cursor-pointer hover:border-primary/50 transition-colors">
                <Upload className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">اضغط لرفع صورة القائل</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setFormData({ ...formData, authorImage: reader.result as string });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            )}
          </div>

          {/* Source */}
          <div>
            <label className="block text-sm font-medium mb-2">
              المصدر <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.source}
              onChange={(e) => setFormData({ ...formData, source: e.target.value })}
              list="sources-list"
              className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="المصدر..."
            />
            <datalist id="sources-list">
              {allSources.map((source) => (
                <option key={source} value={source} />
              ))}
            </datalist>
            {errors.source && <p className="text-red-500 text-sm mt-1">{errors.source}</p>}
          </div>

          {/* Tags */}
          <TagMultiSelect
            availableTags={topicNames}
            selectedTags={formData.tags}
            onTagsChange={(tags) => setFormData({ ...formData, tags })}
            error={errors.tags}
          />

          {/* Date Added ( تم قفل الحقل هنا لمنع التعديل اليدوي) */}
          <div>
            <label className="block text-sm font-medium mb-2">
              تاريخ الإضافة
            </label>
            <input
              type="date"
              value={formData.dateAdded}
              disabled
              className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-muted-foreground cursor-not-allowed opacity-80"
              title="يتم تحديد تاريخ الإضافة تلقائياً للبيانات"
            />
          </div>
        </form>

        {/* Footer */}
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
            حفظ
          </button>
        </div>
      </div>
    </div>
  );
}