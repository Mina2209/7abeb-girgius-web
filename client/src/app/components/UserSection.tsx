import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  User as UserIcon,
  LogIn,
  Heart,
  LogOut,
  ChevronLeft,
  Users,
  Tag,
  Settings,
  BarChart3,
  History,
  FileDown,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../utils/adminUtils';
import { CompactThemeToggle } from './CompactThemeToggle';
import { getImageUrl } from '../utils/getImageUrl';

interface UserSectionProps {
  isCollapsed: boolean;
  dropdownPlacement?: 'left' | 'bottom';
  onOpenLogin: () => void;
  onNavigateToProfile: () => void;
  onNavigateToFavorites: () => void;
  onNavigateToUserManagement: () => void;
  onNavigateToTopicsManagement: () => void;
  onNavigateToSiteSettings: () => void;
  onNavigateToAnalytics: () => void;
  onNavigateToActivity: () => void;
  onNavigateToExport: () => void;
}

type DropdownPosition = {
  left: number;
  top?: number;
  bottom?: number;
  width?: number;
};

function getTriggerRect(triggerEl: HTMLElement | null) {
  if (!triggerEl) return null;
  return triggerEl.getBoundingClientRect();
}

export function UserSection({
  isCollapsed,
  dropdownPlacement = 'left',
  onOpenLogin,
  onNavigateToProfile,
  onNavigateToFavorites,
  onNavigateToUserManagement,
  onNavigateToTopicsManagement,
  onNavigateToSiteSettings,
  onNavigateToAnalytics,
  onNavigateToActivity,
  onNavigateToExport,
}: UserSectionProps) {
  const { user, profile, signOut } = useAuth();
  const isAdmin = useIsAdmin();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [dropdownPos, setDropdownPos] = useState<DropdownPosition | null>(null);

  const updateDropdownPosition = () => {
    const rect = getTriggerRect(triggerRef.current);
    if (!rect) return;

    const width = Math.max(220, rect.width);
    const margin = 8;

    // Position relative to viewport so it won't be clipped by overflow-hidden.
    // Tailwind classes still style it; JS sets coordinates.
    if (dropdownPlacement === 'bottom') {
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
      setDropdownPos({
        left,
        bottom: margin,
        width,
      });
    } else {
      // left placement: open to the left of the trigger.
      // In RTL layout, this still works as we use absolute coordinates.
      const desiredWidth = 220;
      const bottom = window.innerHeight - rect.bottom;
      setDropdownPos({
        left: rect.left - desiredWidth - 8,
        bottom,
        width: desiredWidth,
      });
    }
  };

  // Close dropdown when clicking outside.
  // Use pointerdown and capture to avoid edge cases where clicks inside dropdown
  // are interpreted as outside due to React event ordering.
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      const dropdownEl = dropdownRef.current;
      const triggerEl = triggerRef.current;
      const clickedInsideDropdown = !!dropdownEl && dropdownEl.contains(target);
      const clickedInsideTrigger = !!triggerEl && triggerEl.contains(target);

      if (!clickedInsideDropdown && !clickedInsideTrigger) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown, {
      capture: true,
    });

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, {
        capture: true,
      } as any);
    };
  }, [isDropdownOpen]);

  useLayoutEffect(() => {
    if (!isDropdownOpen) return;

    // Ensure we have the latest coordinates when opening.
    updateDropdownPosition();

    const onResizeOrScroll = () => updateDropdownPosition();
    window.addEventListener('resize', onResizeOrScroll);
    window.addEventListener('scroll', onResizeOrScroll, true);

    return () => {
      window.removeEventListener('resize', onResizeOrScroll);
      window.removeEventListener('scroll', onResizeOrScroll, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDropdownOpen, dropdownPlacement]);

  const dropdownMenu = useMemo(() => {
    if (!isDropdownOpen || !profile) return null;

    const placement = dropdownPlacement === 'bottom' ? 'bottom' : 'left';


    return (
      <div
        ref={dropdownRef}
        className="bg-card border border-border rounded-lg shadow-lg overflow-hidden z-[9999] max-h-[60vh] overflow-y-auto"
        style={
          dropdownPos
            ? {
                position: 'fixed',
                left: dropdownPos.left,
                top: dropdownPos.top,
                bottom: dropdownPos.bottom,
                width: dropdownPos.width,
                // Helps with RTL text alignment/keyboard focus
                direction: 'rtl',
              }
            : { position: 'fixed', left: -99999, top: -99999 }
        }
        onPointerDown={(e) => {
          // Prevent outside handler from closing due to capture ordering.
          e.stopPropagation();
        }}
      >
        <div className="w-full">
          <button
            onClick={() => {
              onNavigateToProfile();
              setIsDropdownOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right text-sm"
          >
            <UserIcon className="w-5 h-5 flex-shrink-0" />
            <span>حسابي</span>
          </button>

          <button
            onClick={() => {
              onNavigateToFavorites();
              setIsDropdownOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right text-sm"
          >
            <Heart className="w-5 h-5 flex-shrink-0" />
            <span>المفضلات</span>
          </button>

          {isAdmin && (
            <>
              <div className="border-t border-border" />
              <button
                onClick={() => {
                  onNavigateToUserManagement();
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right text-sm"
              >
                <Users className="w-5 h-5 flex-shrink-0" />
                <span>إدارة المستخدمين</span>
              </button>
              <button
                onClick={() => {
                  onNavigateToTopicsManagement();
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right text-sm"
              >
                <Tag className="w-5 h-5 flex-shrink-0" />
                <span>إدارة المواضيع</span>
              </button>
              <button
                onClick={() => {
                  onNavigateToAnalytics();
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right text-sm"
              >
                <BarChart3 className="w-5 h-5 flex-shrink-0" />
                <span>الإحصائيات</span>
              </button>
              <button
                onClick={() => {
                  onNavigateToActivity();
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right text-sm"
              >
                <History className="w-5 h-5 flex-shrink-0" />
                <span>سجل نشاط المستخدمين</span>
              </button>
              <button
                onClick={() => {
                  onNavigateToExport();
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right text-sm"
              >
                <FileDown className="w-5 h-5 flex-shrink-0" />
                <span>تصدير البيانات</span>
              </button>
              <button
                onClick={() => {
                  onNavigateToSiteSettings();
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right text-sm"
              >
                <Settings className="w-5 h-5 flex-shrink-0" />
                <span>إعدادات الموقع</span>
              </button>
            </>
          )}

          <div className="border-t border-border" />
          <button
            onClick={() => {
              signOut();
              setIsDropdownOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-destructive/10 text-destructive transition-colors text-right text-sm"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>
    );
  }, [
    dropdownPos,
    dropdownRef,
    isAdmin,
    isDropdownOpen,
    onNavigateToActivity,
    onNavigateToAnalytics,
    onNavigateToExport,
    onNavigateToFavorites,
    onNavigateToProfile,
    onNavigateToSiteSettings,
    onNavigateToTopicsManagement,
    onNavigateToUserManagement,
    profile,
    signOut,
  ]);

  if (!user || !profile) {
    // Not logged in
    return (
      <div className="px-3 py-2.5 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenLogin}
            className="flex-1 flex items-center gap-3 p-2.5 rounded-lg transition-colors bg-primary text-primary-foreground hover:opacity-90"
            title="تسجيل الدخول"
          >
            {!isCollapsed && <LogIn className="w-5 h-5 flex-shrink-0" />}
            {!isCollapsed && (
              <span className="text-right flex-1">تسجيل الدخول</span>
            )}
            {isCollapsed && (
              <LogIn className="w-5 h-5 flex-shrink-0 mx-auto" />
            )}
          </button>
          <CompactThemeToggle />
        </div>
      </div>
    );
  }

  const toggleDropdown = () => {
    setIsDropdownOpen((v) => {
      const next = !v;
      if (next) {
        // Ensure we position before paint.
        updateDropdownPosition();
      }
      return next;
    });
  };

  if (isCollapsed) {
    return (
      <div className="px-3 py-2.5 border-t border-sidebar-border relative">
        <div className="flex items-center gap-2" ref={triggerRef}>
          <button
            onClick={toggleDropdown}
            className="flex-1 flex items-center justify-center hover:bg-sidebar-hover rounded-lg p-2 transition-colors"
            title={profile.full_name}
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              {profile.avatar_url ? (
                <img
                  src={getImageUrl(profile.avatar_url)}
                  alt={profile.full_name}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <UserIcon className="w-5 h-5" />
              )}
            </div>
          </button>
          <CompactThemeToggle />
        </div>

        {isDropdownOpen && createPortal(dropdownMenu, document.body)}
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5 border-t border-sidebar-border relative">
      <div className="flex items-center gap-2" ref={triggerRef}>
        <button
          onClick={toggleDropdown}
          className="flex-1 min-w-0 flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-sidebar-hover"
        >
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
            {profile.avatar_url ? (
              <img
                src={getImageUrl(profile.avatar_url)}
                alt={profile.full_name}
                loading="lazy"
                decoding="async"
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <UserIcon className="w-5 h-5" />
            )}
          </div>
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <p
              dir="auto"
              title={profile.full_name}
              className="font-semibold text-sm leading-tight text-right w-full break-words overflow-hidden whitespace-normal pr-2"
              style={{
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
              }}
            >
              {profile.full_name}
            </p>
          </div>
          <ChevronLeft
            className={`w-4 h-4 flex-shrink-0 transition-transform ${
              isDropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>
        <div className="flex-shrink-0">
          <CompactThemeToggle />
        </div>
      </div>

      {isDropdownOpen && createPortal(dropdownMenu, document.body)}
    </div>
  );
}

