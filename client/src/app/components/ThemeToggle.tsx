import { useState, useEffect } from 'react';
import { FlatIcon } from './icons/FlatIcon';

interface ThemeToggleProps {
  isCollapsed?: boolean;
}

export function ThemeToggle({ isCollapsed = false }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(false);

  // Initialize theme from localStorage or default to light
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialDark = savedTheme === 'dark' || (!savedTheme && prefersDark);
    setIsDark(initialDark);
    if (initialDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = !isDark;
    setIsDark(newTheme);
    if (newTheme) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  if (isCollapsed) {
    // Vertical pill toggle for collapsed sidebar
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <button
          onClick={toggleTheme}
          className="relative w-[37px] h-[72px] bg-sidebar-toggle-bg rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50"
          aria-label={isDark ? 'تبديل إلى الوضع النهاري' : 'تبديل إلى الوضع الليلي'}
        >
          <div
            className={`absolute left-[2.5px] top-[3px] w-[32px] h-[32px] bg-primary rounded-full shadow-lg transition-transform duration-300 flex items-center justify-center ${
              isDark ? 'translate-y-[34px]' : 'translate-y-0'
            }`}
          >
            {isDark ? (
              <FlatIcon iconClass="fi-sr-moon-stars" className="w-4 h-4 text-primary-foreground" />
            ) : (
              <FlatIcon iconClass="fi-sr-sun" className="w-4 h-4 text-primary-foreground" />
            )}
          </div>
        </button>
      </div>
    );
  }

  // Horizontal pill toggle for expanded sidebar
  return (
    <div className="flex items-center justify-center py-4 px-4">
      <button
        onClick={toggleTheme}
        className="relative w-[140px] h-11 bg-sidebar-toggle-bg rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary/50 flex-shrink-0"
        aria-label={isDark ? 'تبديل إلى الوضع النهاري' : 'تبديل إلى الوضع الليلي'}
      >
        {/* Text labels */}
        <div className="absolute inset-0 flex items-center justify-between px-3 pointer-events-none">
          <span className={`text-xs font-medium transition-all duration-300 text-sidebar-toggle-text ${!isDark ? 'opacity-100 translate-x-0 z-10' : 'opacity-100 -translate-x-1'}`}>
            فاتح
          </span>
          <span className={`text-xs font-medium transition-all duration-300 text-sidebar-toggle-text ${isDark ? 'opacity-100 translate-x-0 z-10' : 'opacity-100 translate-x-1'}`}>
            داكن
          </span>
        </div>
        
        {/* Moving circle with icon */}
        <div
          className={`absolute left-[3px] top-[3px] w-[38px] h-[38px] bg-primary rounded-full shadow-lg transition-transform duration-300 flex items-center justify-center ${
            isDark ? 'translate-x-[95px]' : 'translate-x-0'
          }`}
        >
          {isDark ? (
            <FlatIcon iconClass="fi-sr-moon-stars" className="w-4 h-4 text-primary-foreground" />
          ) : (
            <FlatIcon iconClass="fi-sr-sun" className="w-4 h-4 text-primary-foreground" />
          )}
        </div>
      </button>
    </div>
  );
}