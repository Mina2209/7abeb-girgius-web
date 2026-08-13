import { X, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { TagMultiSelect } from './TagMultiSelect';
import { useUniversalTopics } from '../hooks/useUniversalTopics';

interface AdminBulkEditBooksModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: BulkBookUpdates) => void;
  selectedCount: number;
  availableAuthors: string[];
  availableBookTypes: string[];
  availablePublishers: string[];
  availableSeries: string[];
}

export interface BulkBookUpdates {
  applyAuthor: boolean;
  author: string;
  applyBookType: boolean;
  bookType: string;
  applyPublisher: boolean;
  publisher: string;
  applySeries: boolean;
  series: string;
  applyTopics: boolean;
  topicOperation: 'add' | 'replace' | 'remove';
  topics: string[];
}

export function AdminBulkEditBooksModal({
  isOpen,
  onClose,
  onSave,
  selectedCount,
  availableAuthors,
  availableBookTypes,
  availablePublishers,
  availableSeries,
}: AdminBulkEditBooksModalProps) {
  const { topicNames } = useUniversalTopics();
  
  const [applyAuthor, setApplyAuthor] = useState(false);
  const [author, setAuthor] = useState('');
  
  const [applyBookType, setApplyBookType] = useState(false);
  const [bookType, setBookType] = useState('');
  
  const [applyPublisher, setApplyPublisher] = useState(false);
  const [publisher, setPublisher] = useState('');
  
  const [applySeries, setApplySeries] = useState(false);
  const [series, setSeries] = useState('');
  
  const [applyTopics, setApplyTopics] = useState(false);
  const [topicOperation, setTopicOperation] = useState<'add' | 'replace' | 'remove'>('add');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      // Reset form when opened
      setApplyAuthor(false);
      setAuthor('');
      setApplyBookType(false);
      setBookType('');
      setApplyPublisher(false);
      setPublisher('');
      setApplySeries(false);
      setSeries('');
      setApplyTopics(false);
      setTopicOperation('add');
      setSelectedTopics([]);
    }
  }, [isOpen]);

  const handleSave = () => {
    onSave({
      applyAuthor,
      author,
      applyBookType,
      bookType,
      applyPublisher,
      publisher,
      applySeries,
      series,
      applyTopics,
      topicOperation,
      topics: selectedTopics,
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[500] p-4" onClick={onClose}>
      <div 
        className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">تعديل {selectedCount} كتاب محدد</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          
          {/* Author */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="apply-author"
                checked={applyAuthor}
                onChange={(e) => setApplyAuthor(e.target.checked)}
                className="w-5 h-5 rounded border-border"
              />
              <label htmlFor="apply-author" className="font-medium text-lg cursor-pointer">
                تغيير المؤلف
              </label>
            </div>
            {applyAuthor && (
              <select
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">اختر المؤلف</option>
                {availableAuthors.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            )}
          </div>

          {/* Book Type */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="apply-book-type"
                checked={applyBookType}
                onChange={(e) => setApplyBookType(e.target.checked)}
                className="w-5 h-5 rounded border-border"
              />
              <label htmlFor="apply-book-type" className="font-medium text-lg cursor-pointer">
                تغيير نوع الكتاب
              </label>
            </div>
            {applyBookType && (
              <select
                value={bookType}
                onChange={(e) => setBookType(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">اختر النوع</option>
                {availableBookTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
          </div>

          {/* Publisher */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="apply-publisher"
                checked={applyPublisher}
                onChange={(e) => setApplyPublisher(e.target.checked)}
                className="w-5 h-5 rounded border-border"
              />
              <label htmlFor="apply-publisher" className="font-medium text-lg cursor-pointer">
                تغيير الناشر
              </label>
            </div>
            {applyPublisher && (
              <select
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">اختر الناشر</option>
                {availablePublishers.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            )}
          </div>

          {/* Series */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="apply-series"
                checked={applySeries}
                onChange={(e) => setApplySeries(e.target.checked)}
                className="w-5 h-5 rounded border-border"
              />
              <label htmlFor="apply-series" className="font-medium text-lg cursor-pointer">
                تغيير السلسلة
              </label>
            </div>
            {applySeries && (
              <select
                value={series}
                onChange={(e) => setSeries(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">اختر السلسلة</option>
                {availableSeries.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            )}
          </div>

          {/* Topics */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="apply-topics"
                checked={applyTopics}
                onChange={(e) => setApplyTopics(e.target.checked)}
                className="w-5 h-5 rounded border-border"
              />
              <label htmlFor="apply-topics" className="font-medium text-lg cursor-pointer">
                تعديل المواضيع
              </label>
            </div>
            {applyTopics && (
              <div className="space-y-3">
                {/* Topic Operation Mode */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setTopicOperation('add')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      topicOperation === 'add'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    إضافة
                  </button>
                  <button
                    type="button"
                    onClick={() => setTopicOperation('replace')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      topicOperation === 'replace'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    استبدال
                  </button>
                  <button
                    type="button"
                    onClick={() => setTopicOperation('remove')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      topicOperation === 'remove'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    حذف
                  </button>
                </div>

                {/* Topic Selection using TagMultiSelect */}
                <TagMultiSelect
                  availableTags={topicNames}
                  selectedTags={selectedTopics}
                  onTagsChange={setSelectedTopics}
                  placeholder="ابحث أو أضف موضوع..."
                  label={
                    topicOperation === 'add' ? 'المواضيع للإضافة' :
                    topicOperation === 'replace' ? 'المواضيع الجديدة (استبدال)' :
                    'المواضيع للحذف'
                  }
                />

                {/* Explanation */}
                <p className="text-sm text-muted-foreground">
                  {topicOperation === 'add' && '• سيتم إضافة المواضيع المحددة إلى المواضيع الحالية'}
                  {topicOperation === 'replace' && '• سيتم استبدال جميع المواضيع بالمواضيع المحددة'}
                  {topicOperation === 'remove' && '• سيتم حذف المواضيع المحددة من المواضيع الحالية'}
                </p>
              </div>
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-card border-t border-border p-6 flex gap-3 justify-end flex-wrap">
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl border border-border hover:bg-muted transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-3 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            <Save className="w-5 h-5" />
            حفظ التغييرات
          </button>
        </div>
      </div>
    </div>
  );
}
