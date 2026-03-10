import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, LucideIcon, Search } from 'lucide-react';

interface MultiSelectFilterProps {
  label: string;
  options: string[];
  selectedOptions: string[];
  onOptionsChange: (options: string[]) => void;
  icon?: LucideIcon;
}

export function MultiSelectFilter({ label, options, selectedOptions, onOptionsChange, icon }: MultiSelectFilterProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const Icon = icon;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
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
  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="relative w-full sm:w-auto" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
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

      {/* Dropdown menu */}
      {isDropdownOpen && (
        <>
          {/* Mobile: Full width dropdown */}
          <div className="sm:hidden absolute right-0 left-0 top-full mt-2 bg-card border border-border rounded-xl shadow-lg z-[100] max-h-[400px] flex flex-col">
            {/* Search Box */}
            <div className="p-3 border-b border-border">
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
              <div className="p-3 border-t border-border">
                <button
                  onClick={clearAllOptions}
                  className="w-full px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                >
                  مسح الكل
                </button>
              </div>
            )}
          </div>

          {/* Desktop: Dropdown aligned to button */}
          <div className="hidden sm:flex absolute right-0 top-full mt-2 w-72 bg-card border border-border rounded-xl shadow-lg z-[100] max-h-[400px] flex-col">
            {/* Search Box */}
            <div className="p-3 border-b border-border">
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
              <div className="p-3 border-t border-border">
                <button
                  onClick={clearAllOptions}
                  className="w-full px-4 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors"
                >
                  مسح الكل
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}