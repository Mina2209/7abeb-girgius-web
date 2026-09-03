import {
  ArrowUpDown,
  ChevronDown,
  Search,
  Plus,
  Download,
  Upload,
  Edit2,
  CheckSquare,
  X,
  Tags,
  User,
  Building2,
  Library,
  Heart,
  BookOpen,
} from 'lucide-react';
import { useMemo } from 'react';
import { TagFilter } from '../TagFilter';
import { MultiSelectFilter } from '../MultiSelectFilter';
import type { Book } from '../BooksSection';

type SortOption =
  | 'date-newest'
  | 'date-oldest'
  | 'title-asc'
  | 'title-desc'
  | 'year-newest'
  | 'year-oldest';

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: 'date-newest', label: 'الأحدث أولاً' },
  { value: 'date-oldest', label: 'الأقدم أولاً' },
  { value: 'title-asc', label: 'العنوان (أ-ي)' },
  { value: 'title-desc', label: 'العنوان (ي-أ)' },
  { value: 'year-newest', label: 'سنة النشر (الأحدث)' },
  { value: 'year-oldest', label: 'سنة النشر (الأقدم)' },
];

interface BooksFiltersToolbarProps {
  isEditor: boolean;

  // admin toolbar & bulk toggle
  bulkEditMode: boolean;
  onAddNew: () => void;
  onToggleBulkMode: () => void;
  onExport: () => void;
  onImportClick: () => void;
  onMobileSortToggle: () => void;
  isSortDropdownOpen: boolean;
  onCloseMobileSort: () => void;
  onSetSortBy: (v: SortOption) => void;
  sortBy: SortOption;

  // filters
  searchQuery: string;
  onSearchChange: (v: string) => void;

  selectedTopics: string[];
  setSelectedTopics: (v: string[]) => void;
  selectedAuthors: string[];
  setSelectedAuthors: (v: string[]) => void;
  selectedPublishers: string[];
  setSelectedPublishers: (v: string[]) => void;
  selectedSeries: string[];
  setSelectedSeries: (v: string[]) => void;
  selectedBookTypes: string[];
  setSelectedBookTypes: (v: string[]) => void;

  availableTopicNames: string[];
  availableAuthorNames: string[];
  availablePublisherNames: string[];
  availableSeriesNames: string[];
  availableBookTypeNames: string[];

  allBooksCount: number;
  filteredCount: number;

  userHasProfile: boolean;
  showFavoritesOnly: boolean;
  onToggleFavoritesOnly: () => void;
  favoritedBooks: string[];
  favoritedCount: number;

  // refs / container
  sortDropdownRef: React.RefObject<HTMLDivElement | null>;
  filtersContainerRef: React.RefObject<HTMLDivElement>;

  bulkEditModeLockedSort?: boolean;
}

export function BooksFiltersToolbar({
  isEditor,
  bulkEditMode,
  onAddNew,
  onToggleBulkMode,
  onExport,
  onImportClick,
  onMobileSortToggle,
  isSortDropdownOpen,
  onCloseMobileSort,
  onSetSortBy,
  sortBy,
  searchQuery,
  onSearchChange,
  selectedTopics,
  setSelectedTopics,
  selectedAuthors,
  setSelectedAuthors,
  selectedPublishers,
  setSelectedPublishers,
  selectedSeries,
  setSelectedSeries,
  selectedBookTypes,
  setSelectedBookTypes,
  availableTopicNames,
  availableAuthorNames,
  availablePublisherNames,
  availableSeriesNames,
  availableBookTypeNames,
  allBooksCount,
  filteredCount,
  userHasProfile,
  showFavoritesOnly,
  onToggleFavoritesOnly,
  favoritedBooks,
  favoritedCount,
  sortDropdownRef,
  filtersContainerRef,
}: BooksFiltersToolbarProps) {
  const mobileSortLabel = useMemo(
    () => sortOptions.find((o) => o.value === sortBy)?.label,
    [sortBy],
  );

  return (
    <>
      <div>
        <h1 className="mb-2 font-bold text-2xl sm:text-3xl lg:text-[36px]">مكتبة الكتب</h1>
        <p className="text-muted-foreground leading-relaxed">
          مجموعة شاملة من الكتب الروحية والطقسية والتاريخية مع إمكانية البحث والفلترة والتحميل
        </p>
      </div>

      <div className="sticky top-[var(--app-header-height)] bg-background z-40 pb-3 sm:pb-4 border-b border-border/50">
      {isEditor && (
        <div className="mt-4 mb-4 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">أدوات التحرير:</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onAddNew}
                className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-opacity text-sm"
                title="إضافة كتاب جديد"
              >
                <Plus className="w-4 h-4" />
                <span>جديد</span>
              </button>
              <button
                onClick={onToggleBulkMode}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-opacity text-sm ${
                  bulkEditMode
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border hover:bg-muted'
                }`}
                title="تحديد متعدد"
              >
                <CheckSquare className="w-4 h-4" />
                <span>{bulkEditMode ? 'إلغاء' : 'تحديد'}</span>
              </button>
              <button
                onClick={onExport}
                className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg hover:bg-muted transition-opacity text-sm"
                title="تصدير JSON"
              >
                <Download className="w-4 h-4" />
                <span>تصدير</span>
              </button>
              <button
                onClick={onImportClick}
                className="flex items-center gap-2 px-3 py-1.5 bg-card border border-border rounded-lg hover:bg-muted transition-opacity text-sm"
                title="استيراد JSON"
              >
                <Upload className="w-4 h-4" />
                <span>استيراد</span>
              </button>
            </div>
          </div>
        </div>
        )}

      {/* Search and Filters */}
      <div className="space-y-4 sm:space-y-8">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <input
              id="books-search"
              name="search"
              type="text"
              placeholder="ابحث في الكتب..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pr-11 pl-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-opacity"
            />
          </div>

          <div className="relative flex-shrink-0 sm:hidden" ref={sortDropdownRef}>
            <button
              onClick={onMobileSortToggle}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] w-[50px] h-[50px] bg-card border border-border rounded-xl hover:bg-muted transition-opacity"
            >
              <ArrowUpDown className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {isSortDropdownOpen && (
          <>
            <div
              className="sm:hidden fixed inset-0 bg-black/50 z-[200] animate-in fade-in duration-200"
              onClick={onCloseMobileSort}
            />
            <div className="sm:hidden fixed bottom-0 left-0 right-0 z-[201] bg-card rounded-t-xl shadow-2xl animate-in slide-in-from-bottom duration-300 pb-safe">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h3 className="font-semibold text-lg">ترتيب حسب</h3>
                <button
                  onClick={onCloseMobileSort}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-opacity"
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
                        onSetSortBy(option.value);
                        onCloseMobileSort();
                      }}
                      className={`w-full text-right px-4 py-3.5 rounded-xl transition-opacity ${
                        sortBy === option.value
                          ? 'bg-primary text-primary-foreground font-medium'
                          : 'hover:bg-muted'
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

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 -mt-2 sm:-mt-3.5">
          <div
            className="relative flex items-center gap-3 w-full sm:w-auto flex-wrap"
            ref={filtersContainerRef as unknown as React.RefObject<HTMLDivElement>}
          >
            <div className="flex-1 sm:flex-initial min-w-[120px]">
              <TagFilter
                selectedTags={selectedTopics}
                onTagsChange={setSelectedTopics}
                onSearchChange={(v) => onSearchChange(v)}
                searchQuery={searchQuery}
                showSearch={false}
                icon={Tags}
                containerRef={filtersContainerRef as unknown as React.RefObject<HTMLDivElement | null>}
                availableTopics={availableTopicNames}
              />
            </div>

            <div className="flex-1 sm:flex-initial">
              <MultiSelectFilter
                label="المؤلف"
                options={[]} 
                selectedOptions={selectedAuthors}
                onOptionsChange={setSelectedAuthors}
                icon={User}
                availableOptions={availableAuthorNames}
              />
            </div>

            <div className="flex-1 sm:flex-initial">
              <MultiSelectFilter
                label="الناشر"
                options={[]}
                selectedOptions={selectedPublishers}
                onOptionsChange={setSelectedPublishers}
                icon={Building2}
                availableOptions={availablePublisherNames}
              />
            </div>

            <div className="flex-1 sm:flex-initial">
              <MultiSelectFilter
                label="السلسلة"
                options={[]}
                selectedOptions={selectedSeries}
                onOptionsChange={setSelectedSeries}
                icon={Library}
                availableOptions={availableSeriesNames}
              />
            </div>

            <div className="flex-1 sm:flex-initial">
              <MultiSelectFilter
                label="نوع الكتاب"
                options={[]}
                selectedOptions={selectedBookTypes}
                onOptionsChange={setSelectedBookTypes}
                icon={Library}
                availableOptions={availableBookTypeNames}
              />
            </div>

            {userHasProfile && (
              <button
                onClick={undefined}
                className="hidden"
              />
            )}

            {userHasProfile && (
              <button
                onClick={onToggleFavoritesOnly}
                className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] border rounded-xl transition-opacity relative whitespace-nowrap ${
                  showFavoritesOnly
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-card border-border hover:bg-muted'
                }`}
                title={showFavoritesOnly ? 'إظهار كل الكتب' : 'عرض المفضلة فقط'}
              >
                <Heart
                  className={`w-4 h-4 flex-shrink-0 transition-opacity ${
                    showFavoritesOnly ? 'fill-current' : ''
                  }`}
                />
                <span className="text-sm hidden lg:inline">المفضلة فقط</span>
                {showFavoritesOnly && favoritedBooks.length > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs font-bold rounded-full px-2 py-0.5">
                    {favoritedCount}
                  </span>
                )}
              </button>
            )}

            <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] bg-muted/50 border border-border/50 rounded-xl pointer-events-none">
              <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">
                {filteredCount} / {allBooksCount}
              </span>
            </div>
          </div>

          {/* Desktop Sort */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="relative" ref={sortDropdownRef as any}>
              <button
                className="flex items-center gap-2 px-4 py-2.5 h-[42px] bg-card border border-border rounded-xl hover:bg-muted transition-opacity"
              >
                <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">{mobileSortLabel}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isSortDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}

