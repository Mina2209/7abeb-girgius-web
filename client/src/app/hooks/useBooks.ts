import { useState, useCallback } from 'react';
import { apiGetJson, apiPostJson, apiPutJson, apiDeleteJson } from '../services/apiClient';
import type { Book } from '../components/BooksSection';
import type { BulkBookUpdates } from '../components/AdminBulkEditBooksModal';


interface BookEditModalProps {
  book: Book | null;
  topics: any[];
  // نعدل الـ onSave لتقبل FormData
  onSave: (formData: FormData) => void;
  onClose: () => void;
}
export function useBooks() {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. جلب جميع الكتب
  const fetchBooks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // السيرفر سيتعامل مع المسار بناءً على الـ Base URL الخاص بالـ apiClient
      const data = await apiGetJson<Book[]>('/books');
      
      // تسوية (Normalize) اسم الناشر ليكون متناسقاً في الفلاتر
      const normalizedBooks = data.map((book) => ({
        ...book,
        publisher: book.publisher && book.publisher.trim() !== '' ? book.publisher : 'غير محدد',
      }));
      
      setBooks(normalizedBooks);
    } catch (err: unknown) {
      console.error('فشل جلب مكتبة الكتب:', err);
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء جلب الكتب';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);


  // 2. إضافة كتاب جديد
  // يقبل FormData في حال قررتم رفع الملفات مباشرة كـ Binary، أو Object عادي
  const addBook = useCallback(async (bookData: Partial<Book> | FormData) => {
    setIsLoading(true);
    setError(null);
    try {
      const newBook = await apiPostJson<Book>('/books', bookData);
      setBooks((prev) => [
        {
          ...newBook,
          publisher: newBook.publisher && newBook.publisher.trim() !== '' ? newBook.publisher : 'غير محدد',
        },
        ...prev,
      ]);
      return newBook;
    } catch (err: unknown) {
      console.error('فشل إضافة الكتاب:', err);
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء حفظ الكتاب';
      setError(message);
      throw err; // رمي الخطأ ليتم التقاطه في الـ UI لو لزم الأمر
    } finally {

      setIsLoading(false);
    }
  }, []);

  // 3. تعديل كتاب موجود
  const updateBook = useCallback(async (bookId: string, bookData: Partial<Book> | FormData) => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedBook = await apiPutJson<Book>(`/books/${bookId}`, bookData);
      setBooks((prev) =>
        prev.map((b) => (b.id === bookId ? {
          ...updatedBook,
          publisher: updatedBook.publisher && updatedBook.publisher.trim() !== '' ? updatedBook.publisher : 'غير محدد'
        } : b))
      );
      return updatedBook;
    } catch (err: unknown) {
      console.error('فشل تعديل الكتاب:', err);
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تعديل الكتاب';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);


  // 4. حذف كتاب واحد
  const deleteBook = useCallback(async (bookId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await apiDeleteJson(`/books/${bookId}`);
      setBooks((prev) => prev.filter((book) => book.id !== bookId));
    } catch (err: unknown) {
      console.error('فشل حذف الكتاب:', err);
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء الحذف';
      setError(message);
      throw err;
    } finally {

      setIsLoading(false);
    }
  }, []);

  // 5. الحذف الجماعي للكتب
  const bulkDeleteBooks = useCallback(async (bookIds: string[]) => {
    setIsLoading(true);
    setError(null);
    try {
      // إرسال طلبات الحذف بالتوازي (يمكن تعديلها لطلب واحد إذا دعم الباك إند ذلك `DELETE /books/bulk`)
      await Promise.all(bookIds.map((id) => apiDeleteJson(`/books/${id}`)));
      setBooks((prev) => prev.filter((book) => !bookIds.includes(book.id)));
    } catch (err: unknown) {
      console.error('فشل الحذف الجماعي:', err);
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء الحذف الجماعي';
      setError(message);
      throw err;
    } finally {

      setIsLoading(false);
    }
  }, []);

  // 6. التعديل الجماعي للكتب
  const bulkUpdateBooks = useCallback(async (bookIds: string[], updates: BulkBookUpdates) => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedBooksFromServer = await apiPostJson<Book[]>('/books/bulk-update', {
        ids: bookIds,
        updates,
      });

      setBooks((prev) =>
        prev.map((book) => {
          const match = updatedBooksFromServer.find((b) => b.id === book.id);
          return match
            ? { ...match, publisher: match.publisher && match.publisher.trim() !== '' ? match.publisher : 'غير محدد' }
            : book;
        })
      );
    } catch (err: unknown) {
      console.error('فشل التحديث الجماعي:', err);
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء معالجة التحديث الجماعي';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 7. استيراد الكتب (Import JSON)
  const importBooks = useCallback(async (importedBooks: Partial<Book>[]) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await apiPostJson<Book[]>('/books/import', { books: importedBooks });
      setBooks(result); // تحديث القائمة بالكتب الجديدة أو استبدالها بالكامل بناءً على منطق السيرفر
      return result;
    } catch (err: unknown) {
      console.error('فشل استيراد الكتب:', err);
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء رفع الملف';
      setError(message);
      throw err;
    } finally {

      setIsLoading(false);
    }
  }, []);

  return {
    books,
    isLoading,
    error,
    fetchBooks,
    addBook,
    updateBook,
    deleteBook,
    bulkDeleteBooks,
    bulkUpdateBooks,
    importBooks,
  };
}