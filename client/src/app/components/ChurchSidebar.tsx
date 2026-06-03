import { useState, useEffect } from 'react';
import { ChevronRight, Menu, X, EyeOff } from 'lucide-react';
import logoImg from '../../assets/7f2d73f44c853179b057f8217ffad677e12f814c.png';
import { CopticIcon } from './icons/CopticIcon';
import { FlatIcon } from './icons/FlatIcon';
import { ThemeToggle } from './ThemeToggle';
import { CompactThemeToggle } from './CompactThemeToggle';
import { UserSection } from './UserSection';

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
}

// Icon wrapper components for Flaticon
const HomeIcon = (props: any) => <FlatIcon iconClass="fi-sr-house-chimney" {...props} />;
const PrayingHandsIcon = (props: any) => <FlatIcon iconClass="fi-sr-praying-hands" {...props} />;
const MusicIcon = (props: any) => <FlatIcon iconClass="fi-ss-music-alt" {...props} />;
const PresentationFolderIcon = (props: any) => <FlatIcon iconClass="fi-sr-folder" {...props} />;
const PictureIcon = (props: any) => <FlatIcon iconClass="fi-sr-picture" {...props} />;
const BookOpenIcon = (props: any) => <FlatIcon iconClass="fi-sr-book-alt" {...props} />;
const QuoteIcon = (props: any) => <FlatIcon iconClass="fi-sr-comment-quote" {...props} />;
const InfoIcon = (props: any) => <FlatIcon iconClass="fi-sr-info" {...props} />;

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

export function ChurchSidebar({ 
  activeSection, 
  onSectionChange, 
  onCollapseChange, 
  onOpenLogin, 
  onNavigateToProfile, 
  onNavigateToFavorites,
  onNavigateToUserManagement,
  onNavigateToTopicsManagement,
  onNavigateToSiteSettings
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [sectionsVisibility, setSectionsVisibility] = useState<Record<string, boolean>>({});
  const [userRole, setUserRole] = useState<string>('viewer');

  // Load visibility settings and user role
  useEffect(() => {
    loadVisibilitySettings();
    loadUserRole();

    // Listen for visibility changes
    const handleVisibilityChange = () => {
      loadVisibilitySettings();
    };

    // Listen for user changes (login/logout)
    const handleUserChange = () => {
      loadUserRole();
    };

    window.addEventListener('sectionsVisibilityChanged', handleVisibilityChange);
    window.addEventListener('storage', handleUserChange);
    window.addEventListener('userChanged', handleUserChange);
    
    return () => {
      window.removeEventListener('sectionsVisibilityChanged', handleVisibilityChange);
      window.removeEventListener('storage', handleUserChange);
      window.removeEventListener('userChanged', handleUserChange);
    };
  }, []);

  const loadVisibilitySettings = () => {
    const saved = localStorage.getItem('site_sections_visibility');
    if (saved) {
      setSectionsVisibility(JSON.parse(saved));
    } else {
      // Default: all visible
      const defaultVis: Record<string, boolean> = {
        home: true,
        liturgy: true,
        hymns: true,
        various: true,
        images: true,
        books: true,
        sayings: true,
        coptic: true,
        about: true,
      };
      setSectionsVisibility(defaultVis);
    }
  };

  const loadUserRole = () => {
    const currentUser = localStorage.getItem('mockProfile');
    if (currentUser) {
      const user = JSON.parse(currentUser);
      setUserRole(user.role || 'viewer');
    } else {
      setUserRole('viewer');
    }
  };

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
  const visibleMenuItems = userRole === 'admin' || userRole === 'editor' 
    ? menuItems 
    : menuItems.filter(item => isSectionVisible(item.id));
  
  // For "about" section - admins/editors always see it, viewers only if it's visible
  const isAboutVisible = userRole === 'admin' || userRole === 'editor' 
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
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 rounded-md hover:bg-sidebar-accent transition-colors group"
              aria-label="القائمة"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6 group-hover:text-sidebar-accent-foreground" /> : <Menu className="w-6 h-6 group-hover:text-sidebar-accent-foreground" />}
            </button>
            <CompactThemeToggle />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-center">
              <h2 className="font-semibold text-sm leading-tight">خدمة الارشدياكون حبيب جرجس</h2>
            </div>
            <img src={logoImg} alt="Church Logo" className="w-10 h-10 rounded-lg object-cover" />
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <div 
          className={`bg-sidebar border-t border-sidebar-border overflow-y-auto transition-all duration-300 ease-in-out ${
            isMobileMenuOpen ? 'max-h-[80vh] opacity-100' : 'max-h-0 opacity-0'
          }`}
        >
          <nav className="p-4">
            <ul className="space-y-2">
              {visibleMenuItems.map((item) => {
                const Icon = item.icon;
                const isHidden = isSectionHidden(item.id);
                const canSeeHidden = userRole === 'editor' || userRole === 'admin';
                
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => handleSectionChange(item.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        activeSection === item.id
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'hover:bg-sidebar-hover text-sidebar-foreground/80 hover:text-sidebar-foreground'
                      } ${isHidden && canSeeHidden ? 'opacity-70' : ''}`}
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
            <div className="px-4 py-3 border-t border-sidebar-border">
              <button
                onClick={() => handleSectionChange('about')}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
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
                    {isSectionHidden('about') && (userRole === 'editor' || userRole === 'admin') && (
                      <EyeOff className="w-4 h-4 flex-shrink-0 text-orange-500" />
                    )}
                  </>
                )}
              </button>
            </div>
          )}

          {/* User Section - Mobile */}
          <UserSection 
            isCollapsed={false}
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
          />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div
        className={`hidden lg:flex h-screen bg-sidebar text-sidebar-foreground transition-all duration-300 flex-col fixed right-0 top-0 z-[200] shadow-lg ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {/* Header with Logo - Fixed at Top */}
        <div className="p-4 border-b border-sidebar-border relative flex-shrink-0">
          {!isCollapsed ? (
            <>
              <button
                onClick={() => handleCollapse(true)}
                className="p-2 rounded-md hover:bg-sidebar-accent transition-colors absolute top-4 left-4 z-10 group"
                aria-label="طي القائمة"
              >
                <ChevronRight className="w-5 h-5 group-hover:text-sidebar-accent-foreground" />
              </button>
              <div className="flex flex-col items-center gap-3 w-full px-[7.5%] py-[0px]">
                <img src={logoImg} alt="Church Logo" className="w-full h-auto rounded-lg object-cover px-[15px] py-[0px]" />
                <div className="text-center w-full">
                  <h2 className="font-semibold leading-tight text-[20px]">خدمة الأرشيدياكون حبيب جرجس للداتا شو</h2>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 w-full">
              <img src={logoImg} alt="Church Logo" className="w-10 h-10 rounded-lg object-cover" />
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
        <nav className="flex-1 overflow-y-auto p-4">
          <ul className="space-y-2">
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              const isHidden = isSectionHidden(item.id);
              const canSeeHidden = userRole === 'editor' || userRole === 'admin';
              
              // Build className without nested template literals
              const baseClasses = 'w-full flex items-center gap-3 p-3 rounded-lg transition-colors';
              const activeClasses = activeSection === item.id
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'hover:bg-sidebar-hover text-sidebar-foreground/80 hover:text-sidebar-foreground';
              const hiddenClasses = (isHidden && canSeeHidden) ? 'opacity-70' : '';
              const buttonClasses = `${baseClasses} ${activeClasses} ${hiddenClasses}`;
              
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onSectionChange(item.id)}
                    className={buttonClasses}
                    title={item.label}
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    {!isCollapsed && (
                      <>
                        <span className="text-right flex-1">{item.label}</span>
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
            <div className="px-4 py-3 border-t border-sidebar-border">
              <button
                onClick={() => onSectionChange('about')}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
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
                    {isSectionHidden('about') && (userRole === 'editor' || userRole === 'admin') && (
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
          />

          {/* Footer with Theme Toggle */}
          {!isCollapsed ? (
            <div className="p-4 border-t border-sidebar-border flex items-center justify-between gap-2">
              <p className="text-xs text-sidebar-foreground/60 flex-1 text-center">© 2026 خدمة الارشدياكون حبيب جرجس</p>
              <CompactThemeToggle />
            </div>
          ) : (
            <div className="border-t border-sidebar-border flex flex-col items-center py-2">
              <CompactThemeToggle />
            </div>
          )}
        </div>
      </div>
    </>
  );
}