import { useState, useEffect } from 'react';
import { FlatIcon } from './icons/FlatIcon';

export function CompactThemeToggle() {
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

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-md hover:bg-sidebar-accent transition-colors group"
      aria-label={isDark ? 'تبديل إلى الوضع النهاري' : 'تبديل إلى الوضع الليلي'}
      title={isDark ? 'تبديل إلى الوضع النهاري' : 'تبديل إلى الوضع الليلي'}
    >
      {isDark ? (
        <FlatIcon iconClass="fi-sr-moon-stars" className="w-4 h-4 text-sidebar-foreground/80 group-hover:text-sidebar-foreground" />
      ) : (
        <FlatIcon iconClass="fi-sr-sun" className="w-4 h-4 text-sidebar-foreground/80 group-hover:text-sidebar-foreground" />
      )}
    </button>
  );
}
