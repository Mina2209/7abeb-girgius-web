import { useState } from 'react';
import { Sun, MoonStar } from 'lucide-react';

function getInitialDark(): boolean {
  try {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch {
    return false;
  }
}

export function CompactThemeToggle() {
  const [isDark, setIsDark] = useState(getInitialDark);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-md hover:bg-sidebar-accent transition-colors group"
      aria-label={isDark ? 'تبديل إلى الوضع النهاري' : 'تبديل إلى الوضع الليلي'}
      title={isDark ? 'تبديل إلى الوضع النهاري' : 'تبديل إلى الوضع الليلي'}
    >
      {isDark ? (
        <MoonStar className="w-4 h-4 text-sidebar-foreground/80 group-hover:text-sidebar-foreground transition-colors" />
      ) : (
        <Sun className="w-4 h-4 text-sidebar-foreground/80 group-hover:text-white transition-colors" />
      )}
    </button>
  );
}
