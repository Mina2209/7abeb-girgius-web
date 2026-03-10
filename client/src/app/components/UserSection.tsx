import { useState, useEffect, useRef } from 'react';
import { User as UserIcon, LogIn, Heart, LogOut, ChevronLeft, Users, Tag, Settings } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useIsAdmin } from '../utils/adminUtils';

interface UserSectionProps {
  isCollapsed: boolean;
  onOpenLogin: () => void;
  onNavigateToProfile: () => void;
  onNavigateToFavorites: () => void;
  onNavigateToUserManagement: () => void;
  onNavigateToTopicsManagement: () => void;
  onNavigateToSiteSettings: () => void;
}

export function UserSection({ 
  isCollapsed, 
  onOpenLogin, 
  onNavigateToProfile, 
  onNavigateToFavorites,
  onNavigateToUserManagement,
  onNavigateToTopicsManagement,
  onNavigateToSiteSettings
}: UserSectionProps) {
  const { user, profile, signOut } = useAuth();
  const isAdmin = useIsAdmin();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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

  if (!user || !profile) {
    // Not logged in
    return (
      <div className="px-4 py-3 border-t border-sidebar-border">
        <button
          onClick={onOpenLogin}
          className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors bg-primary text-primary-foreground hover:opacity-90"
          title="تسجيل الدخول"
        >
          <LogIn className="w-5 h-5 flex-shrink-0" />
          {!isCollapsed && <span className="text-right flex-1">تسجيل الدخول</span>}
        </button>
      </div>
    );
  }

  // Logged in
  if (isCollapsed) {
    // Collapsed view - show avatar with dropdown
    return (
      <div className="px-4 py-3 border-t border-sidebar-border relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="w-full flex items-center justify-center hover:bg-sidebar-hover rounded-lg p-2 transition-colors"
          title={profile.full_name}
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full rounded-full object-cover" />
            ) : (
              <UserIcon className="w-5 h-5" />
            )}
          </div>
        </button>

        {/* Dropdown Menu for collapsed state - opens to the left */}
        {isDropdownOpen && (
          <div className="absolute bottom-4 right-full mr-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-[300] w-48">
            <button
              onClick={() => {
                onNavigateToProfile();
                setIsDropdownOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right"
            >
              <UserIcon className="w-5 h-5 flex-shrink-0" />
              <span>حسابي</span>
            </button>
            <button
              onClick={() => {
                onNavigateToFavorites();
                setIsDropdownOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right"
            >
              <Heart className="w-5 h-5 flex-shrink-0" />
              <span>المفضلات</span>
            </button>
            {isAdmin && (
              <>
                <div className="border-t border-border"></div>
                <button
                  onClick={() => {
                    onNavigateToUserManagement();
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right"
                >
                  <Users className="w-5 h-5 flex-shrink-0" />
                  <span>إدارة المستخدمين</span>
                </button>
                <button
                  onClick={() => {
                    onNavigateToTopicsManagement();
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right"
                >
                  <Tag className="w-5 h-5 flex-shrink-0" />
                  <span>إدارة المواضيع</span>
                </button>
                <button
                  onClick={() => {
                    onNavigateToSiteSettings();
                    setIsDropdownOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right"
                >
                  <Settings className="w-5 h-5 flex-shrink-0" />
                  <span>إعدادات الموقع</span>
                </button>
              </>
            )}
            <div className="border-t border-border"></div>
            <button
              onClick={() => {
                signOut();
                setIsDropdownOpen(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-destructive/10 text-destructive transition-colors text-right"
            >
              <LogOut className="w-5 h-5 flex-shrink-0" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // Expanded view with dropdown
  return (
    <div className="px-4 py-3 border-t border-sidebar-border relative" ref={dropdownRef}>
      <button
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="w-full flex items-center gap-3 p-3 rounded-lg transition-colors hover:bg-sidebar-hover"
      >
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full rounded-full object-cover" />
          ) : (
            <UserIcon className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 text-right overflow-hidden">
          <p className="font-medium truncate">{profile.full_name}</p>
          <p className="text-xs text-muted-foreground truncate">{profile.church_role}</p>
        </div>
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Dropdown Menu - opens to the left */}
      {isDropdownOpen && (
        <div className="absolute bottom-4 right-full mr-2 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-[300] w-48">
          <button
            onClick={() => {
              onNavigateToProfile();
              setIsDropdownOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right"
          >
            <UserIcon className="w-5 h-5 flex-shrink-0" />
            <span>حسابي</span>
          </button>
          <button
            onClick={() => {
              onNavigateToFavorites();
              setIsDropdownOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right"
          >
            <Heart className="w-5 h-5 flex-shrink-0" />
            <span>المفضلات</span>
          </button>
          {isAdmin && (
            <>
              <div className="border-t border-border"></div>
              <button
                onClick={() => {
                  onNavigateToUserManagement();
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right"
              >
                <Users className="w-5 h-5 flex-shrink-0" />
                <span>إدارة المستخدمين</span>
              </button>
              <button
                onClick={() => {
                  onNavigateToTopicsManagement();
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right"
              >
                <Tag className="w-5 h-5 flex-shrink-0" />
                <span>إدارة المواضيع</span>
              </button>
              <button
                onClick={() => {
                  onNavigateToSiteSettings();
                  setIsDropdownOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted transition-colors text-right"
              >
                <Settings className="w-5 h-5 flex-shrink-0" />
                <span>إعدادات الموقع</span>
              </button>
            </>
          )}
          <div className="border-t border-border"></div>
          <button
            onClick={() => {
              signOut();
              setIsDropdownOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-destructive/10 text-destructive transition-colors text-right"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      )}
    </div>
  );
}