import { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  Plus,
  BookOpen,
  X,
  Heart,
  Download,
  Eye,
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

// Default book cover image for books without a cover
const FALLBACK_BOOK_COVER =
  "https://images.unsplash.com/photo-1569690484582-58b478f46805?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxib29rJTIwY292ZXIlMjBwbGFjZWhvbGRlcnxlbnwxfHx8fDE3Njg1NzEyMTd8MA&ixlib=rb-4.1.0&q=80&w=1080";

// Function to get the current default book cover (admin can customize this)
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
  pdfFile: string; // base64 or mock URL
  coverImage?: string; // base64 or mock URL - now optional
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

export function BooksSection({ isSidebarCollapsed }: BooksSectionProps) {
  const { user, profile } = useAuth();
  const isEditor = useIsEditor();

  const [books, setBooks] = useState<Book[]>([]);
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
  const [scrollProgress, setScrollProgress] = useState(0);
  const [bulkEditMode, setBulkEditMode] = useState(false);
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [favoritedBooks, setFavoritedBooks] = useState<string[]>([]);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);

  const sortDropdownRef = useRef<HTMLDivElement>(null);
  const filtersContainerRef = useRef<HTMLDivElement>(null!);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add state to trigger re-render when default cover changes
  const [defaultCoverKey, setDefaultCoverKey] = useState(0);

  useEffect(() => {
    loadBooks();
    loadTopics();
    loadFavoritedBooks();

    // Listen for default book cover changes
    const handleDefaultCoverChange = () => {
      setDefaultCoverKey((prev) => prev + 1);
    };

    window.addEventListener(
      "defaultBookCoverChanged",
      handleDefaultCoverChange,
    );

    return () => {
      window.removeEventListener(
        "defaultBookCoverChanged",
        handleDefaultCoverChange,
      );
    };
  }, []);

  // Detect scroll to hide title/description
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
  
//  شيلنا isLoading وسيبنا الـ Ref ومصفوفة الداتا بس
}, [scrollContainerRef.current, books]);

  const loadBooks = () => {
    const saved = localStorage.getItem("books_library");
    const parsedBooks = saved ? JSON.parse(saved) : null;

    // Force reload if we have less than 13 books (to get the new mock data)
    if (!parsedBooks || parsedBooks.length < 13) {
      // Initialize with mock data
      const mockBooks: Book[] = [
        {
          id: "1",
          title: "حياة الصلاة الأرثوذكسية",
          author: "متى المسكين",
          bookType: "روحي",
          publisher: "دير القديس أنبا مقار",
          series: "سلسلة الحياة الروحية",
          topics: ["الصلاة"],
          year: "1995",
          description:
            "كتاب شامل عن الصلاة في الكنيسة الأرثوذكسية وأهميتها في الحياة الروحية",
          dateAdded: new Date(2024, 0, 15).toISOString(),
          pdfFile: "mock-pdf-1",
          coverImage:
            "https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=400",
          isFavorite: false,
        },
        {
          id: "2",
          title: "تاريخ الكنيسة القبطية",
          author: "إيريس حبيب المصري",
          bookType: "تاريخي",
          publisher: "مكتبة المحبة",
          series: "قصة الكنيسة القبطية",
          topics: ["التاريخ الكنسي"],
          year: "1988",
          description:
            "موسوعة تاريخية شاملة عن الكنيسة القبطية منذ نشأتها حتى العصر الحديث",
          dateAdded: new Date(2024, 1, 10).toISOString(),
          pdfFile: "mock-pdf-2",
          coverImage:
            "https://images.unsplash.com/photo-1536778215133-7e02ee89cb90?w=800",
          isFavorite: false,
        },
        {
          id: "3",
          title: "الليتورجيا القبطية",
          author: "القمص متى المسكين",
          bookType: "طقسي",
          publisher: "دير القديس أنبا مقار",
          series: "سلسلة الليتورجيا",
          topics: ["الليتورجيا", "الطقوس"],
          year: "2000",
          description:
            "شرح مفصل للقداس الإلهي والطقوس الكنسية في الكنيسة القبطية",
          dateAdded: new Date(2024, 2, 5).toISOString(),
          pdfFile: "mock-pdf-3",
          // No coverImage - will use default
          isFavorite: false,
        },
        {
          id: "4",
          title: "الإنجيل بحسب القديس يوحنا",
          author: "الأنبا شنودة الثالث",
          bookType: "تفسير",
          publisher: "مطبوعات دير الأنبا رويس",
          series: "تفاسير الكتاب المقدس",
          topics: ["الكتاب المقدس", "التفسير"],
          year: "2005",
          description: "تفسير روحي وعملي لإنجيل يوحنا من منظور آبائي معاصر",
          dateAdded: new Date(2024, 3, 20).toISOString(),
          pdfFile: "mock-pdf-4",
          coverImage:
            "https://images.unsplash.com/photo-1495446815901-a7297e633e8d?w=400",
          isFavorite: false,
        },
        {
          id: "5",
          title: "القديس أثناسيوس الرسولي",
          author: "الأب متى المسكين",
          bookType: "سِيَر",
          publisher: "دير القديس أنبا مقار",
          series: "سلسلة آباء الكنيسة",
          topics: ["سِيَر القديسين", "التاريخ الكنسي"],
          year: "1998",
          description: "سيرة حياة القديس أثناسيوس الرسولي وجهاده ضد الأريوسية",
          dateAdded: new Date(2024, 4, 12).toISOString(),
          pdfFile: "mock-pdf-5",
          coverImage:
            "https://images.unsplash.com/photo-1650437732428-9854461455d4?w=600",
          isFavorite: false,
        },
        {
          id: "6",
          title: "الرهبنة القبطية في عصر القديس أنبا مقار",
          author: "الأنبا إبيفانيوس",
          bookType: "تاريخي",
          publisher: "دير القديس أنبا مقار",
          series: "تاريخ الرهبنة",
          topics: ["الرهبنة", "التاريخ الكنسي"],
          year: "2015",
          description:
            "دراسة شاملة عن الرهبنة القبطية في برية شيهيت وتعاليم آباء البرية",
          dateAdded: new Date(2024, 5, 8).toISOString(),
          pdfFile: "mock-pdf-6",
          // No coverImage - will use default
          isFavorite: false,
        },
        {
          id: "7",
          title: "سر الإفخارستيا",
          author: "الأب متى المسكين",
          bookType: "طقسي",
          publisher: "دير القديس أنبا مقار",
          series: "سلسلة الأسرار المقدسة",
          topics: ["الأسرار الكنسية", "الليتورجيا"],
          year: "2002",
          description:
            "دراسة لاهوتية وطقسية عن سر الإفخارستيا (التناول المقدس)",
          dateAdded: new Date(2024, 6, 25).toISOString(),
          pdfFile: "mock-pdf-7",
          coverImage:
            "https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=400",
          isFavorite: false,
        },
        {
          id: "8",
          title: "التسبحة اليومية والفصلية",
          author: "القمص بولس البراموسي",
          bookType: "طقسي",
          publisher: "الكلية الإكليريكية",
          series: "الكتب الطقسية",
          topics: ["التسبحة", "الطقوس"],
          year: "2010",
          description: "شرح تفصيلي للتسبحة اليومية والفصلية مع الألحان والطقوس",
          dateAdded: new Date(2024, 7, 14).toISOString(),
          pdfFile: "mock-pdf-8",
          coverImage:
            "https://images.unsplash.com/photo-1476357471311-43c0db9fb2b4?w=400",
          isFavorite: false,
        },
        {
          id: "9",
          title: "حياة القديسة مريم المصرية",
          author: "القمص تادرس يعقوب",
          bookType: "سِيَر",
          publisher: "مكتبة المحبة",
          series: "سلسلة قديسي الكنيسة",
          topics: ["سِيَر القديسين", "التوبة"],
          year: "1992",
          description: "قصة حياة القديسة مريم المصرية ورحلة توبتها العجيبة",
          dateAdded: new Date(2024, 8, 30).toISOString(),
          pdfFile: "mock-pdf-9",
          coverImage:
            "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=400",
          isFavorite: false,
        },
        {
          id: "10",
          title: "اللاهوت المقارن",
          author: "الأنبا بيشوي",
          bookType: "لاهوتي",
          publisher: "دار الطباعة القبطية",
          series: "الدراسات اللاهوتية",
          topics: ["اللاهوت", "العقيدة"],
          year: "2008",
          description: "دراسة مقارنة للعقائد المسيحية في الكنائس المختلفة",
          dateAdded: new Date(2024, 9, 18).toISOString(),
          pdfFile: "mock-pdf-10",
          coverImage:
            "https://images.unsplash.com/photo-1700406629128-1166dc748748?w=700",
          isFavorite: false,
        },
        {
          id: "11",
          title: "الألحان القبطية وتاريخها",
          author: "الدكتور راغب مفتاح",
          bookType: "ألحان",
          publisher: "معهد الدراسات القبطية",
          series: "الموسيقى القبطية",
          topics: ["الألحان", "التراث القبطي"],
          year: "2012",
          description: "دراسة موسيقية وتاريخية شاملة للألحان الكنسية القبطية",
          dateAdded: new Date(2024, 10, 5).toISOString(),
          pdfFile: "mock-pdf-11",
          coverImage:
            "https://images.unsplash.com/photo-1515378960530-7c0da6231fb1?w=400",
          isFavorite: false,
        },
        {
          id: "12",
          title: "معجم المصطلحات الكنسية",
          author: "الأنبا يوأنس",
          bookType: "مرجعي",
          publisher: "دار نوبار للطباعة",
          series: "الكتب المرجعية",
          topics: ["اللغة القبطية", "المصطلحات"],
          year: "2018",
          description: "معجم شامل للمصطلحات الكنسية واللاهوتية والطقسية",
          dateAdded: new Date(2024, 11, 22).toISOString(),
          pdfFile: "mock-pdf-12",
          coverImage:
            "https://images.unsplash.com/photo-1768081377851-9e8bfb4e0f45?w=500",
          isFavorite: false,
        },
        {
          id: "13",
          title: "تاريخ البطاركة الإسكندريين",
          author: "ساويرس بن المقفع",
          bookType: "تاريخي",
          publisher: "المركز الفرنسي للآثار",
          series: "التراث القبطي",
          topics: ["التاريخ الكنسي", "البطاركة"],
          year: "1990",
          description: "سجل تاريخي للبطاركة الإسكندريين منذ القديس مرقس الرسول",
          dateAdded: new Date(2024, 11, 15).toISOString(),
          pdfFile: "mock-pdf-13",
          coverImage:
            "https://images.unsplash.com/photo-1524578271613-d550eacf6090?w=400",
          isFavorite: false,
        },
      ];

      // Normalize publishers: set to "غير محدد" if empty
      const normalizedBooks = mockBooks.map((book) => ({
        ...book,
        publisher:
          book.publisher && book.publisher.trim() !== ""
            ? book.publisher
            : "غير محدد",
      }));

      setBooks(normalizedBooks);
      localStorage.setItem("books_library", JSON.stringify(normalizedBooks));
    } else {
      // Normalize publishers in loaded books as well
      const normalizedBooks = parsedBooks.map((book: Book) => ({
        ...book,
        publisher:
          book.publisher && book.publisher.trim() !== ""
            ? book.publisher
            : "غير محدد",
      }));
      setBooks(normalizedBooks);
    }
  };

  const loadTopics = () => {
    const saved = localStorage.getItem("topics_master_list");
    if (saved) {
      setTopics(JSON.parse(saved));
    }
  };

  const loadFavoritedBooks = () => {
    const favorites = JSON.parse(
      localStorage.getItem("user_favorites") ||
        '{"hymns":[],"images":[],"sayings":[],"books":[]}',
    );
    setFavoritedBooks(favorites.books || []);
  };

  const saveBooks = (updatedBooks: Book[]) => {
    setBooks(updatedBooks);
    localStorage.setItem("books_library", JSON.stringify(updatedBooks));
  };

  const toggleFavorite = (bookId: string) => {
    const updatedBooks = books.map((book) =>
      book.id === bookId ? { ...book, isFavorite: !book.isFavorite } : book,
    );
    saveBooks(updatedBooks);

    // Update favorites list
    const favorites = JSON.parse(
      localStorage.getItem("user_favorites") ||
        '{"hymns":[],"images":[],"sayings":[],"books":[]}',
    );
    const book = updatedBooks.find((b) => b.id === bookId);
    if (book?.isFavorite) {
      if (!favorites.books) favorites.books = [];
      favorites.books.push(bookId);
    } else {
      if (favorites.books) {
        favorites.books = favorites.books.filter((id: string) => id !== bookId);
      }
    }
    localStorage.setItem("user_favorites", JSON.stringify(favorites));
    loadFavoritedBooks();
  };

  const handleAddNew = () => {
    setEditingBook(null);
    setShowEditModal(true);
  };

  const handleEditBook = (book: Book) => {
    setEditingBook(book);
    setShowEditModal(true);
  };

  const handleDeleteBook = (bookId: string) => {
    if (confirm("هل أنت متأكد من حذف هذا الكتاب؟")) {
      const updatedBooks = books.filter((book) => book.id !== bookId);
      saveBooks(updatedBooks);
    }
  };

  const handleBulkDelete = () => {
    if (confirm(`هل أنت متأكد من حذف ${selectedBookIds.length} كتاب؟`)) {
      const updatedBooks = books.filter(
        (book) => !selectedBookIds.includes(book.id),
      );
      saveBooks(updatedBooks);
      setSelectedBookIds([]);
    }
  };

  const handleBulkEditSave = (updates: BulkBookUpdates) => {
    const updatedBooks = books.map((book) => {
      if (!selectedBookIds.includes(book.id)) return book;

      let updatedBook = { ...book };

      if (updates.applyAuthor && updates.author) {
        updatedBook.author = updates.author;
      }

      if (updates.applyBookType && updates.bookType) {
        updatedBook.bookType = updates.bookType;
      }

      if (updates.applyPublisher && updates.publisher) {
        updatedBook.publisher = updates.publisher;
      }

      if (updates.applySeries && updates.series) {
        updatedBook.series = updates.series;
      }

      if (updates.applyTopics) {
        switch (updates.topicOperation) {
          case "add":
            updatedBook.topics = [
              ...new Set([...updatedBook.topics, ...updates.topics]),
            ];
            break;
          case "replace":
            updatedBook.topics = updates.topics;
            break;
          case "remove":
            updatedBook.topics = updatedBook.topics.filter(
              (t) => !updates.topics.includes(t),
            );
            break;
        }
      }

      return updatedBook;
    });

    saveBooks(updatedBooks);
    setIsBulkEditModalOpen(false);
    setSelectedBookIds([]);
    setBulkEditMode(false);
    alert("تم تحديث الكتب بنجاح");
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

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedBooks = JSON.parse(event.target?.result as string);
          if (Array.isArray(importedBooks)) {
            saveBooks(importedBooks);
            alert("تم استيراد البيانات بنجاح!");
          } else {
            alert("تنسيق الملف غير صحيح");
          }
        } catch (error) {
          alert("خطأ في قراءة الملف");
        }
      };
      reader.readAsText(file);
    }
  };

  const handleSaveBook = (book: Book) => {
    if (editingBook) {
      // Edit existing
      const updatedBooks = books.map((b) => (b.id === book.id ? book : b));
      saveBooks(updatedBooks);
    } else {
      // Add new
      const newBook = {
        ...book,
        id: Date.now().toString(),
        dateAdded: new Date().toISOString(),
        isFavorite: false,
      };
      saveBooks([...books, newBook]);
    }
    setShowEditModal(false);
  };

  const handleViewBook = (book: Book) => {
    setSelectedBook(book);
    setShowDetailsModal(true);
  };

  const downloadBook = (book: Book) => {
    // Create a temporary link to trigger download
    const link = document.createElement("a");
    link.href = book.pdfFile;
    link.download = `${book.title}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleAuthor = (author: string) => {
    setSelectedAuthors((prev) =>
      prev.includes(author)
        ? prev.filter((a) => a !== author)
        : [...prev, author],
    );
  };

  const togglePublisher = (publisher: string) => {
    setSelectedPublishers((prev) =>
      prev.includes(publisher)
        ? prev.filter((p) => p !== publisher)
        : [...prev, publisher],
    );
  };

  const toggleSeries = (series: string) => {
    setSelectedSeries((prev) =>
      prev.includes(series)
        ? prev.filter((s) => s !== series)
        : [...prev, series],
    );
  };

  // Get unique values for filters
  const allAuthors = useMemo(() => {
    const authors = new Set(books.map((book) => book.author).filter(Boolean));
    return Array.from(authors).sort();
  }, [books]);

  const allPublishers = useMemo(() => {
    const publishers = new Set(
      books
        .map((book) => book.publisher)
        .filter((publisher) => publisher && publisher !== "غير محدد"),
    );
    return Array.from(publishers).sort();
  }, [books]);

  const allSeries = useMemo(() => {
    const series = new Set(books.map((book) => book.series).filter(Boolean));
    return Array.from(series).sort();
  }, [books]);

  const allBookTypes = useMemo(() => {
    const bookTypes = new Set(
      books.map((book) => book.bookType).filter(Boolean),
    );
    return Array.from(bookTypes).sort();
  }, [books]);

  // Filter and sort books
  const filteredAndSortedBooks = useMemo(() => {
    let filtered = books.filter((book) => {
      // Search query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !book.title.toLowerCase().includes(query) &&
          !book.author.toLowerCase().includes(query) &&
          !book.publisher.toLowerCase().includes(query) &&
          !book.description.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      // Topics filter
      if (selectedTopics.length > 0) {
        if (!book.topics.some((topic) => selectedTopics.includes(topic))) {
          return false;
        }
      }

      // Authors filter
      if (selectedAuthors.length > 0) {
        if (!selectedAuthors.includes(book.author)) {
          return false;
        }
      }

      // Publishers filter
      if (selectedPublishers.length > 0) {
        if (!selectedPublishers.includes(book.publisher)) {
          return false;
        }
      }

      // Series filter
      if (selectedSeries.length > 0) {
        if (!selectedSeries.includes(book.series)) {
          return false;
        }
      }

      // Book Types filter
      if (selectedBookTypes.length > 0) {
        if (!selectedBookTypes.includes(book.bookType)) {
          return false;
        }
      }

      // Favorites filter
      const matchesFavorites =
        !showFavoritesOnly || favoritedBooks.includes(book.id);

      return matchesFavorites;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "date-newest":
          return (
            new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime()
          );
        case "date-oldest":
          return (
            new Date(a.dateAdded).getTime() - new Date(b.dateAdded).getTime()
          );
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
  }, [
    books,
    searchQuery,
    selectedTopics,
    selectedAuthors,
    selectedPublishers,
    selectedSeries,
    selectedBookTypes,
    sortBy,
    showFavoritesOnly,
    favoritedBooks,
  ]);

  const activeFiltersCount =
    selectedTopics.length +
    selectedAuthors.length +
    selectedPublishers.length +
    selectedSeries.length +
    selectedBookTypes.length;

  return (
    <div className="flex flex-col h-full">
    {/* Sticky Header Section */}
    <div className="sticky top-0 bg-background z-40 pb-3 sm:pb-4 border-b border-border/50">
      
      {/*  العنوان والوصف - التعديل الحركي الموحد المستقر */}
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
            مجموعة شاملة من الكتب الروحية والطقسية والتاريخية مع إمكانية البحث
            والفلترة والتحميل
          </p>
        </div>

      {/* هنا بيكون شريط البحث والفلاتر بتاعتك عشان يفضل sticky مكانه فوق */}

    </div>
        {/* Admin Toolbar */}
        {isEditor && (
          <div className="mt-4 mb-4 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Label */}
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">
                  أدوات التحرير:
                </span>
              </div>

              {/* Buttons */}
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
            <span className="text-sm font-medium">
              {selectedBookIds.length} عنصر محدد
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-2 px-4 py-2 bg-card border border-border rounded-lg hover:bg-muted transition-colors text-sm"
              >
                <CheckCheck className="w-4 h-4" />
                {selectedBookIds.length === filteredAndSortedBooks.length
                  ? "إلغاء الكل"
                  : "تحديد الكل"}
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

        {/* Search and Filters Container */}
        <div className="space-y-4 sm:space-y-8">
          {/* Search Bar with Sort Button (Mobile) */}
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

            {/* Sort Button - Icon only on mobile, beside search bar */}
            <div
              className="relative flex-shrink-0 sm:hidden"
              ref={sortDropdownRef}
            >
              <button
                onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                className="flex items-center justify-center w-[50px] h-[50px] bg-card border border-border rounded-xl hover:bg-muted transition-colors"
              >
                <ArrowUpDown className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Mobile Sort Panel - Slide up from bottom */}
          {isSortDropdownOpen && (
            <>
              {/* Backdrop */}
              <div
                className="sm:hidden fixed inset-0 bg-black/50 z-[200] animate-in fade-in duration-200"
                onClick={() => setIsSortDropdownOpen(false)}
              />

              {/* Slide-up Panel */}
              <div className="sm:hidden fixed bottom-0 left-0 right-0 z-[201] bg-card rounded-t-xl shadow-2xl animate-in slide-in-from-bottom duration-300 pb-safe">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                  <h3 className="font-semibold text-lg">ترتيب حسب</h3>
                  <button
                    onClick={() => setIsSortDropdownOpen(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Sort Options */}
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

          {/* Filters and Sort Row */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 -mt-2 sm:-mt-3.5">
            {/* Filters on the right */}
            <div
              className="relative flex items-center gap-3 w-full sm:w-auto flex-wrap"
              ref={filtersContainerRef}
            >
              {/* Topics Filter */}
              <div className="flex-1 sm:flex-initial min-w-[120px]">
                <TagFilter
                  selectedTags={selectedTopics}
                  onTagsChange={setSelectedTopics}
                  onSearchChange={setSearchQuery}
                  searchQuery={searchQuery}
                  showSearch={false}
                  icon={Tags}
                  containerRef={filtersContainerRef}
                />
              </div>

              {/* Author Filter */}
              <div className="flex-1 sm:flex-initial">
                <MultiSelectFilter
                  label="المؤلف"
                  options={allAuthors}
                  selectedOptions={selectedAuthors}
                  onOptionsChange={setSelectedAuthors}
                  icon={User}
                />
              </div>

              {/* Publisher Filter */}
              <div className="flex-1 sm:flex-initial">
                <MultiSelectFilter
                  label="الناشر"
                  options={allPublishers}
                  selectedOptions={selectedPublishers}
                  onOptionsChange={setSelectedPublishers}
                  icon={Building2}
                />
              </div>

              {/* Series Filter */}
              <div className="flex-1 sm:flex-initial">
                <MultiSelectFilter
                  label="السلسلة"
                  options={allSeries}
                  selectedOptions={selectedSeries}
                  onOptionsChange={setSelectedSeries}
                  icon={Library}
                />
              </div>

              {/* Book Types Filter */}
              <div className="flex-1 sm:flex-initial">
                <MultiSelectFilter
                  label="نوع الكتاب"
                  options={allBookTypes}
                  selectedOptions={selectedBookTypes}
                  onOptionsChange={setSelectedBookTypes}
                  icon={Library}
                />
              </div>

              {/* Favorites Only Toggle - Only visible when user is logged in */}
              {user && profile && (
                <button
                  onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] border rounded-xl transition-all relative whitespace-nowrap ${
                    showFavoritesOnly
                      ? "bg-primary/10 border-primary text-primary"
                      : "bg-card border-border hover:bg-muted"
                  }`}
                  title={
                    showFavoritesOnly ? "إظهار كل الكتب" : "عرض المفضلة فقط"
                  }
                >
                  <Heart
                    className={`w-4 h-4 flex-shrink-0 transition-all ${showFavoritesOnly ? "fill-current" : ""}`}
                  />
                  <span className="text-sm hidden lg:inline">المفضلة فقط</span>
                  {showFavoritesOnly && favoritedBooks.length > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-2 py-0.5">
                      {favoritedBooks.length}
                    </span>
                  )}
                </button>
              )}

              {/* Results Count Info Chip */}
              <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] bg-muted/50 border border-border/50 rounded-xl pointer-events-none">
                <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">
                  {filteredAndSortedBooks.length} / {books.length}
                </span>
              </div>
            </div>

            {/* Sort on Desktop (on the left) */}
            <div className="hidden sm:flex items-center gap-3">
              <div className="relative" ref={sortDropdownRef}>
                <button
                  onClick={() => setIsSortDropdownOpen(!isSortDropdownOpen)}
                  className="flex items-center gap-2 px-4 py-2.5 h-[42px] bg-card border border-border rounded-xl hover:bg-muted transition-colors"
                >
                  <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {sortOptions.find((o) => o.value === sortBy)?.label}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${isSortDropdownOpen ? "rotate-180" : ""}`}
                  />
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
                          setSelectedBookIds(
                            selectedBookIds.filter((id) => id !== book.id),
                          );
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
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
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

                  {/* Overlay - Shows on hover OR when favorited (for heart button visibility) */}
                  {!bulkEditMode && (
                    <>
                      {/* Gradient overlay - only on hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                        {/* Bottom buttons - Download for regular users, Edit/Delete/Download for editors */}
                        <div className="flex items-center gap-2">
                          {isEditor ? (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditBook(book);
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-black rounded-lg transition-colors text-xs shadow-lg"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                                <span>تعديل</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteBook(book.id);
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500/90 hover:bg-red-500 text-white rounded-lg transition-colors text-xs shadow-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف</span>
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  downloadBook(book);
                                }}
                                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-black rounded-lg transition-colors text-xs shadow-lg"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>تحمي</span>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadBook(book);
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white/90 hover:bg-white text-black rounded-lg transition-colors text-xs shadow-lg"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>تحميل</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Heart button - Always visible when favorited, only on hover when not favorited */}
                      <div
                        className={`absolute top-3 left-3 z-10 transition-opacity duration-300 ${
                          favoritedBooks.includes(book.id)
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100"
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
                          <Heart
                            className={`w-4 h-4 ${favoritedBooks.includes(book.id) ? "fill-current" : ""}`}
                          />
                        </button>
                      </div>
                    </>
                  )}

                  {/* Selection overlay - Show when book is selected */}
                  {bulkEditMode && selectedBookIds.includes(book.id) && (
                    <div className="absolute inset-0 bg-primary/10 pointer-events-none" />
                  )}
                </div>

                {/* Book Info */}
                <div className="p-4 flex-1 group-hover:bg-muted transition-colors">
                  <h3 className="font-bold text-base mb-1 line-clamp-2">
                    {book.title}
                  </h3>
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
