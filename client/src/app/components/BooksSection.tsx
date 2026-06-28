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
import { Button } from "./ui/button";
import { BookDetailsModal } from "./BookDetailsModal";
import { BookEditModal } from "./BookEditModal";
import {
  AdminBulkEditBooksModal,
  BulkBookUpdates,
} from "./AdminBulkEditBooksModal";
import { TagFilter } from "./TagFilter";
import { MultiSelectFilter } from "./MultiSelectFilter";
import { useIsEditor } from "../utils/adminUtils";
import { useAuth } from "../contexts/AuthContext";
import { useBooks } from "../hooks/useBooks";
import { normalizeArabic } from "../utils/arabicUtils";
import { downloadFile } from "../utils/download";

// استدعاء دوال الـ API Client الجديد لإدارة الاتصال بالسيرفر
import {
  apiGetJson,
  apiPostJson,
  apiPutJson,
  apiDeleteJson,
} from "../services/apiClient";

const FALLBACK_BOOK_COVER =
  "https://images.unsplash.com/photo-1569690484582-58b478f46805?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib29rJTIwY292ZXIlMjBwbGFjZWhvbGRlcnxlbnwxfHx8fDE3Njg1NzEyMTd8MA&ixlib=rb-4.1.0&q=80&w=1080";

export const getDefaultBookCover = () => {
  const customCover = localStorage.getItem("default_book_cover");
  return customCover || FALLBACK_BOOK_COVER;
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
  const [favoritedBooks, setFavoritedBooks] = useState<string[]>([]);
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
    loadTopics();
    loadFavoritedBooks();

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

  // جلب التصنيفات من السيرفر
  const loadTopics = async () => {
    try {
      const data = await apiGetJson<any[]>("/tags");
      setTopics(data);
    } catch (error) {
      console.error("فشل جلب التصنيفات من السيرفر:", error);
    }
  };

  // جلب الكتب المفضلة
  const loadFavoritedBooks = async () => {
    try {
      const data = await apiGetJson<{ books: string[] }>("/auth/favorites");
      setFavoritedBooks(data.books || []);
    } catch (error) {
      console.error("فشل جلب الكتب المفضلة:", error);
    }
  };

  // تحديث حالة المفضلة
  const toggleFavorite = async (bookId: string) => {
    try {
      const data = await apiPostJson<{ books: string[] }>(`/books/${bookId}/favorite`, {});
      setFavoritedBooks(data.books || []);
    } catch (error) {
      console.error("فشل تحديث حالة المفضلة:", error);
    }
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
      <div className="sticky top-0 bg-background z-40 pb-3 sm:pb-4 border-b border-border/50">
        
        {/* العناوين والوصف */}
        <div
          className={`transition-all duration-500 ease-in-out overflow-hidden ${
            isScrolled
              ? "max-h-0 opacity-0 mb-0 pointer-events-none transform -translate-y-2"
              : "max-h-[250px] opacity-100 mb-4 transform translate-y-0"
          }`}
        >
          <div>
            <h1 className="mb-2 font-bold text-[36px]">مكتبة الكتب</h1>
            <p className="text-muted-foreground leading-relaxed">
              مجموعة شاملة من الكتب الروحية والطقسية والتاريخية مع إمكانية البحث والفلترة والتحميل
            </p>
          </div>
        </div>

        {/* Admin Toolbar */}
        {isEditor && (
          <div className="mt-4 mb-4 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">أدوات التحرير:</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleAddNew}
                  className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
                  title="إضافة كتاب جديد"
                >
                  <Plus className="w-4 h-4" />
                  <span>جديد</span>
                </button>
                <button
                  onClick={() => {
                    setBulkEditMode(!bulkEditMode);
                    setSelectedBookIds([]);
                  }}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                    bulkEditMode
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border border-border hover:bg-muted"
                  }`}
                  title="تحديد متعدد"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>{bulkEditMode ? "إلغاء" : "تحديد"}</span>
                </button>
                <button
                  onClick={handleExport}
                  className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg hover:bg-muted transition-colors text-sm"
                  title="تصدير JSON"
                >
                  <Download className="w-4 h-4" />
                  <span>تصدير</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg hover:bg-muted transition-colors text-sm"
                  title="استيراد JSON"
                >
                  <Upload className="w-4 h-4" />
                  <span>استيراد</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImport}
                  className="hidden"
                />
              </div>
            </div>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {isEditor && bulkEditMode && selectedBookIds.length > 0 && (
          <div className="mt-4 p-3 bg-primary/10 border border-primary rounded-xl flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-medium">{selectedBookIds.length} عنصر محدد</span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors text-sm"
              >
                <CheckCheck className="w-4 h-4" />
                {selectedBookIds.length === filteredAndSortedBooks.length ? "إلغاء الكل" : "تحديد الكل"}
              </button>
              <button
                onClick={() => setIsBulkEditModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                <Edit2 className="w-4 h-4" />
                تعديل المحدد
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
              >
                <Trash2 className="w-4 h-4" />
                حذف المحدد
              </button>
            </div>
          </div>
        )}

        {/* Search and Filters */}
        <div className="space-y-4 sm:space-y-8">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="ابحث في الكتب..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-11 pl-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
              />
            </div>

            <div className="relative flex-shrink-0 sm:hidden" ref={sortDropdownRef}>
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="flex items-center justify-center w-[50px] h-[50px] bg-card border border-border rounded-xl hover:bg-muted transition-colors"
              >
                <ArrowUpDown className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Mobile Sort Panel */}
          {isSortDropdownOpen && (
            <>
              <div
                className="sm:hidden fixed inset-0 bg-black/50 z-[200] animate-in fade-in duration-200"
                onClick={() => setIsSortDropdownOpen(false)}
              />
              <div className="sm:hidden fixed bottom-0 left-0 right-0 z-[201] bg-card rounded-t-xl shadow-2xl animate-in slide-in-from-bottom duration-300 pb-safe">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <h3 className="font-semibold text-lg">ترتيب حسب</h3>
                  <button
                    onClick={() => setIsSortDropdownOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortBy(option.value);
                          setIsSortDropdownOpen(false);
                        }}
                        className={`w-full text-right px-4 py-3.5 rounded-xl transition-colors ${
                          sortBy === option.value
                            ? "bg-primary text-primary-foreground font-medium"
                            : "hover:bg-muted"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Filters Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 -mt-2 sm:-mt-3.5">
            <div className="relative flex items-center gap-3 w-full sm:w-auto flex-wrap" ref={filtersContainerRef}>
              
              <div className="flex-1 sm:flex-initial min-w-[120px]">
                <TagFilter
                  selectedTags={selectedTopics}
                  onTagsChange={setSelectedTopics}
                  onSearchChange={setSearchQuery}
                  searchQuery={searchQuery}
                  showSearch={false}
                  icon={Tags}
                  containerRef={filtersContainerRef}
                  availableTopics={availableTopicNames}
                />
              </div>

              <div className="flex-1 sm:flex-initial">
                <MultiSelectFilter
                  label="المؤلف"
                  options={allAuthors}
                  selectedOptions={selectedAuthors}
                  onOptionsChange={setSelectedAuthors}
                  icon={User}
                  availableOptions={availableAuthorNames}
                />
              </div>

              <div className="flex-1 sm:flex-initial">
                <MultiSelectFilter
                  label="الناشر"
                  options={allPublishers}
                  selectedOptions={selectedPublishers}
                  onOptionsChange={setSelectedPublishers}
                  icon={Building2}
                  availableOptions={availablePublisherNames}
                />
              </div>

              <div className="flex-1 sm:flex-initial">
                <MultiSelectFilter
                  label="السلسلة"
                  options={allSeries}
                  selectedOptions={selectedSeries}
                  onOptionsChange={setSelectedSeries}
                  icon={Library}
                  availableOptions={availableSeriesNames}
                />
              </div>

              <div className="flex-1 sm:flex-initial">
                <MultiSelectFilter
                  label="نوع الكتاب"
                  options={allBookTypes}
                  selectedOptions={selectedBookTypes}
                  onOptionsChange={setSelectedBookTypes}
                  icon={Library}
                  availableOptions={availableBookTypeNames}
                />
              </div>

              {user && profile && (
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] border rounded-xl transition-all relative whitespace-nowrap ${
                    showFavoritesOnly
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-card border-border hover:bg-muted"
                  }`}
                  title={showFavoritesOnly ? "إظهار كل الكتب" : "عرض المفضلة فقط"}
                >
                  <Heart className={`w-4 h-4 flex-shrink-0 transition-all ${showFavoritesOnly ? "fill-current" : ""}`} />
                  <span className="text-sm hidden lg:inline">المفضلة فقط</span>
                  {showFavoritesOnly && favoritedBooks.length > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-2 py-0.5">
                      {favoritedBooks.length}
                    </span>
                  )}
                </button>
              )}

              <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] bg-muted/50 border border-border/50 rounded-xl pointer-events-none">
                <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">
                  {filteredAndSortedBooks.length} / {books.length}
                </span>
              </div>
            </div>

            {/* Desktop Sort */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="relative" ref={sortDropdownRef}>
                <button
                  onClick={() => !bulkEditMode && setIsSortDropdownOpen(!isSortDropdownOpen)}
                  className="flex items-center gap-2 px-4 py-2.5 h-[42px] bg-card border border-border rounded-xl hover:bg-muted transition-colors"
                >
                  <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {sortOptions.find((o) => o.value === sortBy)?.label}
                  </span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${isSortDropdownOpen ? "rotate-180" : ""}`} />
                </button>

                {isSortDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-card border border-border rounded-xl shadow-xl z-50">
                    <div className="p-2">
                      {sortOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setSortBy(option.value);
                            setIsSortDropdownOpen(false);
                          }}
                          className={`w-full text-right px-3 py-2 rounded-lg transition-colors ${
                            sortBy === option.value
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-muted"
                          }`}
                        >
                          <span className="text-sm">{option.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Books Grid - Scrollable */}
      <div className="flex-1 overflow-y-auto p-6" ref={scrollContainerRef}>
        {filteredAndSortedBooks.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد كتب</h3>
            <p className="text-muted-foreground">
              {searchQuery || activeFiltersCount > 0
                ? "جرب تغيير معايير البحث أو الفلاتر"
                : "لم يتم إضافة أي كتب بعد"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-6">
            {filteredAndSortedBooks.map((book) => (
              <div
                key={book.id}
                onClick={() => !bulkEditMode && handleViewBook(book)}
                className={`bg-card border border-border rounded-lg overflow-hidden transition-all group relative flex flex-col ${
                  !bulkEditMode ? "cursor-pointer" : ""
                }`}
              >
                {/* Bulk Selection Checkbox */}
                {isEditor && bulkEditMode && (
                  <div className="absolute top-2 right-2 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (selectedBookIds.includes(book.id)) {
                          setSelectedBookIds(selectedBookIds.filter((id) => id !== book.id));
                        } else {
                          setSelectedBookIds([...selectedBookIds, book.id]);
                        }
                      }}
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                        selectedBookIds.includes(book.id)
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-white border-gray-300 hover:border-primary"
                      }`}
                    >
                      {selectedBookIds.includes(book.id) && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                )}

                {/* Cover Image */}
                <div className="relative aspect-[3/4] bg-muted overflow-hidden">
                  <img
                    src={book.coverImage || getDefaultBookCover()}
                    alt={book.title}
                    className="w-full h-full object-contain"
                  />

                  {/* Overlay */}
                  {!bulkEditMode && (
                    <>
                      {/* الـ Overlay المعدل بنظام الـ Grid المكون من صفين لمنع تداخل الأزرار */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        <div className="grid grid-cols-2 gap-1.5 w-full">
                          {isEditor ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditBook(book);
                                }}
                                className="flex items-center justify-center gap-1 px-2 py-1.5 bg-white/90 hover:bg-white text-black rounded-lg transition-colors text-xs shadow-lg"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>تعديل</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteBook(book.id);
                                }}
                                className="flex items-center justify-center gap-1 px-2 py-1.5 bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-colors text-xs shadow-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadBook(book);
                                }}
                                className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-black rounded-lg transition-colors text-xs font-medium shadow-lg"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>تحميل الكتاب</span>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadBook(book);
                              }}
                              className="col-span-2 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-black rounded-lg transition-colors text-xs shadow-lg"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>تحميل</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Heart button */}
                      <div
                        className={`absolute top-3 left-3 z-10 transition-opacity duration-300 ${
                          favoritedBooks.includes(book.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(book.id);
                          }}
                          className={`p-2 rounded-lg transition-all shadow-lg ${
                            favoritedBooks.includes(book.id)
                              ? "bg-red-500 text-white"
                              : "bg-white/90 hover:bg-white text-black"
                          }`}
                        >
                          <Heart className={`w-4 h-4 ${favoritedBooks.includes(book.id) ? "fill-current" : ""}`} />
                        </button>
                      </div>
                    </>
                  )}

                  {bulkEditMode && selectedBookIds.includes(book.id) && (
                    <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
                  )}
                </div>

                {/* Book Info */}
                <div className="p-4 flex-1 group-hover:bg-muted transition-colors">
                  <h3 className="font-bold text-base mb-1 line-clamp-2">{book.title}</h3>
                  <p className="text-sm text-muted-foreground">{book.author}</p>
                </div>
              </div>
            ))}
          </div>
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