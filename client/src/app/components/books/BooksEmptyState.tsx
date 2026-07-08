import { BookOpen } from 'lucide-react';
import type { Book } from '../BooksSection';

interface BooksEmptyStateProps {
  searchQuery: string;
  activeFiltersCount: number;
}

export function BooksEmptyState({
  searchQuery,
  activeFiltersCount,
}: BooksEmptyStateProps) {
  return (
    <div className="text-center py-12">
      <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">لا توجد كتب</h3>
      <p className="text-muted-foreground">
        {searchQuery || activeFiltersCount > 0
          ? 'جرب تغيير معايير البحث أو الفلاتر'
          : 'لم يتم إضافة أي كتب بعد'}
      </p>
    </div>
  );
}

