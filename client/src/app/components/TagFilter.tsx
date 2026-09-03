import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, ChevronDown, X, LucideIcon } from 'lucide-react';
import { useUniversalTopics } from '../hooks/useUniversalTopics';
import { normalizeArabic } from '../utils/arabicUtils';

interface TagFilterProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  onSearchChange: (search: string) => void;
  searchQuery?: string;
  showSearch?: boolean;
  icon?: LucideIcon;
  containerRef?: React.RefObject<HTMLDivElement | null>;
  availableTopics?: string[];
}

export function TagFilter({
  selectedTags,
  onTagsChange,
  onSearchChange,
  searchQuery = '',
  showSearch = true,
  icon,
  containerRef,
  availableTopics,
}: TagFilterProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);
  const { topicNames, topicsBySection } = useUniversalTopics(); // Get topics grouped by sections

  const Icon = icon;
  const availableTopicSet = useMemo(
    () => (availableTopics ? new Set(availableTopics) : null),
    [availableTopics],
  );

  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen((open) => !open);
  }, []);

  // Close dropdown when clicking outside (the dropdown lives inside triggerRef)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      setIsDropdownOpen(false);
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const clearAllTags = () => {
    onTagsChange([]);
  };

  const isVisibleTopic = (tag: string) =>
    !availableTopicSet || availableTopicSet.has(tag) || selectedTags.includes(tag);

  const normalizeSearchText = (text: string) => normalizeArabic(text).toLowerCase();
  const normalizedTagSearch = normalizeSearchText(tagSearch);

  // Filter topics: if search is active, use flat filtered list, otherwise use grouped by section
  const filteredTags = topicNames.filter((tag) =>
    isVisibleTopic(tag) && normalizeSearchText(tag).includes(normalizedTagSearch),
  );

  const filteredSections = tagSearch
    ? null // When searching, show flat list
    : topicsBySection
        .map((group) => ({
          ...group,
          topics: group.topics.filter(isVisibleTopic),
        }))
        .filter((group) => group.topics.length > 0); // When not searching, show grouped by section

  return (
    <div className="space-y-4">
      {/* Search bar */}
      {showSearch && (
        <div className="relative">
          <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
          <input
            id="tag-filter-search"
            name="search"
            type="text"
            placeholder="ابحث في المحتوى..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pr-11 pl-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
          />
        </div>
      )}

      {/* Tags filter dropdown */}
      <div className="flex items-center gap-3 flex-wrap w-full">
        <div className="relative w-full" ref={triggerRef}>
          <button
            onClick={toggleDropdown}
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] bg-card border border-border rounded-xl hover:bg-muted transition-colors relative w-full justify-center sm:justify-start sm:w-auto"
          >
            {Icon && <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
            <span className="text-sm hidden md:inline">الموضوع</span>
            {selectedTags.length > 0 && (
              <span 
                onClick={(e) => {
                  e.stopPropagation();
                  clearAllTags();
                }}
                className="absolute -top-2 -left-2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center cursor-pointer hover:bg-destructive transition-colors group"
              >
                <span className="group-hover:hidden">{selectedTags.length}</span>
                <X className="w-3.5 h-3.5 hidden group-hover:block" />
              </span>
            )}
            <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown menu — anchored below the button (full width on mobile,
              right-aligned under the button on desktop, RTL) */}
          {isDropdownOpen && (
            <div className="absolute right-0 left-0 sm:left-auto top-full mt-2 z-50 max-h-80 flex flex-col bg-card border border-border rounded-xl shadow-lg min-w-[320px] sm:w-80">
              {/* Search within dropdown */}
              <div className="p-3 border-b border-border flex-shrink-0">
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                  <input
                    id="tag-filter-dropdown-search"
                    name="tag_search"
                    type="text"
                    placeholder="ابحث في المواضيع..."
                    value={tagSearch}
                    onChange={(e) => setTagSearch(e.target.value)}
                    className="w-full pr-10 pl-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              {/* Tags list with checkboxes */}
              <div className="overflow-y-auto flex-1 p-2">
                {tagSearch ? (
                  // When searching: show flat filtered list
                  filteredTags.length > 0 ? (
                    <div className="space-y-1">
                      {filteredTags.map((tag) => (
                        <label
                          key={tag}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-lg cursor-pointer transition-colors"
                        >
                          <input
                            id={`tag-filter-${tag.replace(/\s+/g, '-')}`}
                            name="tag"
                            type="checkbox"
                            checked={selectedTags.includes(tag)}
                            onChange={() => toggleTag(tag)}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50 cursor-pointer"
                          />
                          <span className="text-xs flex-1 whitespace-nowrap">{tag}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-xs text-muted-foreground">
                      لا توجد مواضيع مطابقة
                    </div>
                  )
                ) : (
                  // When not searching: show grouped by sections
                  filteredSections && filteredSections.length > 0 ? (
                    <div className="space-y-3">
                      {filteredSections.map((group) => (
                        <div key={group.section.id}>
                          {/* Section Header */}
                          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/50 mb-1">
                            {group.section.name}
                          </div>
                          {/* Topics in Section */}
                          <div className="space-y-1">
                            {group.topics.map((tag) => (
                              <label
                                key={tag}
                                className="flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-lg cursor-pointer transition-colors"
                              >
                                <input
                                  id={`tag-filter-${tag.replace(/\s+/g, '-')}`}
                                  name="tag"
                                  type="checkbox"
                                  checked={selectedTags.includes(tag)}
                                  onChange={() => toggleTag(tag)}
                                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50 cursor-pointer"
                                />
                                <span className="text-xs flex-1 whitespace-nowrap">{tag}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      لا توجد مواضيع
                    </div>
                  )
                )}
              </div>

              {/* Footer with clear button */}
              {selectedTags.length > 0 && (
                <div className="p-3 border-t border-border flex-shrink-0">
                  <button
                    onClick={clearAllTags}
                    className="w-full px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                  >
                    مسح جميع المواضيع
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
