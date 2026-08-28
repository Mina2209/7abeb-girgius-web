import { BookOpen, Download, Edit2, Trash2, Heart } from 'lucide-react';
import type { Book } from '../BooksSection';
import { getImageUrl } from '../../utils/getImageUrl';

interface BookCardGridProps {
  isEditor: boolean;
  bulkEditMode: boolean;
  books: Book[];
  favoritedBooks: string[];
  selectedBookIds: string[];

  onViewBook: (book: Book) => void;
  onEditBook: (book: Book) => void;
  onDeleteBook: (bookId: string) => void;
  onDownloadBook: (book: Book) => void;
  onToggleFavorite: (bookId: string) => void;
}

export function BookCardGrid({
  isEditor,
  bulkEditMode,
  books,
  favoritedBooks,
  selectedBookIds,
  onViewBook,
  onEditBook,
  onDeleteBook,
  onDownloadBook,
  onToggleFavorite,
}: BookCardGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-6">
      {books.map((book) => {
        const isSelected = selectedBookIds.includes(book.id);
        const isFavorited = favoritedBooks.includes(book.id);

        return (
          <div
            key={book.id}
            onClick={() => !bulkEditMode && onViewBook(book)}
            className={`bg-card border border-border rounded-lg overflow-hidden group relative z-0 isolate flex flex-col ${
              !bulkEditMode ? 'cursor-pointer' : ''
            }`}
          >
            {isEditor && bulkEditMode && (
              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    // handled in parent via selectedBookIds update
                    // parent must update selectedBookIds
                  }}
                  className="hidden"
                />
                {/* NOTE: selection UI will be wired in follow-up patch after we refactor parent state handlers */}
                {isSelected && null}
              </div>
            )}

            <div className="relative aspect-[3/4] bg-muted overflow-hidden">
                  <img
                    src={getImageUrl(book.coverImage || '')}
                    alt={book.title}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain"
                  />

              {!bulkEditMode && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <div className="grid grid-cols-2 gap-1.5 w-full">
                      {isEditor ? (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditBook(book);
                            }}
                            className="flex items-center justify-center gap-1 px-2 py-1.5 bg-white/90 hover:bg-white text-black rounded-lg transition-opacity text-xs shadow-lg"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>تعديل</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteBook(book.id);
                            }}
                            className="flex items-center justify-center gap-1 px-2 py-1.5 bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-opacity text-xs shadow-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>حذف</span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDownloadBook(book);
                            }}
                            className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-black rounded-lg transition-opacity text-xs font-medium shadow-lg"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>تحميل الكتاب</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDownloadBook(book);
                          }}
                          className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-black rounded-lg transition-opacity text-xs shadow-lg"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>تحميل</span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div
                    className={`absolute top-3 left-3 z-10 transition-opacity duration-300 ${
                      isFavorited ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(book.id);
                      }}
                      className={`p-2 rounded-lg transition-opacity shadow-lg ${
                        isFavorited ? 'bg-red-500 text-white' : 'bg-white/90 hover:bg-white text-black'
                      }`}
                    >
                      <Heart className={`w-4 h-4 ${isFavorited ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                </>
              )}

              {bulkEditMode && isSelected && (
                <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
              )}
            </div>

            <div className="p-4 flex-1 group-hover:bg-muted transition-opacity">
              <h3 className="font-bold text-base mb-1 line-clamp-2">{book.title}</h3>
              <p className="text-sm text-muted-foreground">{book.author}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

