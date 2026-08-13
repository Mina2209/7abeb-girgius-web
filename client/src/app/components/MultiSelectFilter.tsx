import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { ChevronDown, X, LucideIcon, Search } from 'lucide-react';
import { normalizeArabic } from '../utils/arabicUtils';

interface MultiSelectFilterProps {
  label: string;
  options: string[];
  selectedOptions: string[];
  onOptionsChange: (options: string[]) => void;
  icon?: LucideIcon;
  availableOptions?: string[];
}

export function MultiSelectFilter({
  label,
  options,
  selectedOptions,
  onOptionsChange,
  icon,
  availableOptions,
}: MultiSelectFilterProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);

  const Icon = icon;
  const normalizeSearchText = (text: string) => normalizeArabic(text).toLowerCase();

  const availableOptionSet = useMemo(
    () => new Set((availableOptions ?? options).filter(Boolean)),
    [availableOptions, options],
  );

  const normalizedSearchQuery = normalizeSearchText(searchQuery);

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

  // Reset search when dropdown closes
  useEffect(() => {
    if (!isDropdownOpen) {
      setSearchQuery('');
    }
  }, [isDropdownOpen]);

  const toggleOption = (option: string) => {
    if (selectedOptions.includes(option)) {
      onOptionsChange(selectedOptions.filter(o => o !== option));
    } else {
      onOptionsChange([...selectedOptions, option]);
    }
  };

  const clearAllOptions = () => {
    onOptionsChange([]);
  };

  // Filter options based on search query
  const filteredOptions = options.filter(
    (option) =>
      (availableOptionSet.has(option) || selectedOptions.includes(option)) &&
      normalizeSearchText(option).includes(normalizedSearchQuery),
  );

  return (
    <div className="relative w-full sm:w-auto" ref={triggerRef}>
      <button
        onClick={toggleDropdown}
        className="flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] bg-card border border-border rounded-xl hover:bg-muted transition-colors relative w-full justify-center sm:justify-start"
      >
        {Icon && <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
        <span className="text-sm hidden md:inline">{label}</span>
        {selectedOptions.length > 0 && (
          <span 
            onClick={(e) => {
              e.stopPropagation();
              clearAllOptions();
            }}
            className="absolute -top-2 -left-2 bg-primary text-primary-foreground text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center cursor-pointer hover:bg-destructive transition-colors group"
          >
            <span className="group-hover:hidden">{selectedOptions.length}</span>
            <X className="w-3.5 h-3.5 hidden group-hover:block" />
          </span>
        )}
        <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu — anchored below the button (full width on mobile,
          right-aligned under the button on desktop, RTL) */}
      {isDropdownOpen && (
        <div className="absolute right-0 left-0 sm:left-auto top-full mt-2 z-50 max-h-80 flex flex-col bg-card border border-border rounded-xl shadow-lg sm:w-72">
          {/* Search Box */}
          <div className="p-3 border-b border-border flex-shrink-0">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="بحث..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-10 pl-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm"
              />
            </div>
          </div>

          {/* Options list with checkboxes */}
          <div className="overflow-y-auto flex-1 p-2">
            {filteredOptions.length > 0 ? (
              <div className="space-y-1">
                {filteredOptions.map((option) => (
                  <label
                    key={option}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-muted rounded-lg cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedOptions.includes(option)}
                      onChange={() => toggleOption(option)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary/50 cursor-pointer"
                    />
                    <span className="text-sm flex-1">{option}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-sm text-muted-foreground">
                {searchQuery ? 'لا توجد نتائج' : 'لا توجد خيارات متاحة'}
              </div>
            )}
          </div>

          {/* Footer with clear button */}
          {selectedOptions.length > 0 && (
            <div className="p-3 border-t border-border flex-shrink-0">
              <button
                onClick={clearAllOptions}
                className="w-full px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
              >
                مسح الكل
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
