import { X, Save, Plus, Trash2, Loader2, Upload, Image as ImageIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { apiPutJson } from '../services/apiClient';
import { presignAndUpload } from '../services/s3Upload';
import { getImageUrl } from '../utils/getImageUrl';
import { toast } from 'sonner';

export interface LiturgyReleaseItem {
  text: string;
  images: string[];
}

export interface LiturgyData {
  version: string;
  last_updated: string;
  download_link: string;
  release_notes: LiturgyReleaseItem[];
}

type ReleaseNoteInput = string | LiturgyReleaseItem;

function normalizeNotes(notes: ReleaseNoteInput[]): LiturgyReleaseItem[] {
  return (notes || []).map((note) =>
    typeof note === 'string' ? { text: note, images: [] } : { text: note.text || '', images: Array.isArray(note.images) ? note.images : [] }
  );
}

interface LiturgyEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: LiturgyData;
  onSaved: (data: LiturgyData) => void;
}

export function LiturgyEditModal({ isOpen, onClose, data, onSaved }: LiturgyEditModalProps) {
  const [version, setVersion] = useState(data.version);
  const [lastUpdated, setLastUpdated] = useState(data.last_updated);
  const [downloadLink, setDownloadLink] = useState(data.download_link);
  const [notes, setNotes] = useState<LiturgyReleaseItem[]>(normalizeNotes(data.release_notes));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [pendingUploadIndex, setPendingUploadIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleTextChange = (index: number, value: string) => {
    setNotes((prev) => prev.map((note, i) => (i === index ? { ...note, text: value } : note)));
  };

  const handleAddNote = () => {
    setNotes((prev) => [...prev, { text: '', images: [] }]);
  };

  const handleRemoveNote = (index: number) => {
    setNotes((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveImage = (noteIndex: number, imageIndex: number) => {
    setNotes((prev) =>
      prev.map((note, i) =>
        i === noteIndex
          ? { ...note, images: note.images.filter((_, imgIdx) => imgIdx !== imageIndex) }
          : note
      )
    );
  };

  const handlePickImages = (noteIndex: number) => {
    if (uploadingIndex !== null) return;
    setPendingUploadIndex(noteIndex);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []);
    const files = fileList.filter((f) => f && f.size > 0);
    const noteIndex = pendingUploadIndex;
    if (files.length === 0 || noteIndex === null) return;
    e.target.value = '';

    setUploadingIndex(noteIndex);
    setPendingUploadIndex(null);
    try {
      const uploads = await Promise.all(
        files.map(async (file) => {
          const result = await presignAndUpload(file, file.type || 'image/jpeg', 'Images');
          return result.url;
        })
      );
      if (uploads.length === 0) throw new Error('No files uploaded');
      setNotes((prev) =>
        prev.map((note, i) => (i === noteIndex ? { ...note, images: [...note.images, ...uploads] } : note))
      );
      toast.success(`تم رفع ${uploads.length} صورة بنجاح`);
    } catch {
      toast.error('فشل رفع الصور. حاول مرة أخرى.');
    } finally {
      setUploadingIndex(null);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  const handleSave = async () => {
    setError('');

    const trimmedVersion = version.trim();
    const trimmedLastUpdated = lastUpdated.trim();
    const trimmedNotes = notes
      .map((note) => ({ text: note.text.trim(), images: note.images }))
      .filter((note) => note.text || note.images.length > 0);

    if (!trimmedVersion) {
      setError('يرجى إدخال اسم النسخة');
      return;
    }
    if (!trimmedLastUpdated) {
      setError('يرجى إدخال تاريخ آخر تحديث');
      return;
    }

    const payload: LiturgyData = {
      version: trimmedVersion,
      last_updated: trimmedLastUpdated,
      download_link: downloadLink.trim(),
      release_notes: trimmedNotes,
    };

    setSaving(true);
    try {
      await apiPutJson('/api/auth/settings/liturgy', {
        settings: { liturgy_data: payload },
      });
      onSaved(payload);
      toast.success('تم حفظ التغييرات بنجاح');
      handleClose();
    } catch (err: any) {
      setError(err.message || 'فشل حفظ التغييرات. حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1200] p-4 overflow-y-auto" dir="rtl">
      <div className="bg-background rounded-xl max-w-2xl w-full p-6 relative my-auto max-h-[85vh] overflow-y-auto">
        <button
          onClick={handleClose}
          className="absolute top-4 left-4 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold mb-2 text-center">تعديل بيانات صفحة الليتورجية</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          عدّل اسم النسخة، تاريخ آخر تحديث، رابط التنزيل، وبنود التحديثات مع صورها
        </p>

        <div className="space-y-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg text-sm text-right">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">اسم النسخة (يظهر في العنوان)</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="ديسمبر 2025"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">تاريخ آخر تحديث</label>
            <input
              type="text"
              value={lastUpdated}
              onChange={(e) => setLastUpdated(e.target.value)}
              className="w-full px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="ديسمبر 2025"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">رابط التنزيل</label>
            <input
              type="text"
              dir="ltr"
              value={downloadLink}
              onChange={(e) => setDownloadLink(e.target.value)}
              className="w-full text-left px-4 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="https://www.mediafire.com/..."
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">بنود التحديثات</label>
              <button
                type="button"
                onClick={handleAddNote}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Plus className="w-4 h-4" />
                إضافة بند
              </button>
            </div>

            <div className="space-y-3">
              {notes.map((note, index) => (
                <div key={index} className="border border-border rounded-lg p-3 space-y-3">
                  <div className="flex items-start gap-2">
                    <textarea
                      value={note.text}
                      onChange={(e) => handleTextChange(index, e.target.value)}
                      rows={2}
                      className="flex-1 px-3 py-2 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm resize-none"
                      placeholder={`البند ${index + 1}`}
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveNote(index)}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0"
                      title="حذف البند"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {note.images.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {note.images.map((src, imageIndex) => (
                        <div key={imageIndex} className="relative group rounded-lg overflow-hidden border border-border">
                          <img
                            src={getImageUrl(src)}
                            alt={`صورة ${index + 1}`}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-24 object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(index, imageIndex)}
                            className="absolute top-1 left-1 p-1.5 bg-red-500 text-white rounded-md opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                            title="حذف الصورة"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <button
                      type="button"
                      onClick={() => handlePickImages(index)}
                      disabled={uploadingIndex !== null}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors cursor-pointer text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploadingIndex === index ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      <span className="flex items-center gap-1">
                        <ImageIcon className="w-4 h-4" />
                        {uploadingIndex === index ? 'جارٍ رفع الصور...' : 'إضافة صور'}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
              {notes.length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد بنود. اضغط "إضافة بند" لإضافة أول بند.</p>
              )}
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFilesSelected}
            className="sr-only"
            tabIndex={-1}
          />

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || uploadingIndex !== null}
              className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              {saving ? 'جارٍ الحفظ...' : 'حفظ التغييرات'}
            </button>
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="px-6 py-3 border border-border rounded-lg font-medium hover:bg-muted transition-colors disabled:opacity-50"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}