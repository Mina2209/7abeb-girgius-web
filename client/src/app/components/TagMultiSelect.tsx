import { Search, X, Check, Plus } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { normalizeArabic } from '../utils/arabicUtils';

interface TagMultiSelectProps {
  availableTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  label?: string;
  error?: string;
}

const normalizeSearchText = (text: string) => normalizeArabic(text).toLowerCase();

export function TagMultiSelect({
  availableTags,
  selectedTags,
  onTagsChange,
  placeholder = 'ابحث أو أضف موضوع...',
  label = 'الموضوع',
  error,
}: TagMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  const normalizedSearchQuery = normalizeSearchText(searchQuery);

  const filteredTags = availableTags.filter((tag) =>
    normalizeSearchText(tag).includes(normalizedSearchQuery),
  );

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag));
    } else {
      onTagsChange([...selectedTags, tag]);
    }
  };

  const handleRemoveTag = (tag: string) => {
    onTagsChange(selectedTags.filter(t => t !== tag));
  };

  const handleAddNewTag = () => {
    const trimmed = searchQuery.trim();
    if (trimmed && !availableTags.includes(trimmed) && !selectedTags.includes(trimmed)) {
      onTagsChange([...selectedTags, trimmed]);
      setSearchQuery('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddNewTag();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    
    // Check if the pasted text contains commas (English or Arabic)
    if (pastedText.includes(',') || pastedText.includes('،')) {
      e.preventDefault(); // Prevent default paste behavior
      
      // Split by comma (both English and Arabic), trim whitespace, and filter out empty strings
      const newTags = pastedText
        .split(/[,،]/) // Split by English comma OR Arabic comma
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0)
        .filter(tag => !selectedTags.includes(tag)); // Avoid duplicates
      
      // Add all new tags to selected tags
      if (newTags.length > 0) {
        onTagsChange([...selectedTags, ...newTags]);
        setSearchQuery(''); // Clear the input
      }
    }
    // If no commas, let the default paste behavior happen (single tag)
  };

  const canAddNew = searchQuery.trim() && 
    !availableTags.includes(searchQuery.trim()) && 
    !selectedTags.includes(searchQuery.trim());

  return (
    <div>
      <label className="block text-sm font-medium mb-2">
        {label} <span className="text-red-500">*</span>
      </label>

      <div className="relative" ref={dropdownRef}>
        {/* Trigger Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3 bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-right flex items-center justify-between"
        >
          <span className={selectedTags.length > 0 ? 'text-foreground' : 'text-muted-foreground'}>
            {selectedTags.length > 0
              ? `${selectedTags.length} تصنيف محدد`
              : placeholder}
          </span>
          <Search className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-xl shadow-lg z-50 max-h-[300px] overflow-hidden flex flex-col">
            {/* Search Input */}
            <div className="p-3 border-b border-border">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  placeholder="ابحث أو أضف تصنيف جديد..."
                  className="w-full pr-10 pl-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>
            </div>

            {/* Options List */}
            <div className="overflow-y-auto p-2 flex-1">
              {/* Add New Tag Option */}
              {canAddNew && (
                <button
                  type="button"
                  onClick={handleAddNewTag}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-sm text-primary"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة "{searchQuery.trim()}"</span>
                </button>
              )}

              {/* Existing Tags */}
              {filteredTags.length > 0 ? (
                filteredTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleToggleTag(tag)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg transition-colors text-sm ${
                        isSelected
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <span>{tag}</span>
                      {isSelected && <Check className="w-4 h-4" />}
                    </button>
                  );
                })
              ) : (
                !canAddNew && (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    لا توجد تصنيفات مطابقة
                  </div>
                )
              )}
            </div>

            {/* Footer */}
            {selectedTags.length > 0 && (
              <div className="p-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => onTagsChange([])}
                  className="w-full px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                >
                  مسح الكل
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected Tags Display */}
      {selectedTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-2 text-xs px-3 py-1.5 bg-primary/10 text-primary rounded-full"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="hover:bg-primary/20 rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
    </div>
  );
}