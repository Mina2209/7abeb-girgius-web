import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Sparkles } from 'lucide-react';

interface AIGeneratedFilterProps {
  value: 'all' | 'yes' | 'no';
  onChange: (value: 'all' | 'yes' | 'no') => void;
  availableValues?: Array<'yes' | 'no'>;
}

const options = [
  { value: 'all' as const, label: 'الكل' },
  { value: 'yes' as const, label: 'AI فقط' },
  { value: 'no' as const, label: 'بدون AI' },
];

export function AIGeneratedFilter({
  value,
  onChange,
  availableValues,
}: AIGeneratedFilterProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const availableValueSet = useMemo(
    () => new Set(availableValues ?? ['yes', 'no']),
    [availableValues],
  );

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

  const currentLabel = options.find((opt) => opt.value === value)?.label || 'الكل';
  const visibleOptions = options.filter(
    (option) =>
      option.value === 'all' ||
      availableValueSet.has(option.value) ||
      option.value === value,
  );

  return (
    <div className="relative w-full sm:w-auto" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center gap-2 px-3 sm:px-4 py-2.5 h-[42px] bg-card border border-border rounded-xl hover:bg-muted transition-colors w-full justify-center sm:justify-start"
      >
        <Sparkles className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm hidden md:inline">{currentLabel}</span>
        <ChevronDown className={`w-4 h-4 transition-transform flex-shrink-0 ${isDropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isDropdownOpen && (
        <>
          {/* Mobile: Full width dropdown */}
          <div className="sm:hidden absolute right-0 left-0 top-full mt-2 bg-card border border-border rounded-xl shadow-lg z-[100]">
            <div className="p-2">
              {visibleOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-right px-3 py-2 rounded-lg text-sm transition-colors ${
                    value === option.value
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop: Dropdown aligned to button */}
          <div className="hidden sm:block absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-lg z-[100]">
            <div className="p-2">
              {visibleOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value);
                    setIsDropdownOpen(false);
                  }}
                  className={`w-full text-right px-3 py-2 rounded-lg text-sm transition-colors ${
                    value === option.value
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
