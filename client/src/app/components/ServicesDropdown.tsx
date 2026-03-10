import { useState, useRef, useEffect } from 'react';
import { Users, ChevronDown } from 'lucide-react';

interface ServicesDropdownProps {
  value: string[];
  onChange: (value: string[]) => void;
  required?: boolean;
}

const SERVICES = [
  { value: 'خدمة عرض الصلوات الليتورجية', label: 'خدمة عرض الصلوات الليتورجية' },
  { value: 'خدمة البث المباشر', label: 'خدمة البث المباشر' },
  { value: 'مدارس احد - حضانة / كي جي', label: 'مدارس احد - حضانة / كي جي' },
  { value: 'مدارس احد - ابتدائى', label: 'مدارس احد - ابتدائى' },
  { value: 'مدارس احد - اعدادى', label: 'مدارس احد - اعدادى' },
  { value: 'مدارس احد - ثانوى', label: 'مدارس احد - ثانوى' },
  { value: 'شباب جامعى / خريجين', label: 'شباب جامعى / خريجين' },
  { value: 'اجتماع سيدات', label: 'اجتماع سيدات' },
  { value: 'اجتماع حديثى زواج/اسرة', label: 'اجتماع حديثى زواج/اسرة' },
  { value: 'اخوة رب', label: 'اخوة رب' },
  { value: 'مدرسة الشمامسة/الحان', label: 'مدرسة الشمامسة/الحان' },
  { value: 'اعداد خدام', label: 'اعداد خدام' },
  { value: 'اجتماع الخدام', label: 'اجتماع الخدام' },
  { value: 'كشافة', label: 'كشافة' },
  { value: 'وسائل ايضاح', label: 'وسائل ايضاح' },
  { value: 'خدمة مسرح', label: 'خدمة مسرح' },
  { value: 'خدمة كورال', label: 'خدمة كورال' },
  { value: 'اخرى', label: 'اخرى' },
];

export function ServicesDropdown({ value, onChange, required }: ServicesDropdownProps) {
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

  const handleToggle = (serviceValue: string) => {
    const newValue = value.includes(serviceValue)
      ? value.filter(v => v !== serviceValue)
      : [...value, serviceValue];
    onChange(newValue);
  };

  const displayText = value.length === 0 
    ? 'اختر الخدمات' 
    : value.length === 1 
    ? value[0] 
    : `${value.length} خدمات محددة`;

  return (
    <div className="relative" ref={dropdownRef}>
      <Users className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none z-10" />
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full pr-11 pl-10 py-3 bg-card border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-right transition-colors"
      >
        <span className={value.length > 0 ? 'text-foreground' : 'text-muted-foreground'}>
          {displayText}
        </span>
      </button>
      <ChevronDown className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      
      {/* Hidden input for form validation */}
      <input
        type="text"
        value={value.join(',')}
        onChange={() => {}}
        required={required}
        className="absolute inset-0 opacity-0 pointer-events-none"
        tabIndex={-1}
      />

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-card border border-border rounded-xl shadow-lg z-[100] max-h-96 overflow-y-auto">
          <div className="p-3">
            <div className="text-sm text-muted-foreground mb-3 font-medium">
              اختر كل ما ينطبق
            </div>
            {SERVICES.map((service) => (
              <label
                key={service.value}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted cursor-pointer transition-colors"
              >
                <input
                  type="checkbox"
                  checked={value.includes(service.value)}
                  onChange={() => handleToggle(service.value)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-2 focus:ring-primary/50"
                />
                <span className="text-sm flex-1 text-right">
                  {service.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
