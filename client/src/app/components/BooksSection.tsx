import { useState, useEffect, useMemo, useRef } from "react";

import {
  Search,
  Plus,
  BookOpen,
  X,
  Heart,
  Download,
  Edit2,
  Trash2,
  ArrowUpDown,
  ChevronDown,
  User,
  Building2,
  Library,
  CheckSquare,
  CheckCheck,
  Upload,
  Tags,
} from "lucide-react";


import { BookDetailsModal } from "./BookDetailsModal";
import { BookEditModal } from "./BookEditModal";
import {
  AdminBulkEditBooksModal,
  BulkBookUpdates,
} from "./AdminBulkEditBooksModal";
import { useIsEditor } from "../utils/adminUtils";
import { useAuth } from "../contexts/AuthContext";
import { useBooks } from "../hooks/useBooks";
import { useFavorites } from "../hooks/useFavorites";
import { normalizeArabic } from "../utils/arabicUtils";
import { downloadFile } from "../utils/download";

import { useTags } from "../hooks/useTags";


import { BooksFiltersToolbar } from "./books/BooksFiltersToolbar";
import { BulkActionsBar } from "./books/BulkActionsBar";
import { BookCardGrid } from "./books/BookCardGrid";
import { BooksEmptyState } from "./books/BooksEmptyState";
import { TagFilter } from "./TagFilter";
import { MultiSelectFilter } from "./MultiSelectFilter";



const FALLBACK_BOOK_COVER =
  "https://images.unsplash.com/photo-1569690484582-58b478f46805?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib29rJTIwY292ZXIlMjBwbGFjZWhvbGRlcnxlbnwxfHx8fDE3Njg1NzEyMTd8MA&ixlib=rb-4.1.0&q=80&w=1080";

export const getDefaultBookCover = () => {
  // Source of truth is server-side settings; keep a hard fallback for first load / offline.
  return FALLBACK_BOOK_COVER;
};

export interface Book {
  id: string;
  title: string;
  author: string;
  bookType: string;
  publisher: string;
  series: string;
  topics: string[];
  year: string;
  description: string;
  dateAdded: string;
  pdfFile: string; 
  coverImage?: string; 
  isFavorite?: boolean;
}

interface BooksSectionProps {
  isSidebarCollapsed?: boolean;
}

type SortOption =
  | "date-newest"
  | "date-oldest"
  | "title-asc"
  | "title-desc"
  | "year-newest"
  | "year-oldest";

const sortOptions = [
  { value: "date-newest" as SortOption, label: "الأحدث أولاً" },
  { value: "date-oldest" as SortOption, label: "الأقدم أولاً" },
  { value: "title-asc" as SortOption, label: "العنوان (أ-ي)" },
  { value: "title-desc" as SortOption, label: "العنوان (ي-أ)" },
  { value: "year-newest" as SortOption, label: "سنة النشر (الأحدث)" },
  { value: "year-oldest" as SortOption, label: "سنة النشر (الأقدم)" },
];

type BookFacet = "topics" | "authors" | "publishers" | "series" | "bookTypes";

const sortArabic = (a: string, b: string) => a.localeCompare(b, "ar");

const uniqueSorted = (values: string[]) =>
  Array.from(new Set(values.filter(Boolean))).sort(sortArabic);

const normalizeSearchText = (text: string) => normalizeArabic(text).toLowerCase();

function bookMatchesSearch(book: Book, query: string) {
  if (!query) return true;
  const normalizedQuery = normalizeSearchText(query);
  return (
    normalizeSearchText(book.title).includes(normalizedQuery) ||
    normalizeSearchText(book.author).includes(normalizedQuery) ||
    normalizeSearchText(book.publisher).includes(normalizedQuery) ||
    normalizeSearchText(book.description).includes(normalizedQuery) ||
    book.topics.some((topic) => normalizeSearchText(topic).includes(normalizedQuery))
  );
}

function bookMatchesTopics(book: Book, selectedTopics: string[]) {
  return (
    selectedTopics.length === 0 ||
    book.topics.some((topic) => selectedTopics.includes(topic))
  );
}

function bookMatchesAuthors(book: Book, selectedAuthors: string[]) {
  return selectedAuthors.length === 0 || selectedAuthors.includes(book.author);
}

function bookMatchesPublishers(book: Book, selectedPublishers: string[]) {
  return (
    selectedPublishers.length === 0 ||
    selectedPublishers.includes(book.publisher)
  );
}

function bookMatchesSeries(book: Book, selectedSeries: string[]) {
  return selectedSeries.length === 0 || selectedSeries.includes(book.series);
}

function bookMatchesTypes(book: Book, selectedBookTypes: string[]) {
  return (
    selectedBookTypes.length === 0 ||
    selectedBookTypes.includes(book.bookType)
  );
}

function bookMatchesFavorites(
  book: Book,
  showFavoritesOnly: boolean,
  favoritedBooks: string[],
) {
  return !showFavoritesOnly || favoritedBooks.includes(book.id);
}

function getBooksForFacet(
  books: Book[],
  params: {
    searchQuery: string;
    selectedTopics: string[];
    selectedAuthors: string[];
    selectedPublishers: string[];
    selectedSeries: string[];
    selectedBookTypes: string[];
    showFavoritesOnly: boolean;
    favoritedBooks: string[];
    excludeFacet?: BookFacet;
  },
) {
  const {
    searchQuery,
    selectedTopics,
    selectedAuthors,
    selectedPublishers,
    selectedSeries,
    selectedBookTypes,
    showFavoritesOnly,
    favoritedBooks,
    excludeFacet,
  } = params;

  return books.filter((book) => {
    if (!bookMatchesSearch(book, searchQuery)) return false;
    if (excludeFacet !== "topics" && !bookMatchesTopics(book, selectedTopics)) {
      return false;
    }
    if (excludeFacet !== "authors" && !bookMatchesAuthors(book, selectedAuthors)) {
      return false;
    }
    if (
      excludeFacet !== "publishers" &&
      !bookMatchesPublishers(book, selectedPublishers)
    ) {
      return false;
    }
    if (excludeFacet !== "series" && !bookMatchesSeries(book, selectedSeries)) {
      return false;
    }
    if (
      excludeFacet !== "bookTypes" &&
      !bookMatchesTypes(book, selectedBookTypes)
    ) {
      return false;
    }
    if (!bookMatchesFavorites(book, showFavoritesOnly, favoritedBooks)) {
      return false;
    }
    return true;
  });
}

export function BooksSection({ isSidebarCollapsed }: BooksSectionProps) {
  const { user, profile } = useAuth(); 
  const isEditor = useIsEditor();

  const {
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
  } = useBooks();

  const [topics, setTopics] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [selectedPublishers, setSelectedPublishers] = useState<string[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<string[]>([]);
  const [selectedBookTypes, setSelectedBookTypes] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortOption>("date-newest");
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const { favoriteIds: favoritedBookIds, toggleFavorite: apiToggleFavorite, count: favoritedCount } = useFavorites('BOOK');
  const favoritedBooks = Array.from(favoritedBookIds);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [bulkEditMode, setBulkEditMode] = useState(false);

  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const filtersContainerRef = useRef<HTMLDivElement>(null!);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [defaultCoverKey, setDefaultCoverKey] = useState(0);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  useEffect(() => {
    const handleDefaultCoverChange = () => {
      setDefaultCoverKey((prev) => prev + 1);
    };

    window.addEventListener("defaultBookCoverChanged", handleDefaultCoverChange);
    return () => {
      window.removeEventListener("defaultBookCoverChanged", handleDefaultCoverChange);
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (scrollContainerRef.current) {
        const scrollTop = scrollContainerRef.current.scrollTop;
        setIsScrolled(scrollTop > 20);
      }
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll);
      handleScroll();
    }

    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener("scroll", handleScroll);
      }
    };
  }, [scrollContainerRef.current, books]);

  const { tags, isLoadingTags, tagsError } = useTags();

  useEffect(() => {
    setTopics(tags);
  }, [tags]);

  // تحديث حالة المفضلة
  const toggleFavorite = async (bookId: string) => {
    apiToggleFavorite(bookId);
  };

  // إضافة أو تعديل كتاب
  const handleSaveBook = async (bookData: Book) => {
    try {
      if (editingBook) {
        await updateBook(bookData.id, bookData);
      } else {
        await addBook(bookData);
      }
      setShowEditModal(false);
    } catch (error) {
      console.error("حدث خطأ أثناء حفظ الكتاب على السيرفر:", error);
    }
  };

  // حذف كتاب
  const handleDeleteBook = async (bookId: string) => {
    if (confirm("هل أنت متأكد من حذف هذا الكتاب؟")) {
      try {
        await deleteBook(bookId);
      } catch (error) {
        console.error("فشل حذف الكتاب من السيرفر:", error);
      }
    }
  };

  // حذف جماعي للكتب
  const handleBulkDelete = async () => {
    if (confirm(`هل أنت متأكد من حذف ${selectedBookIds.length} كتاب؟`)) {
      try {
        await bulkDeleteBooks(selectedBookIds);
        setSelectedBookIds([]);
      } catch (error) {
        console.error("فشل حذف مجموعة الكتب من السيرفر:", error);
      }
    }
  };

  // تعديل جماعي للكتب
  const handleBulkEditSave = async (updates: BulkBookUpdates) => {
    try {
      await bulkUpdateBooks(selectedBookIds, updates);
      setIsBulkEditModalOpen(false);
      setSelectedBookIds([]);
      setBulkEditMode(false);
      alert("تم تحديث الكتب بنجاح");
    } catch (error) {
      console.error("فشل التحديث الجماعي على السيرفر:", error);
      alert("خطأ أثناء معالجة التحديث الجماعي");
    }
  };

  const handleAddNew = () => {
    setEditingBook(null);
    setShowEditModal(true);
  };

  const handleEditBook = (book: Book) => {
    setEditingBook(book);
    setShowEditModal(true);
  };

  const handleSelectAll = () => {
    if (selectedBookIds.length === filteredAndSortedBooks.length) {
      setSelectedBookIds([]);
    } else {
      setSelectedBookIds(filteredAndSortedBooks.map((b) => b.id));
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(books, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "books-library.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const importedBooks = JSON.parse(event.target?.result as string);
          if (Array.isArray(importedBooks)) {
            await importBooks(importedBooks);
            alert("تم استيراد البيانات بنجاح بالسيرفر!");
          } else {
            alert("تنسيق الملف غير صحيح");
          }
        } catch (error) {
          alert("خطأ في قراءة أو رفع الملف");
        }
      };
      reader.readAsText(file);
    }
  };

  const handleViewBook = (book: Book) => {
    setSelectedBook(book);
    setShowDetailsModal(true);
  };

  const downloadBook = (book: Book) => {
    downloadFile(book.pdfFile, `${book.title}.pdf`);
  };

  // مجموعات الميمو للفلاتر
  const allAuthors = useMemo(() => uniqueSorted(books.map((b) => b.author)), [books]);
  const allPublishers = useMemo(() => uniqueSorted(books.map((b) => b.publisher).filter((p) => p !== "غير محدد")), [books]);
  const allSeries = useMemo(() => uniqueSorted(books.map((b) => b.series)), [books]);
  const allBookTypes = useMemo(() => uniqueSorted(books.map((b) => b.bookType)), [books]);

  const filteredAndSortedBooks = useMemo(() => {
    let filtered = books.filter((book) => {
      if (searchQuery && !bookMatchesSearch(book, searchQuery)) return false;
      if (selectedTopics.length > 0 && !bookMatchesTopics(book, selectedTopics)) return false;
      if (selectedAuthors.length > 0 && !bookMatchesAuthors(book, selectedAuthors)) return false;
      if (selectedPublishers.length > 0 && !bookMatchesPublishers(book, selectedPublishers)) return false;
      if (selectedSeries.length > 0 && !bookMatchesSeries(book, selectedSeries)) return false;
      if (selectedBookTypes.length > 0 && !bookMatchesTypes(book, selectedBookTypes)) return false;
      return !showFavoritesOnly || favoritedBooks.includes(book.id);
    });

    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-newest":
          return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
        case "date-oldest":
          return new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime();
        case "title-asc":
          return a.title.localeCompare(b.title, "ar");
        case "title-desc":
          return b.title.localeCompare(a.title, "ar");
        case "year-newest":
          return (b.year || "0").localeCompare(a.year || "0");
        case "year-oldest":
          return (a.year || "0").localeCompare(b.year || "0");
        default:
          return 0;
      }
    });

    return filtered;
  }, [books, searchQuery, selectedTopics, selectedAuthors, selectedPublishers, selectedSeries, selectedBookTypes, sortBy, showFavoritesOnly, favoritedBooks]);

  const availableBooksForTopics = useMemo(() => getBooksForFacet(books, { searchQuery, selectedTopics, selectedAuthors, selectedPublishers, selectedSeries, selectedBookTypes, showFavoritesOnly, favoritedBooks, excludeFacet: "topics" }), [books, searchQuery, selectedTopics, selectedAuthors, selectedPublishers, selectedSeries, selectedBookTypes, showFavoritesOnly, favoritedBooks]);
  const availableBooksForAuthors = useMemo(() => getBooksForFacet(books, { searchQuery, selectedTopics, selectedAuthors, selectedPublishers, selectedSeries, selectedBookTypes, showFavoritesOnly, favoritedBooks, excludeFacet: "authors" }), [books, searchQuery, selectedTopics, selectedAuthors, selectedPublishers, selectedSeries, selectedBookTypes, showFavoritesOnly, favoritedBooks]);
  const availableBooksForPublishers = useMemo(() => getBooksForFacet(books, { searchQuery, selectedTopics, selectedAuthors, selectedPublishers, selectedSeries, selectedBookTypes, showFavoritesOnly, favoritedBooks, excludeFacet: "publishers" }), [books, searchQuery, selectedTopics, selectedAuthors, selectedPublishers, selectedSeries, selectedBookTypes, showFavoritesOnly, favoritedBooks]);
  const availableBooksForSeries = useMemo(() => getBooksForFacet(books, { searchQuery, selectedTopics, selectedAuthors, selectedPublishers, selectedSeries, selectedBookTypes, showFavoritesOnly, favoritedBooks, excludeFacet: "series" }), [books, searchQuery, selectedTopics, selectedAuthors, selectedPublishers, selectedSeries, selectedBookTypes, showFavoritesOnly, favoritedBooks]);
  const availableBooksForBookTypes = useMemo(() => getBooksForFacet(books, { searchQuery, selectedTopics, selectedAuthors, selectedPublishers, selectedSeries, selectedBookTypes, showFavoritesOnly, favoritedBooks, excludeFacet: "bookTypes" }), [books, searchQuery, selectedTopics, selectedAuthors, selectedPublishers, selectedSeries, selectedBookTypes, showFavoritesOnly, favoritedBooks]);

  const availableTopicNames = useMemo(() => uniqueSorted(availableBooksForTopics.flatMap((b) => b.topics)), [availableBooksForTopics]);
  const availableAuthorNames = useMemo(() => uniqueSorted(availableBooksForAuthors.map((b) => b.author)), [availableBooksForAuthors]);
  const availablePublisherNames = useMemo(() => uniqueSorted(availableBooksForPublishers.map((b) => b.publisher).filter((p) => p !== "غير محدد")), [availableBooksForPublishers]);
  const availableSeriesNames = useMemo(() => uniqueSorted(availableBooksForSeries.map((b) => b.series)), [availableBooksForSeries]);
  const availableBookTypeNames = useMemo(() => uniqueSorted(availableBooksForBookTypes.map((b) => b.bookType)), [availableBooksForBookTypes]);

  const activeFiltersCount = selectedTopics.length + selectedAuthors.length + selectedPublishers.length + selectedSeries.length + selectedBookTypes.length;

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header Section */}
      <BooksFiltersToolbar
        isEditor={isEditor}
        isScrolled={isScrolled}
        bulkEditMode={bulkEditMode}
        onAddNew={handleAddNew}
        onToggleBulkMode={() => {
          setBulkEditMode(!bulkEditMode);
          setSelectedBookIds([]);
        }}
        onExport={handleExport}
        onImportClick={() => fileInputRef.current?.click()}
        onMobileSortToggle={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
        isSortDropdownOpen={isSortDropdownOpen}
        onCloseMobileSort={() => setIsSortDropdownOpen(false)}
        onSetSortBy={(v) => {
          setSortBy(v);
          setIsSortDropdownOpen(false);
        }}
        sortBy={sortBy}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedTopics={selectedTopics}
        setSelectedTopics={setSelectedTopics}
        selectedAuthors={selectedAuthors}
        setSelectedAuthors={setSelectedAuthors}
        selectedPublishers={selectedPublishers}
        setSelectedPublishers={setSelectedPublishers}
        selectedSeries={selectedSeries}
        setSelectedSeries={setSelectedSeries}
        selectedBookTypes={selectedBookTypes}
        setSelectedBookTypes={setSelectedBookTypes}
        availableTopicNames={availableTopicNames}
        availableAuthorNames={availableAuthorNames}
        availablePublisherNames={availablePublisherNames}
        availableSeriesNames={availableSeriesNames}
        availableBookTypeNames={availableBookTypeNames}
        allBooksCount={books.length}
        filteredCount={filteredAndSortedBooks.length}
        userHasProfile={!!(user && profile)}
        showFavoritesOnly={showFavoritesOnly}
        onToggleFavoritesOnly={() => setShowFavoritesOnly((v) => !v)}
        favoritedBooks={favoritedBooks}
        favoritedCount={favoritedBooks.length}
        sortDropdownRef={sortDropdownRef}
        filtersContainerRef={filtersContainerRef}
      />

      {/* Hidden file input (used by toolbar import button) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImport}
        className="hidden"
      />

      {/* Bulk Actions Bar */}
      <BulkActionsBar
        isEditor={isEditor}
        bulkEditMode={bulkEditMode}
        selectedCount={selectedBookIds.length}
        filteredCount={filteredAndSortedBooks.length}
        onSelectAll={handleSelectAll}
        onOpenBulkEdit={() => setIsBulkEditModalOpen(true)}
        onBulkDelete={handleBulkDelete}
      />

      {/* Books Grid - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6" ref={scrollContainerRef}>
        {filteredAndSortedBooks.length === 0 ? (
          <BooksEmptyState searchQuery={searchQuery} activeFiltersCount={activeFiltersCount} />
        ) : (
          <BookCardGrid
            isEditor={isEditor}
            bulkEditMode={bulkEditMode}
            books={filteredAndSortedBooks}
            favoritedBooks={favoritedBooks}
            selectedBookIds={selectedBookIds}
            onViewBook={handleViewBook}
            onEditBook={handleEditBook}
            onDeleteBook={handleDeleteBook}
            onDownloadBook={downloadBook}
            onToggleFavorite={toggleFavorite}
          />
        )}
      </div>


      {/* Modals */}
      {showDetailsModal && selectedBook && (
        <BookDetailsModal
          book={selectedBook}
          onClose={() => setShowDetailsModal(false)}
          onToggleFavorite={toggleFavorite}
          onEdit={isEditor ? handleEditBook : undefined}
          onDelete={isEditor ? handleDeleteBook : undefined}
          onDownload={downloadBook}
        />
      )}

      {showEditModal && (
        <BookEditModal
          book={editingBook}
          topics={topics}
          onSave={handleSaveBook}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {isBulkEditModalOpen && (
        <AdminBulkEditBooksModal
          isOpen={isBulkEditModalOpen}
          onClose={() => setIsBulkEditModalOpen(false)}
          onSave={handleBulkEditSave}
          selectedCount={selectedBookIds.length}
          availableAuthors={allAuthors}
          availableBookTypes={allBookTypes}
          availablePublishers={allPublishers}
          availableSeries={allSeries}
        />
      )}
    </div>
  );
}