import { useState, useEffect } from 'react';
import { X, Upload, Image as ImageIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Book } from './BooksSection';

interface BookEditModalProps {
  book: Book | null;
  topics: any[];
  onSave: (book: Book) => void;
  onClose: () => void;
}

const BOOK_TYPES = [
  'لاهوتي',
  'روحي',
  'طقسي',
  'تاريخي',
  'سير قديسين',
  'تفسير الكتاب المقدس',
  'عقائدي',
  'كتاب مقدس',
  'صلوات وتسابيح',
  'دراسات كنسية',
  'أدب مسيحي',
  'متنوع'
];

export function BookEditModal({ book, topics, onSave, onClose }: BookEditModalProps) {
  const [formData, setFormData] = useState<Book>({
    id: book?.id || '',
    title: book?.title || '',
    author: book?.author || '',
    bookType: book?.bookType || '',
    publisher: book?.publisher || '',
    series: book?.series || '',
    topics: book?.topics || [],
    year: book?.year || '',
    description: book?.description || '',
    dateAdded: book?.dateAdded || new Date().toISOString(),
    pdfFile: book?.pdfFile || '',
    coverImage: book?.coverImage || '',
    isFavorite: book?.isFavorite || false
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: keyof Book, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleTopicToggle = (topicName: string) => {
    const currentTopics = formData.topics || [];
    if (currentTopics.includes(topicName)) {
      handleInputChange('topics', currentTopics.filter(t => t !== topicName));
    } else {
      handleInputChange('topics', [...currentTopics, topicName]);
    }
  };

  const handleCoverImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleInputChange('coverImage', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleInputChange('pdfFile', reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'عنوان الكتاب مطلوب';
    }
    if (!formData.author.trim()) {
      newErrors.author = 'اسم المؤلف مطلوب';
    }
    if (!formData.bookType) {
      newErrors.bookType = 'نوع الكتاب مطلوب';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSave(formData);
    }
  };

  // تنسيق التاريخ ليكون مقروءاً بشكل لطيف في الـ input المغلق
  const formattedDate = formData.dateAdded 
    ? new Date(formData.dateAdded).toLocaleDateString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[400] p-4" onClick={onClose}>
      <div
        className="bg-card rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-2xl font-bold">
            {book ? 'تعديل كتاب' : 'إضافة كتاب جديد'}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Right Column */}
            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  عنوان الكتاب <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background ${
                    errors.title ? 'border-red-500' : 'border-border'
                  }`}
                  placeholder="أدخل عنوان الكتاب"
                />
                {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
              </div>

              {/* Author */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  المؤلف <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.author}
                  onChange={(e) => handleInputChange('author', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background ${
                    errors.author ? 'border-red-500' : 'border-border'
                  }`}
                  placeholder="أدخل اسم المؤلف"
                />
                {errors.author && <p className="text-red-500 text-sm mt-1">{errors.author}</p>}
              </div>

              {/* Book Type */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  نوع الكتاب <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.bookType}
                  onChange={(e) => handleInputChange('bookType', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background ${
                    errors.bookType ? 'border-red-500' : 'border-border'
                  }`}
                >
                  <option value="">اختر نوع الكتاب</option>
                  {BOOK_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                {errors.bookType && <p className="text-red-500 text-sm mt-1">{errors.bookType}</p>}
              </div>

              {/* Creation Date - Read Only ( التعديل المطلوب لغلق حقل التاريخ) */}
              <div>
                <label className="block text-sm font-medium mb-2 text-muted-foreground">
                  تاريخ إضافة العنصر (تلقائي)
                </label>
                <input
                  type="text"
                  value={formattedDate}
                  disabled
                  className="w-full px-4 py-2 border border-border rounded-lg bg-muted text-muted-foreground cursor-not-allowed opacity-80"
                />
              </div>

              {/* Publisher */}
              <div>
                <label className="block text-sm font-medium mb-2">الناشر</label>
                <input
                  type="text"
                  value={formData.publisher}
                  onChange={(e) => handleInputChange('publisher', e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                  placeholder="أدخل اسم الناشر"
                />
              </div>

              {/* Series */}
              <div>
                <label className="block text-sm font-medium mb-2">السلسلة</label>
                <input
                  type="text"
                  value={formData.series}
                  onChange={(e) => handleInputChange('series', e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                  placeholder="أدخل اسم السلسلة"
                />
              </div>

              {/* Year */}
              <div>
                <label className="block text-sm font-medium mb-2">سنة النشر</label>
                <input
                  type="text"
                  value={formData.year}
                  onChange={(e) => handleInputChange('year', e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                  placeholder="مثال: 2024"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium mb-2">نبذة عن الكتاب</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background min-h-[120px]"
                  placeholder="أدخل نبذة مختصرة عن محتوى الكتاب"
                />
              </div>
            </div>

            {/* Left Column */}
            <div className="space-y-4">
              {/* Cover Image */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  صورة الغلاف <span className="text-muted-foreground text-xs">(اختياري)</span>
                </label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center border-border">
                  {formData.coverImage ? (
                    <div className="space-y-2">
                      <img
                        src={formData.coverImage}
                        alt="Cover preview"
                        className="max-h-64 mx-auto rounded"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleInputChange('coverImage', '')}
                      >
                        إزالة
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <ImageIcon className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        انقر لرفع صورة الغلاف
                      </p>
                      <p className="text-xs text-muted-foreground">
                        سيتم استخدام صورة افتراضية إذا لم يتم الرفع
                      </p>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleCoverImageUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* PDF File */}
              <div>
                <label className="block text-sm font-medium mb-2">ملف الكتاب (PDF)</label>
                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center">
                  {formData.pdfFile ? (
                    <div className="space-y-2">
                      <div className="text-green-600 font-medium">✓ تم رفع الملف</div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleInputChange('pdfFile', '')}
                      >
                        إزالة
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm text-muted-foreground mb-2">
                        انقر لرفع ملف PDF
                      </p>
                      <input
                        type="file"
                        accept=".pdf"
                        onChange={handlePdfUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Topics */}
              <div>
                <label className="block text-sm font-medium mb-2">المواضيع</label>
                <div className="max-h-60 overflow-y-auto border border-border rounded-lg p-3 bg-background">
                  {topics.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      لا توجد مواضيع متاحة
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {topics.map(topic => (
                        <label
                          key={topic.id}
                          className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.topics.includes(topic.name)}
                            onChange={() => handleTopicToggle(topic.name)}
                            className="rounded border-border"
                          />
                          <span className="text-sm">{topic.name}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  عدد المواضيع المحددة: {formData.topics.length}
                </p>
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border flex-wrap">
          <Button variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit}>
            {book ? 'حفظ التعديلات' : 'إضافة الكتاب'}
          </Button>
        </div>
      </div>
    </div>
  );
}