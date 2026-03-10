import { X, Heart, Download, Edit, Trash2, BookOpen, User, Building2, Library, Calendar } from 'lucide-react';
import { Button } from './ui/button';
import { Book, getDefaultBookCover } from './BooksSection';
import { useState, useEffect } from 'react';

interface BookDetailsModalProps {
  book: Book;
  onClose: () => void;
  onToggleFavorite: (bookId: string) => void;
  onEdit?: (book: Book) => void;
  onDelete?: (bookId: string) => void;
  onDownload?: (book: Book) => void;
}

export function BookDetailsModal({ book, onClose, onToggleFavorite, onEdit, onDelete, onDownload }: BookDetailsModalProps) {
  const [defaultCoverKey, setDefaultCoverKey] = useState(0);

  useEffect(() => {
    // Listen for default book cover changes
    const handleDefaultCoverChange = () => {
      setDefaultCoverKey(prev => prev + 1);
    };
    
    window.addEventListener('defaultBookCoverChanged', handleDefaultCoverChange);
    
    return () => {
      window.removeEventListener('defaultBookCoverChanged', handleDefaultCoverChange);
    };
  }, []);

  const handleDownload = () => {
    if (onDownload) {
      onDownload(book);
    } else {
      // Fallback mock download functionality
      alert('سيتم تحميل الكتاب قريباً...');
    }
  };

  const handleDelete = () => {
    if (confirm('هل أنت متأكد من حذف هذا الكتاب؟')) {
      onDelete?.(book.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[300] p-4" onClick={onClose}>
      <div
        className="bg-card rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3 flex-1">
            <BookOpen className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">{book.title}</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleFavorite(book.id)}
            >
              <Heart
                className={`w-5 h-5 ${
                  book.isFavorite ? 'fill-red-500 text-red-500' : ''
                }`}
              />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleDownload}>
              <Download className="w-5 h-5" />
            </Button>
            {onEdit && (
              <Button variant="ghost" size="sm" onClick={() => onEdit(book)}>
                <Edit className="w-5 h-5" />
              </Button>
            )}
            {onDelete && (
              <Button variant="ghost" size="sm" onClick={handleDelete}>
                <Trash2 className="w-5 h-5 text-destructive" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
            {/* Right Column - Book Info */}
            <div className="space-y-6">
              {/* Cover Image - Only show if book has a cover */}
              {book.coverImage && (
                <div className="aspect-[3/4] rounded-lg overflow-hidden border border-border">
                  <img
                    src={book.coverImage}
                    alt={book.title}
                    className="w-full h-full object-contain"
                    key={defaultCoverKey}
                  />
                </div>
              )}

              {/* Book Details */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <User className="w-4 h-4" />
                    المؤلف
                  </div>
                  <p className="font-semibold">{book.author}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <BookOpen className="w-4 h-4" />
                    نوع الكتاب
                  </div>
                  <p className="font-semibold">{book.bookType}</p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Building2 className="w-4 h-4" />
                    الناشر
                  </div>
                  <p className="font-semibold">{book.publisher}</p>
                </div>

                {book.series && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Library className="w-4 h-4" />
                      السلسلة
                    </div>
                    <p className="font-semibold">{book.series}</p>
                  </div>
                )}

                {book.year && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Calendar className="w-4 h-4" />
                      سنة النشر
                    </div>
                    <p className="font-semibold">{book.year}</p>
                  </div>
                )}

                {book.topics && book.topics.length > 0 && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">المواضيع</div>
                    <div className="flex flex-wrap gap-2">
                      {book.topics.map((topic, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm"
                        >
                          {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {book.description && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">نبذة عن الكتاب</div>
                    <p className="text-sm leading-relaxed">{book.description}</p>
                  </div>
                )}

                {book.dateAdded && (
                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                      <Calendar className="w-4 h-4" />
                      تاريخ الإضافة
                    </div>
                    <p className="font-semibold">{new Date(book.dateAdded).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Left Column - PDF Preview */}
            <div className="lg:col-span-2">
              <div className="bg-muted/30 rounded-lg border border-border p-4 h-full min-h-[600px]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">معاينة الكتاب</h3>
                  <Button size="sm" variant="default" onClick={handleDownload}>
                    <Download className="w-4 h-4 ml-2" />
                    تحميل PDF
                  </Button>
                </div>

                {/* PDF Viewer - Mock */}
                <div className="bg-white rounded border border-border h-[calc(100%-60px)] flex items-center justify-center">
                  <div className="text-center">
                    <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">معاينة الكتاب</p>
                    <p className="text-sm text-muted-foreground mb-4">
                      سيتم عرض محتوى الكتاب هنا عند رفع ملف PDF حقيقي
                    </p>
                    <Button onClick={handleDownload}>
                      <Download className="w-4 h-4 ml-2" />
                      تحميل الكتاب
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}