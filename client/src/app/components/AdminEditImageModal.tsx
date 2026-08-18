import { X, Save, Upload, Image as ImageIcon, Trash2, ChevronDown } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { TagMultiSelect } from './TagMultiSelect';
import { useUniversalTopics } from '../hooks/useUniversalTopics';
import type { GalleryImage } from '../types/content';

interface AdminEditImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (image: GalleryImage) => void;
  onSaveMultiple?: (images: GalleryImage[]) => void;
  image?: GalleryImage | null;
  allArtists: string[];
  allTypes: string[];
}

interface PendingImage {
  id: number;
  src: string;
  file: File;
  title: string;
  tags: string[];
  artist: string;
  type: string;
  aiGenerated: boolean;
}

export function AdminEditImageModal({
  isOpen,
  onClose,
  onSave,
  onSaveMultiple,
  image,
  allArtists,
  allTypes,
}: AdminEditImageModalProps) {
  const { topicNames } = useUniversalTopics(); // Get centralized topics
  const [formData, setFormData] = useState<GalleryImage>({
    id: 0,
    src: '',
    title: '',
    tags: [],
    artist: '',
    type: '',
    aiGenerated: false,
    uploadDate: new Date().toISOString().split('T')[0],
    published: false,
  });
  
  // For multiple image upload
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [isMultipleMode, setIsMultipleMode] = useState(false);
  const [commonArtist, setCommonArtist] = useState('');
  const [commonType, setCommonType] = useState('');
  const [commonTags, setCommonTags] = useState<string[]>([]);
  const [commonAiGenerated, setCommonAiGenerated] = useState(false);
  
  // For editing existing image
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [previewImage, setPreviewImage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // For custom artist/type
  const [showNewArtistInput, setShowNewArtistInput] = useState(false);
  const [showNewTypeInput, setShowNewTypeInput] = useState(false);
  const [newArtistValue, setNewArtistValue] = useState('');
  const [newTypeValue, setNewTypeValue] = useState('');

  // Reset form when image changes or modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (image) {
        // Edit mode
        setFormData(image);
        setPreviewImage(image.src);
        setIsMultipleMode(false);
        setPendingImages([]);
      } else {
        // New image mode
        setFormData({
          id: Date.now(),
          src: '',
          title: '',
          tags: [],
          artist: '',
          type: '',
          aiGenerated: false,
          uploadDate: new Date().toISOString().split('T')[0],
          published: false,
        });
        setPreviewImage('');
        setIsMultipleMode(false);
        setPendingImages([]);
        setCommonArtist('');
        setCommonType('');
        setCommonTags([]);
        setCommonAiGenerated(false);
      }
      setErrors({});
      setShowNewArtistInput(false);
      setShowNewTypeInput(false);
      setNewArtistValue('');
      setNewTypeValue('');
    }
  }, [isOpen, image]);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.title.trim()) {
      newErrors.title = 'العنوان مطلوب';
    }
    if (!formData.src && !previewImage) {
      newErrors.image = 'الصورة مطلوبة';
    }
    if (formData.tags.length === 0) {
      newErrors.tags = 'يجب اختيار تصنيف واحد على الأقل';
    }
    if (!formData.artist.trim()) {
      newErrors.artist = 'اسم الفنان مطلوب';
    }
    if (!formData.type.trim()) {
      newErrors.type = 'نوع الصورة مطلوب';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  // إذا قام المستخدم بتحديد أكثر من صورة
  if (files.length > 1) {
    setIsMultipleMode(true); // تحويل النموذج فوراً لوضع الصور المتعددة

    const newPendingImages = Array.from(files).map((file, index) => {
      return {
        id: Date.now() + index,
        file,
        src: URL.createObjectURL(file),
        title: file.name.split('.').slice(0, -1).join('.'), // اسم الملف الافتراضي كعنوان
        tags: [],
        artist: commonArtist || '',
        type: commonType || '',
        aiGenerated: commonAiGenerated || false
      };
    });

    setPendingImages((prev) => [...prev, ...newPendingImages]);
  } else {
    // إذا اختار صورة واحدة فقط وهو في وضع السينجل
    const file = files[0];
    setPreviewImage(URL.createObjectURL(file));
    setFormData((prev) => ({ ...prev, image: file, title: file.name.split('.').slice(0, -1).join('.') }));
  }
};

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isMultipleMode && pendingImages.length > 0) {
      // Save multiple images
      const imagesToSave: GalleryImage[] = pendingImages.map((img) => ({
        id: img.id,
        src: img.src,
        title: img.title || 'صورة بدون عنوان',
        tags: img.tags.length > 0 ? img.tags : commonTags,
        artist: img.artist || commonArtist,
        type: img.type || commonType,
        aiGenerated: img.aiGenerated || commonAiGenerated,
        uploadDate: new Date().toISOString().split('T')[0],
        published: false,
      }));

      if (onSaveMultiple) {
        onSaveMultiple(imagesToSave);
      }
      onClose();
    } else {
      // Save single image
      if (validateForm()) {
        const savedData = {
          ...formData,
          src: previewImage || formData.src,
        };
        onSave(savedData);
        onClose();
      }
    }
  };

  const handleRemovePendingImage = (id: number) => {
    setPendingImages(pendingImages.filter(img => img.id !== id));
    if (pendingImages.length === 1) {
      setIsMultipleMode(false);
    }
  };

  const updatePendingImage = (id: number, updates: Partial<PendingImage>) => {
    setPendingImages(pendingImages.map(img => 
      img.id === id ? { ...img, ...updates } : img
    ));
  };

  const applyCommonSettings = () => {
    setPendingImages(pendingImages.map(img => ({
      ...img,
      artist: commonArtist,
      type: commonType,
      tags: commonTags,
      aiGenerated: commonAiGenerated,
    })));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div 
        className="bg-background rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
          <h2 className="text-2xl font-bold">
            {image ? 'تعديل الصورة' : isMultipleMode ? `إضافة ${pendingImages.length} صورة` : 'إضافة صورة جديدة'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          {isMultipleMode ? (
            /* Multiple Images Mode */
            <div className="space-y-6">
              {/* Common Settings */}
              <div className="bg-card border border-border rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">الإعدادات المشتركة</h3>
                  <button
                    type="button"
                    onClick={applyCommonSettings}
                    className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm"
                  >
                    تطبيق على الكل
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Common Artist Dropdown */}
                  <div>
                    <label className="block text-sm font-medium mb-2">الفنان المشترك</label>
                    <div className="relative">
                      <select
                        value={showNewArtistInput ? '__new__' : commonArtist}
                        onChange={(e) => {
                          if (e.target.value === '__new__') {
                            setShowNewArtistInput(true);
                            setCommonArtist('');
                          } else {
                            setShowNewArtistInput(false);
                            setCommonArtist(e.target.value);
                          }
                        }}
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer"
                      >
                        <option value="">-- اختر فناناً --</option>
                        {allArtists.map((artist) => (
                          <option key={artist} value={artist}>{artist}</option>
                        ))}
                        <option value="__new__">+ إضافة فنان جديد</option>
                      </select>
                      <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    </div>
                    {showNewArtistInput && (
                      <input
                        type="text"
                        value={newArtistValue}
                        onChange={(e) => {
                          setNewArtistValue(e.target.value);
                          setCommonArtist(e.target.value);
                        }}
                        placeholder="اسم الفنان الجديد..."
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 mt-2"
                      />
                    )}
                  </div>

                  {/* Common Type Dropdown */}
                  <div>
                    <label className="block text-sm font-medium mb-2">النوع المشترك</label>
                    <div className="relative">
                      <select
                        value={showNewTypeInput ? '__new__' : commonType}
                        onChange={(e) => {
                          if (e.target.value === '__new__') {
                            setShowNewTypeInput(true);
                            setCommonType('');
                          } else {
                            setShowNewTypeInput(false);
                            setCommonType(e.target.value);
                          }
                        }}
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer"
                      >
                        <option value="">-- اختر نوعاً --</option>
                        {allTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                        <option value="__new__">+ إضافة نوع جديد</option>
                      </select>
                      <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                    </div>
                    {showNewTypeInput && (
                      <input
                        type="text"
                        value={newTypeValue}
                        onChange={(e) => {
                          setNewTypeValue(e.target.value);
                          setCommonType(e.target.value);
                        }}
                        placeholder="النوع الجديد..."
                        className="w-full px-4 py-3 bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 mt-2"
                      />
                    )}
                  </div>
                </div>

                {/* Common Tags */}
                <div>
                  <TagMultiSelect
                    availableTags={topicNames}
                    selectedTags={commonTags}
                    onTagsChange={(tags) => setCommonTags(tags)}
                  />
                </div>

                {/* Common AI Generated */}
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="commonAiGenerated"
                    checked={commonAiGenerated}
                    onChange={(e) => setCommonAiGenerated(e.target.checked)}
                    className="w-5 h-5 rounded border-border"
                  />
                  <label htmlFor="commonAiGenerated" className="text-sm font-medium cursor-pointer">
                    جميع الصور تم إنشاؤها بالذكاء الاصطناعي
                  </label>
                </div>
              </div>

              {/* Individual Images */}
              <div>
                <h3 className="text-lg font-semibold mb-4">الصور ({pendingImages.length})</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pendingImages.map((img) => (
                    <div key={img.id} className="bg-card border border-border rounded-xl overflow-hidden group">
                      {/* Image Preview */}
                      <div className="relative aspect-[4/3]">
                        <img src={img.src} alt={img.title} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemovePendingImage(img.id)}
                          className="absolute top-2 left-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Image Details */}
                      <div className="p-3 space-y-2">
                        <input
                          type="text"
                          value={img.title}
                          onChange={(e) => updatePendingImage(img.id, { title: e.target.value })}
                          placeholder="عنوان الصورة..."
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />

                        {/* Artist for this image */}
                        <input
                          type="text"
                          value={img.artist}
                          onChange={(e) => updatePendingImage(img.id, { artist: e.target.value })}
                          placeholder={`الفنان (افتراضي: ${commonArtist || 'غير محدد'})`}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />

                        {/* Type for this image */}
                        <input
                          type="text"
                          value={img.type}
                          onChange={(e) => updatePendingImage(img.id, { type: e.target.value })}
                          placeholder={`النوع (افتراضي: ${commonType || 'غير محدد'})`}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />

                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`ai-${img.id}`}
                            checked={img.aiGenerated}
                            onChange={(e) => updatePendingImage(img.id, { aiGenerated: e.target.checked })}
                            className="w-4 h-4 rounded border-border"
                          />
                          <label htmlFor={`ai-${img.id}`} className="text-xs cursor-pointer">
                            ذكاء اصطناعي
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Single Image Mode */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left Column - Image Upload */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    الصورة <span className="text-red-500">*</span>
                  </label>
                  
                  {/* Image Preview */}
                  <div 
                    className="relative w-full aspect-[4/3] bg-card border-2 border-dashed border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary transition-colors group"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {previewImage ? (
                      <>
                        <img
                          src={previewImage}
                          alt="Preview"
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <div className="text-white text-center">
                            <Upload className="w-8 h-8 mx-auto mb-2" />
                            <p className="text-sm">تغيير الصورة</p>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                        <ImageIcon className="w-12 h-12 mb-3" />
                        <p className="text-sm font-medium">انقر لتحميل صورة أو عدة صور</p>
                        <p className="text-xs mt-1">JPG أو PNG (حتى 5 ميجابايت)</p>
                      </div>
                    )}
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png"
                    multiple
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  {errors.image && <p className="text-red-500 text-sm mt-1">{errors.image}</p>}
                </div>

                {/* AI Generated Toggle */}
                <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
                  <input
                    type="checkbox"
                    id="aiGenerated"
                    checked={formData.aiGenerated}
                    onChange={(e) => setFormData({ ...formData, aiGenerated: e.target.checked })}
                    className="w-5 h-5 rounded border-border"
                  />
                  <label htmlFor="aiGenerated" className="text-sm font-medium cursor-pointer">
                    تم إنشاؤها بالذكاء الاصطناعي
                  </label>
                </div>

                {/* Published Toggle */}
                <div className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl">
                  <input
                    type="checkbox"
                    id="published"
                    checked={formData.published}
                    onChange={(e) => setFormData({ ...formData, published: e.target.checked })}
                    className="w-5 h-5 rounded border-border"
                  />
                  <label htmlFor="published" className="text-sm font-medium cursor-pointer">
                    منشورة (مرئية للجمهور)
                  </label>
                </div>
              </div>

              {/* Right Column - Form Fields */}
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    العنوان <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="عنوان الصورة..."
                  />
                  {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
                </div>

                {/* Artist Dropdown */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    الفنان <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={showNewArtistInput ? '__new__' : formData.artist}
                      onChange={(e) => {
                        if (e.target.value === '__new__') {
                          setShowNewArtistInput(true);
                          setFormData({ ...formData, artist: '' });
                        } else {
                          setShowNewArtistInput(false);
                          setFormData({ ...formData, artist: e.target.value });
                        }
                      }}
                      className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer"
                    >
                      <option value="">-- اختر فناناً --</option>
                      {allArtists.map((artist) => (
                        <option key={artist} value={artist}>{artist}</option>
                      ))}
                      <option value="__new__">+ إضافة فنان جديد</option>
                    </select>
                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  </div>
                  {showNewArtistInput && (
                    <input
                      type="text"
                      value={formData.artist}
                      onChange={(e) => setFormData({ ...formData, artist: e.target.value })}
                      placeholder="اسم الفنان الجديد..."
                      className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 mt-2"
                    />
                  )}
                  {errors.artist && <p className="text-red-500 text-sm mt-1">{errors.artist}</p>}
                </div>

                {/* Type Dropdown */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    النوع <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select
                      value={showNewTypeInput ? '__new__' : formData.type}
                      onChange={(e) => {
                        if (e.target.value === '__new__') {
                          setShowNewTypeInput(true);
                          setFormData({ ...formData, type: '' });
                        } else {
                          setShowNewTypeInput(false);
                          setFormData({ ...formData, type: e.target.value });
                        }
                      }}
                      className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 appearance-none cursor-pointer"
                    >
                      <option value="">-- اختر نوعاً --</option>
                      {allTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                      <option value="__new__">+ إضافة نوع جديد</option>
                    </select>
                    <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
                  </div>
                  {showNewTypeInput && (
                    <input
                      type="text"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                      placeholder="النوع الجديد..."
                      className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 mt-2"
                    />
                  )}
                  {errors.type && <p className="text-red-500 text-sm mt-1">{errors.type}</p>}
                </div>

                {/* Upload Date - Disabled to prevent modification */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-muted-foreground">
                    تاريخ الرفع (تلقائي)
                  </label>
                  <input
                    type="date"
                    disabled // يمنع المستخدم من تعديل تاريخ الرفع يدوياً نهائياً
                    value={formData.uploadDate}
                    className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-muted-foreground cursor-not-allowed focus:outline-none"
                  />
                </div>
              </div>

              {/* Tags Section - Full Width */}
              <div className="lg:col-span-2">
                <TagMultiSelect
                  availableTags={topicNames}
                  selectedTags={formData.tags}
                  onTagsChange={(tags) => setFormData({ ...formData, tags })}
                  error={errors.tags}
                />
              </div>
            </div>
          )}
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
            {isMultipleMode ? `حفظ ${pendingImages.length} صورة` : 'حفظ'}
          </button>
        </div>
      </div>
    </div>
  );
}