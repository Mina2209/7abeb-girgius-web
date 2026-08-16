import { useState, useEffect, useCallback, memo } from 'react';
import {
  ChevronRight,
  Menu,
  X,
  EyeOff,
  Church,
  Music,
} from 'lucide-react';

import logoImg256 from '../../assets/church-logo-256.webp';
import logoImg40 from '../../assets/church-logo-40.webp';
import { CopticIcon } from './icons/CopticIcon';
import { FlatIcon } from './icons/FlatIcon';
import { CompactThemeToggle } from './CompactThemeToggle';
import { UserSection } from './UserSection';
import { apiGetJson } from '../services/apiClient';


interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onCollapseChange: (collapsed: boolean) => void;
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

// Icon wrapper components for Flaticon
const HomeIcon = (props: any) => (
  <FlatIcon iconClass="fi-sr-house-chimney" {...props} />
);

const PrayingHandsIcon = (props: any) => (
  <FlatIcon iconClass="fi-sr-praying-hands" {...props} />
);

const MusicIcon = (props: any) => (
  <Music {...props} />
);
const PresentationFolderIcon = (props: any) => (
  <FlatIcon iconClass="fi-sr-folder" {...props} />
);
const PictureIcon = (props: any) => (
  <FlatIcon iconClass="fi-sr-picture" {...props} />
);
const UserIcon = (props: any) => (
  <FlatIcon iconClass="fi-sr-user" {...props} />
);
const BookOpenIcon = (props: any) => (
  <FlatIcon iconClass="fi-sr-book-alt" {...props} />
);
const QuoteIcon = (props: any) => (
  <FlatIcon iconClass="fi-sr-comment-quote" {...props} />
);
const InfoIcon = (props: any) => (
  <FlatIcon iconClass="fi-sr-info" {...props} />
);




const menuItems = [
  { id: 'home', label: 'الصفحة الرئيسية', icon: HomeIcon },
  { id: 'liturgy', label: 'بوربوينت الليتورجية', icon: PrayingHandsIcon },
  { id: 'hymns', label: 'مكتبة الترانيم', icon: MusicIcon },
  { id: 'various', label: 'بوربوينت متنوعة', icon: PresentationFolderIcon },
  { id: 'images', label: 'مكتبة الصور', icon: PictureIcon },
  { id: 'books', label: 'مكتبة الكتب', icon: BookOpenIcon },
  { id: 'sayings', label: 'أقوال أباء', icon: QuoteIcon },
  { id: 'coptic', label: 'لغة قبطية', icon: CopticIcon },
];

function getInitialUserRole(): string {
  try {
    const currentProfile = localStorage.getItem('profile');
    if (currentProfile) {
      const user = JSON.parse(currentProfile);
      return user.role || 'viewer';
    }
  } catch {}
  return 'viewer';
}

export const ChurchSidebar = memo(function ChurchSidebar({
  activeSection,
  onSectionChange,
  onCollapseChange,
  onOpenLogin,
  onNavigateToProfile,
  onNavigateToFavorites,
  onNavigateToUserManagement,
  onNavigateToTopicsManagement,
  onNavigateToSiteSettings,
  onNavigateToAnalytics,
  onNavigateToActivity,
  onNavigateToExport,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sectionsVisibility, setSectionsVisibility] = useState<
    Record<string, boolean>
  >({});
  const [userRole, setUserRole] = useState<string>(getInitialUserRole);

  // Load visibility settings after initial paint (non-blocking)
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await apiGetJson<{ settings?: any }>(
          '/api/auth/settings/site',
          { method: 'GET' },
        );
        if (!cancelled && data?.settings?.site_sections_visibility) {
          setSectionsVisibility(data.settings.site_sections_visibility);
        }
      } catch {
        // Non-blocking: keep defaults.
      }
    };

    const scheduleLoad = typeof requestIdleCallback === 'function'
      ? () => requestIdleCallback(() => { if (!cancelled) load(); })
      : () => setTimeout(() => { if (!cancelled) load(); }, 0);

    scheduleLoad();

    const handleVisibilityChange = () => {
      load();
    };

    const handleUserChange = () => {
      const currentProfile = localStorage.getItem('profile');
      if (currentProfile) {
        try {
          const user = JSON.parse(currentProfile);
          setUserRole(user.role || 'viewer');
        } catch {
          setUserRole('viewer');
        }
      } else {
        setUserRole('viewer');
      }
    };

    window.addEventListener('sectionsVisibilityChanged', handleVisibilityChange);
    window.addEventListener('storage', handleUserChange);
    window.addEventListener('userChanged', handleUserChange);

    return () => {
      cancelled = true;
      window.removeEventListener('sectionsVisibilityChanged', handleVisibilityChange);
      window.removeEventListener('storage', handleUserChange);
      window.removeEventListener('userChanged', handleUserChange);
    };
  }, []);

  // Check if a section should be visible to the current user
  const isSectionVisible = (sectionId: string): boolean => {
    const isPubliclyVisible = sectionsVisibility[sectionId] ?? true;

    // Editors and Admins see everything
    if (userRole === 'editor' || userRole === 'admin') {
      return true;
    }

    // Viewers only see publicly visible sections
    return isPubliclyVisible;
  };

  // Check if a section is hidden (for styling purposes)
  const isSectionHidden = (sectionId: string): boolean => {
    return !(sectionsVisibility[sectionId] ?? true);
  };

  // Filter menu items based on visibility
  // Admins and Editors see ALL sections, Viewers only see visible ones
  const visibleMenuItems =
    userRole === 'admin' || userRole === 'editor'
      ? menuItems
      : menuItems.filter((item) => isSectionVisible(item.id));

  // For "about" section - admins/editors always see it, viewers only if it's visible
  const isAboutVisible =
    userRole === 'admin' || userRole === 'editor'
      ? true
      : isSectionVisible('about');

  const handleSectionChange = (section: string) => {
    onSectionChange(section);
    setIsMobileMenuOpen(false); // Close mobile menu when item is selected
  };

  const handleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    onCollapseChange(collapsed);
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-[110] animate-in fade-in duration-200"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-sidebar text-sidebar-foreground z-[200] border-b border-sidebar-border shadow-lg">
          <div className="flex items-center justify-between px-3 h-20">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center p-2 rounded-md hover:bg-sidebar-accent transition-colors group"
                aria-label="القائمة"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6 group-hover:text-sidebar-accent-foreground" />
              ) : (
                <Menu className="w-6 h-6 group-hover:text-sidebar-accent-foreground" />
              )}
            </button>
            <CompactThemeToggle />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex flex-col items-center text-center leading-tight">
              <p className="font-semibold text-sm">
                خدمة الأرشيدياكون حبيب جرجس للداتا شو
              </p>
              <h2 className="text-[11px] font-medium text-sidebar-foreground/70">
                كنيسة السيدة العذراء مريم النزهة الجديدة
              </h2>
            </div>
            <img
              src={logoImg40}
              alt="Church Logo"
              width={40}
              height={40}
              loading="lazy"
              decoding="async"
              className="w-10 h-10 rounded-lg object-cover"
            />
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <div
          className={`lg:hidden fixed inset-0 z-[160] bg-sidebar border-t border-sidebar-border shadow-xl transition-all duration-300 ease-in-out overflow-hidden ${
            isMobileMenuOpen
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none invisible'
          }`}
          style={{ top: 'var(--app-header-height)' }}
        >
          <div className="h-full w-full overflow-y-auto overflow-x-hidden pb-20">
            <nav className="p-3">
              <ul className="space-y-1">
              {visibleMenuItems.map((item) => {
                const Icon = item.icon;
                const isHidden = isSectionHidden(item.id);
                const canSeeHidden =
                  userRole === 'editor' || userRole === 'admin';

                return (
                  <li key={item.id}>
                    <button
                      onClick={() => handleSectionChange(item.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm ${
                        activeSection === item.id
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground'
                      } ${isHidden && canSeeHidden ? 'opacity-60' : ''}`}
                    >
                      <Icon className="w-5 h-5 flex-shrink-0" />
                      <span className="text-right flex-1">{item.label}</span>
                      {isHidden && canSeeHidden && (
                        <EyeOff className="w-4 h-4 flex-shrink-0 text-orange-500" />
                      )}
                    </button>
                  </li>
                );
              })}
              </ul>
            </nav>

            {/* About Section */}
            {isAboutVisible && (
              <div className="px-3 py-2 mt-1 border-t border-sidebar-border/50">
                <button
                  onClick={() => handleSectionChange('about')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm ${
                    activeSection === 'about'
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-hover hover:text-sidebar-foreground'
                  } ${isSectionHidden('about') && (userRole === 'editor' || userRole === 'admin') ? 'opacity-60' : ''}`}
                  title="عن الخدمة"
                >
                  <InfoIcon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-right flex-1">عن الخدمة</span>
                  {isSectionHidden('about') &&
                    (userRole === 'editor' || userRole === 'admin') && (
                      <EyeOff className="w-4 h-4 flex-shrink-0 text-orange-500" />
                    )}
                </button>
              </div>
            )}

          {/* User Section - Mobile */}
          <UserSection
            isCollapsed={false}
            dropdownPlacement="bottom"
            onOpenLogin={() => {
              onOpenLogin();
              setIsMobileMenuOpen(false);
            }}
            onNavigateToProfile={() => {
              onNavigateToProfile();
              setIsMobileMenuOpen(false);
            }}
            onNavigateToFavorites={() => {
              onNavigateToFavorites();
              setIsMobileMenuOpen(false);
            }}
            onNavigateToUserManagement={() => {
              onNavigateToUserManagement();
              setIsMobileMenuOpen(false);
            }}
            onNavigateToTopicsManagement={() => {
              onNavigateToTopicsManagement();
              setIsMobileMenuOpen(false);
            }}
            onNavigateToSiteSettings={() => {
              onNavigateToSiteSettings();
              setIsMobileMenuOpen(false);
            }}
            onNavigateToAnalytics={() => {
              onNavigateToAnalytics();
              setIsMobileMenuOpen(false);
            }}
            onNavigateToActivity={() => {
              onNavigateToActivity();
              setIsMobileMenuOpen(false);
            }}
            onNavigateToExport={() => {
              onNavigateToExport();
              setIsMobileMenuOpen(false);
            }}
          />
          </div>
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div
        className={`hidden lg:flex inset-y-0 bg-sidebar text-sidebar-foreground transition-all duration-300 flex-col fixed right-0 top-0 bottom-0 z-[200] shadow-lg overflow-hidden shrink-0 ${
          isCollapsed ? 'w-20' : 'w-64'
        } pointer-events-none lg:pointer-events-auto`}
      >
        {/* Header with Logo - Fixed at Top */}
        <div className="px-3 py-3 border-b border-sidebar-border relative flex-shrink-0">
          {!isCollapsed ? (
            <>
              <button
                onClick={() => handleCollapse(true)}
                className="p-2 rounded-md hover:bg-sidebar-accent transition-colors absolute top-3 left-3 z-10 group"
                aria-label="طي القائمة"
              >
                <ChevronRight className="w-5 h-5 group-hover:text-sidebar-accent-foreground" />
              </button>
              <div className="flex flex-col items-center gap-2 w-full px-3 py-1.5">
                <div className="text-center w-full px-1">
                  <h2 className="text-[13px] font-semibold leading-snug line-clamp-2">
                  خدمة الأرشيدياكون حبيب جرجس للداتا شو
                  </h2>
                </div>
                
                <img
                  src={logoImg256}
                  alt="Church Logo"
                  width={76}
                  height={76}
                  decoding="async"
                  className="w-[76px] h-[76px] object-contain rounded-lg"
                />
                <p className="text-[11px] font-medium text-sidebar-foreground/70 text-center leading-tight">
                    كنيسة السيدة العذراء مريم النزهة الجديدة  
                </p>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 w-full">
              <img
                src={logoImg40}
                alt="Church Logo"
                width={40}
                height={40}
                decoding="async"
                className="w-10 h-10 rounded-lg object-cover"
              />
              <button
                onClick={() => handleCollapse(false)}
                className="p-2 rounded-md hover:bg-sidebar-accent transition-colors group"
                aria-label="توسيع القائمة"
              >
                <ChevronRight className="w-5 h-5 rotate-180 group-hover:text-sidebar-accent-foreground" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Menu - Scrollable */}
        <nav className="flex-1 min-h-0 overflow-y-auto scrollbar-hide [mask-image:linear-gradient(to_bottom,black_90%,transparent_100%)] px-3 py-2">
          <ul className="space-y-1.5">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              const isHidden = isSectionHidden(item.id);
              const canSeeHidden = userRole === 'editor' || userRole === 'admin';

              const buttonClasses = [
                'w-full flex items-center justify-center gap-2.5 p-2.5 rounded-lg transition-colors',
                activeSection === item.id
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'hover:bg-sidebar-hover text-sidebar-foreground/80 hover:text-sidebar-foreground',
                isHidden && canSeeHidden ? 'opacity-70' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <li key={item.id}>
                  <button
                    onClick={() => onSectionChange(item.id)}
                    className={buttonClasses}
                    title={isCollapsed ? item.label : ''}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />

                    {!isCollapsed && (
                      <>
                        <span className="text-right flex-1 truncate">{item.label}</span>
                        {isHidden && canSeeHidden && (
                          <EyeOff className="w-4 h-4 flex-shrink-0 text-orange-500" />
                        )}
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom Section - Anchored at Bottom */}
        <div className="flex-shrink-0">
          {/* About Section */}
          {isAboutVisible && (
            <div className="px-3 py-2 border-t border-sidebar-border">
              <button
                onClick={() => onSectionChange('about')}
                className={`w-full flex justify-center items-center gap-3 p-3 rounded-lg transition-colors ${
                  activeSection === 'about'
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'hover:bg-sidebar-hover text-sidebar-foreground/80 hover:text-sidebar-foreground'
                } ${isSectionHidden('about') && (userRole === 'editor' || userRole === 'admin') ? 'opacity-70' : ''}`}
                title="عن الخدمة"
              >
                <InfoIcon className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && (
                  <>
                    <span className="text-right flex-1">عن الخدمة</span>
                    {isSectionHidden('about') &&
                      (userRole === 'editor' || userRole === 'admin') && (
                        <EyeOff className="w-4 h-4 flex-shrink-0 text-orange-500" />
                      )}
                  </>
                )}
              </button>
            </div>
          )}

          {/* User Section */}
          <UserSection
            isCollapsed={isCollapsed}
            onOpenLogin={onOpenLogin}
            onNavigateToProfile={onNavigateToProfile}
            onNavigateToFavorites={onNavigateToFavorites}
            onNavigateToUserManagement={onNavigateToUserManagement}
            onNavigateToTopicsManagement={onNavigateToTopicsManagement}
            onNavigateToSiteSettings={onNavigateToSiteSettings}
            onNavigateToAnalytics={onNavigateToAnalytics}
            onNavigateToActivity={onNavigateToActivity}
            onNavigateToExport={onNavigateToExport}
          />

        </div>
      </div>
    </>
  );
});
