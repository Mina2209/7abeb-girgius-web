import { X, Save } from 'lucide-react';
import { useState, useEffect } from 'react';
import { TagMultiSelect } from './TagMultiSelect';
import { useUniversalTopics } from '../hooks/useUniversalTopics';

interface GalleryImage {
  id: number;
  src: string;
  title: string;
  artist: string;
  tags: string[];
  type: string;
  aiGenerated: boolean;
  published: boolean;
}

interface AdminBulkEditImagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (updates: BulkImageUpdates) => void;
  selectedCount: number;
  availableArtists: string[];
  availableTypes: string[];
}

export interface BulkImageUpdates {
  applyArtist: boolean;
  artist: string;
  applyType: boolean;
  type: string;
  applyAiStatus: boolean;
  aiGenerated: boolean;
  applyTags: boolean;
  tagOperation: 'add' | 'replace' | 'remove';
  tags: string[];
  applyPublished: boolean;
  published: boolean;
}

export function AdminBulkEditImagesModal({
  isOpen,
  onClose,
  onSave,
  selectedCount,
  availableArtists,
  availableTypes,
}: AdminBulkEditImagesModalProps) {
  const { topicNames } = useUniversalTopics(); // Get centralized topics
  const [applyArtist, setApplyArtist] = useState(false);
  const [artist, setArtist] = useState('');
  
  const [applyType, setApplyType] = useState(false);
  const [type, setType] = useState('');
  
  const [applyAiStatus, setApplyAiStatus] = useState(false);
  const [aiGenerated, setAiGenerated] = useState(false);
  
  const [applyTags, setApplyTags] = useState(false);
  const [tagOperation, setTagOperation] = useState<'add' | 'replace' | 'remove'>('add');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  
  const [applyPublished, setApplyPublished] = useState(false);
  const [published, setPublished] = useState(true);

  useEffect(() => {
    if (isOpen) {
      // Reset form when opened
      setApplyArtist(false);
      setArtist('');
      setApplyType(false);
      setType('');
      setApplyAiStatus(false);
      setAiGenerated(false);
      setApplyTags(false);
      setTagOperation('add');
      setSelectedTags([]);
      setApplyPublished(false);
      setPublished(true);
    }
  }, [isOpen]);

  const handleSave = () => {
    onSave({
      applyArtist,
      artist,
      applyType,
      type,
      applyAiStatus,
      aiGenerated,
      applyTags,
      tagOperation,
      tags: selectedTags,
      applyPublished,
      published
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-x-hidden" onClick={onClose}>
      <div 
        className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold">تعديل {selectedCount} صورة محددة</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-6">
          
          {/* Artist */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="apply-artist"
                checked={applyArtist}
                onChange={(e) => setApplyArtist(e.target.checked)}
                className="w-5 h-5 rounded border-border"
              />
              <label htmlFor="apply-artist" className="font-medium text-lg cursor-pointer">
                تغيير الفنان
              </label>
            </div>
            {applyArtist && (
              <select
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">اختر الفنان</option>
                {availableArtists.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            )}
          </div>

          {/* Type */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="apply-type"
                checked={applyType}
                onChange={(e) => setApplyType(e.target.checked)}
                className="w-5 h-5 rounded border-border"
              />
              <label htmlFor="apply-type" className="font-medium text-lg cursor-pointer">
                تغيير النوع
              </label>
            </div>
            {applyType && (
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">اختر النوع</option>
                {availableTypes.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            )}
          </div>

          {/* AI Status */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="apply-ai"
                checked={applyAiStatus}
                onChange={(e) => setApplyAiStatus(e.target.checked)}
                className="w-5 h-5 rounded border-border"
              />
              <label htmlFor="apply-ai" className="font-medium text-lg cursor-pointer">
                تغيير حالة AI
              </label>
            </div>
            {applyAiStatus && (
              <select
                value={aiGenerated ? 'true' : 'false'}
                onChange={(e) => setAiGenerated(e.target.value === 'true')}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="true">مُنشأ بواسطة AI</option>
                <option value="false">غير مُنشأ بواسطة AI</option>
              </select>
            )}
          </div>

          {/* Tags */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="apply-tags"
                checked={applyTags}
                onChange={(e) => setApplyTags(e.target.checked)}
                className="w-5 h-5 rounded border-border"
              />
              <label htmlFor="apply-tags" className="font-medium text-lg cursor-pointer">
                تعديل المواضيع
              </label>
            </div>
            {applyTags && (
              <div className="space-y-3">
                {/* Tag Operation Mode */}
                <div className="flex gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setTagOperation('add')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      tagOperation === 'add'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    إضافة
                  </button>
                  <button
                    type="button"
                    onClick={() => setTagOperation('replace')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      tagOperation === 'replace'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    استبدال
                  </button>
                  <button
                    type="button"
                    onClick={() => setTagOperation('remove')}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      tagOperation === 'remove'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/80'
                    }`}
                  >
                    حذف
                  </button>
                </div>

                {/* Tag Selection using TagMultiSelect */}
                <TagMultiSelect
                  availableTags={topicNames}
                  selectedTags={selectedTags}
                  onTagsChange={setSelectedTags}
                  placeholder="ابحث أو أضف موضوع..."
                  label={
                    tagOperation === 'add' ? 'المواضيع للإضافة' :
                    tagOperation === 'replace' ? 'المواضيع الجديدة (استبدال)' :
                    'المواضيع للحذف'
                  }
                />

                {/* Explanation */}
                <p className="text-sm text-muted-foreground">
                  {tagOperation === 'add' && '• سيتم إضافة المواضيع المحددة إلى المواضيع الحالية'}
                  {tagOperation === 'replace' && '• سيتم استبدال جميع المواضيع بالمواضيع المحددة'}
                  {tagOperation === 'remove' && '• سيتم حذف المواضيع المحددة من المواضيع الحالية'}
                </p>
              </div>
            )}
          </div>

          {/* Published Status */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="apply-published"
                checked={applyPublished}
                onChange={(e) => setApplyPublished(e.target.checked)}
                className="w-5 h-5 rounded border-border"
              />
              <label htmlFor="apply-published" className="font-medium text-lg cursor-pointer">
                تغيير حالة النشر
              </label>
            </div>
            {applyPublished && (
              <select
                value={published ? 'true' : 'false'}
                onChange={(e) => setPublished(e.target.value === 'true')}
                className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="true">منشورة</option>
                <option value="false">مخفية</option>
              </select>
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