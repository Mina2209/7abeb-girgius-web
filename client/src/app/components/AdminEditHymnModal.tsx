import { X, Save, Video, FileVideo, Presentation, FileAudio, Upload, Trash2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { TagMultiSelect } from './TagMultiSelect';
import { useUniversalTopics } from '../hooks/useUniversalTopics';
import type { Hymn, HymnFile, HymnFileType as FileType } from '../types/content';

interface AdminEditHymnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (hymn: Hymn) => void;
  hymn?: Hymn | null;
}

const fileTypeOptions: { value: FileType; label: string; icon: any }[] = [
  { value: 'Video montage', label: 'فيديو مونتاج', icon: Video },
  { value: 'Video PowerPoint', label: 'فيديو بوربوينت', icon: FileVideo },
  { value: 'PowerPoint file', label: 'بوربوينت', icon: Presentation },
  { value: 'Music', label: 'موسيقى', icon: FileAudio },
];

export function AdminEditHymnModal({
  isOpen,
  onClose,
  onSave,
  hymn,
}: AdminEditHymnModalProps) {
  const { topicNames } = useUniversalTopics(); // Get centralized topics
  const [formData, setFormData] = useState<Hymn>({
    id: 0,
    title: '',
    duration: '',
    tags: [],
    createdAt: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString().split('T')[0],
    fileTypes: [],
    lyrics: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Refs for each file input
  const videoMontageInputRef = useRef<HTMLInputElement>(null);
  const videoPowerPointInputRef = useRef<HTMLInputElement>(null);
  const powerPointInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  // Reset form when hymn changes or modal opens/closes
  useEffect(() => {
    if (isOpen) {
      if (hymn) {
        setFormData(hymn);
      } else {
        // New hymn - generate new ID
        setFormData({
          id: Date.now(),
          title: '',
          duration: '',
          tags: [],
          createdAt: new Date().toISOString().split('T')[0],
          updatedAt: new Date().toISOString().split('T')[0],
          fileTypes: [],
          lyrics: '',
        });
      }
      setErrors({});
    }
  }, [isOpen, hymn]);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.title.trim()) {
      newErrors.title = 'العنوان مطلوب';
    }
    if (formData.tags.length === 0) {
      newErrors.tags = 'يجب اختيار تصنيف واحد على الأقل';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      // Auto-calculate fileTypes from uploaded files
      const uniqueFileTypes = Array.from(new Set((formData.files || []).map(file => file.type)));
      
      // Update the updatedAt timestamp and fileTypes
      const savedData = {
        ...formData,
        fileTypes: uniqueFileTypes,
        updatedAt: new Date().toISOString().split('T')[0],
      };
      onSave(savedData);
      onClose();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, fileType: FileType) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const newFile: HymnFile = {
          type: fileType,
          name: file.name,
          url: base64String,
          size: file.size,
        };
        
        // Add file to the list
        setFormData({ 
          ...formData, 
          files: [...(formData.files || []), newFile]
        });

        // If it's a video file, calculate its duration
        if (fileType === 'Video montage' || fileType === 'Video PowerPoint') {
          const video = document.createElement('video');
          video.preload = 'metadata';
          
          video.onloadedmetadata = () => {
            const durationInSeconds = Math.floor(video.duration);
            const minutes = Math.floor(durationInSeconds / 60);
            const seconds = durationInSeconds % 60;
            const formattedDuration = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            
            // Update the duration in formData
            setFormData(prev => ({
              ...prev,
              duration: formattedDuration
            }));
            
            // Clean up
            URL.revokeObjectURL(video.src);
          };
          
          video.src = URL.createObjectURL(file);
        }
      };
      reader.readAsDataURL(file);
    }
    
    // Reset the input
    if (e.target) {
      e.target.value = '';
    }
  };

  const handleRemoveFile = (fileName: string) => {
    setFormData({ ...formData, files: formData.files?.filter(file => file.name !== fileName) });
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) {
      return `${mb.toFixed(2)} MB`;
    }
    const kb = bytes / 1024;
    return `${kb.toFixed(2)} KB`;
  };

  const getFileTypeIcon = (fileType: FileType) => {
    const option = fileTypeOptions.find(opt => opt.value === fileType);
    return option ? option.icon : FileAudio;
  };

  const getFileTypeLabel = (fileType: FileType) => {
    const option = fileTypeOptions.find(opt => opt.value === fileType);
    return option ? option.label : fileType;
  };

  // Check if a file type already has a file uploaded
  const hasFileOfType = (fileType: FileType): boolean => {
    return formData.files?.some(file => file.type === fileType) || false;
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
            {hymn ? 'تعديل الترنيمة' : 'إضافة ترنيمة جديدة'}
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
              placeholder="عنوان الترنيمة..."
            />
            {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
          </div>

          {/* Lyrics */}
          <div>
            <label className="block text-sm font-medium mb-2">
              الكلمات <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.lyrics}
              onChange={(e) => setFormData({ ...formData, lyrics: e.target.value })}
              className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[200px] resize-y font-mono"
              placeholder="أدخل كلمات الترنيمة..."
            />
            {errors.lyrics && <p className="text-red-500 text-sm mt-1">{errors.lyrics}</p>}
          </div>

          {/* Duration Display (Auto-calculated) */}
          {formData.duration && (
            <div>
              <label className="block text-sm font-medium mb-2">
                المدة (محسوبة تلقائياً)
              </label>
              <div className="flex items-center gap-3 px-4 py-3 bg-muted border border-border rounded-xl">
                <Video className="w-5 h-5 text-primary" />
                <span className="text-lg font-semibold text-primary">{formData.duration}</span>
                <span className="text-sm text-muted-foreground">دقيقة:ثانية</span>
              </div>
            </div>
          )}

          {/* Upload Files */}
          <div>
            <label className="block text-sm font-medium mb-2">
              رفع ملفات <span className="text-red-500">*</span>
            </label>
            <p className="text-sm text-muted-foreground mb-3">
              ملف واحد لكل نوع - يختفي الزر بعد الرفع
            </p>
            
            {/* Four Dedicated Upload Buttons */}
            <div className="grid grid-cols-2 gap-3">
              {/* Video Montage */}
              {!hasFileOfType('Video montage') && (
                <button
                  type="button"
                  onClick={() => videoMontageInputRef.current?.click()}
                  className="flex items-center gap-3 px-4 py-3 bg-card border-2 border-dashed border-border rounded-xl hover:bg-muted hover:border-primary transition-all"
                >
                  <Video className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 text-right">
                    <p className="text-sm font-medium">رفع فيديو مونتاج</p>
                    <p className="text-xs text-muted-foreground">MP4, AVI, MOV</p>
                  </div>
                  <Upload className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              <input
                type="file"
                ref={videoMontageInputRef}
                onChange={(e) => handleFileUpload(e, 'Video montage')}
                className="hidden"
                accept="video/*,.mp4,.avi,.mov"
              />

              {/* Video PowerPoint */}
              {!hasFileOfType('Video PowerPoint') && (
                <button
                  type="button"
                  onClick={() => videoPowerPointInputRef.current?.click()}
                  className="flex items-center gap-3 px-4 py-3 bg-card border-2 border-dashed border-border rounded-xl hover:bg-muted hover:border-primary transition-all"
                >
                  <FileVideo className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 text-right">
                    <p className="text-sm font-medium">رفع فيديو بوربوينت</p>
                    <p className="text-xs text-muted-foreground">MP4, AVI, MOV</p>
                  </div>
                  <Upload className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              <input
                type="file"
                ref={videoPowerPointInputRef}
                onChange={(e) => handleFileUpload(e, 'Video PowerPoint')}
                className="hidden"
                accept="video/*,.mp4,.avi,.mov"
              />

              {/* PowerPoint File */}
              {!hasFileOfType('PowerPoint file') && (
                <button
                  type="button"
                  onClick={() => powerPointInputRef.current?.click()}
                  className="flex items-center gap-3 px-4 py-3 bg-card border-2 border-dashed border-border rounded-xl hover:bg-muted hover:border-primary transition-all"
                >
                  <Presentation className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 text-right">
                    <p className="text-sm font-medium">رفع بوربوينت</p>
                    <p className="text-xs text-muted-foreground">PPT, PPTX</p>
                  </div>
                  <Upload className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              <input
                type="file"
                ref={powerPointInputRef}
                onChange={(e) => handleFileUpload(e, 'PowerPoint file')}
                className="hidden"
                accept=".ppt,.pptx,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
              />

              {/* Music */}
              {!hasFileOfType('Music') && (
                <button
                  type="button"
                  onClick={() => musicInputRef.current?.click()}
                  className="flex items-center gap-3 px-4 py-3 bg-card border-2 border-dashed border-border rounded-xl hover:bg-muted hover:border-primary transition-all"
                >
                  <FileAudio className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div className="flex-1 text-right">
                    <p className="text-sm font-medium">رفع موسيقى</p>
                    <p className="text-xs text-muted-foreground">MP3</p>
                  </div>
                  <Upload className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
              <input
                type="file"
                ref={musicInputRef}
                onChange={(e) => handleFileUpload(e, 'Music')}
                className="hidden"
                accept="audio/mp3,audio/mpeg,.mp3"
              />
            </div>
            
            {/* Uploaded Files Display */}
            {formData.files && formData.files.length > 0 && (
              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-medium">الملفات المرفوعة ({formData.files.length}):</h3>
                <div className="space-y-2">
                  {formData.files.map((file) => {
                    const FileIcon = getFileTypeIcon(file.type);
                    return (
                      <div
                        key={file.name}
                        className="flex items-center gap-3 p-3 bg-card border border-border rounded-xl hover:bg-muted transition-colors group"
                      >
                        {/* File Icon */}
                        <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                          <FileIcon className="w-5 h-5 text-primary" />
                        </div>
                        
                        {/* File Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">
                              {getFileTypeLabel(file.type)}
                            </span>
                            {file.size && (
                              <>
                                <span className="text-xs text-muted-foreground">•</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatFileSize(file.size)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        
                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={() => handleRemoveFile(file.name)}
                          className="flex-shrink-0 p-2 hover:bg-red-500/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                          title="حذف الملف"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {errors.files && <p className="text-red-500 text-sm mt-1">{errors.files}</p>}
          </div>

          {/* Tags */}
          <TagMultiSelect
            availableTags={topicNames}
            selectedTags={formData.tags}
            onTagsChange={(tags) => setFormData({ ...formData, tags })}
            error={errors.tags}
          />

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                تاريخ الإنشاء
              </label>
              <input
                type="date"
                value={formData.createdAt}
                onChange={(e) => setFormData({ ...formData, createdAt: e.target.value })}
                className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                تاريخ التحديث
              </label>
              <input
                type="date"
                value={formData.updatedAt}
                disabled
                className="w-full px-4 py-3 bg-muted border border-border rounded-xl text-muted-foreground cursor-not-allowed"
                title="يتم التحديث تلقائياً عند الحفظ"
              />
            </div>
          </div>
        </form>

        {/* Footer */}
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