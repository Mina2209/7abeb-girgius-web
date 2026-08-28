import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { UserStarIcon } from './icons/UserStarIcon';

interface ChurchRoleDropdownProps {
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

const CHURCH_ROLES = [
  { value: 'كاهن', label: 'كاهن' },
  { value: 'معلم', label: 'معلم' },
  { value: 'أمين خدمة', label: 'أمين خدمة' },
  { value: 'خادم', label: 'خادم' },
  { value: 'لا اخدم', label: 'لا اخدم' },
  { value: 'اخرى', label: 'اخرى' },
];

export function ChurchRoleDropdown({ value, onChange, required }: ChurchRoleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (roleValue: string) => {
    onChange(roleValue);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <UserStarIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none z-10" />
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full pr-11 pl-10 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-right transition-colors"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
          {value || 'اختر الدور'}
        </span>
      </button>
      <ChevronDown className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      
      {/* Hidden input for form validation */}
      <input
        id="church-role-hidden-input"
        name="church_role"
        type="text"
        value={value}
        onChange={() => {}}
        required={required}
        className="absolute inset-0 opacity-0 pointer-events-none"
        tabIndex={-1}
      />

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-lg z-[100]">
          <div className="p-2">
            {CHURCH_ROLES.map((role) => (
              <button
                key={role.value}
                type="button"
                onClick={() => handleSelect(role.value)}
                className={`w-full text-right px-3 py-2 rounded-lg text-sm transition-colors ${
                  value === role.value
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted'
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}