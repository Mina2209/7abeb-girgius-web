import { Suspense, useEffect, useState, useCallback, useRef, lazy, type ReactNode } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SectionsVisibilityProvider, useSectionsVisibility } from './contexts/SectionsVisibilityContext';
import { AnalyticsRouteTracker } from './components/AnalyticsRouteTracker';
import { HomeSection } from './components/HomeSection';

const LazyToaster = lazy(() =>
  import('./components/ui/sonner').then((m) => ({ default: m.Toaster })),
);

const ChurchSidebar = lazy(() =>
  import('./components/ChurchSidebar').then((m) => ({ default: m.ChurchSidebar })),
);

const LiturgySection = lazy(() => import('./components/LiturgySection').then((m) => ({ default: m.LiturgySection })));
const HymnsSection = lazy(() =>
  import('./components/HymnsSection').then((m) => ({ default: m.HymnsSection })),
);
const VariousSection = lazy(() =>
  import('./components/VariousSection').then((m) => ({ default: m.VariousSection })),
);
const ImageLibrarySection = lazy(() =>
  import('./components/ImageLibrarySection').then((m) => ({ default: m.ImageLibrarySection })),
);
const ArtistsSection = lazy(() =>
  import('./components/ArtistsSection').then((m) => ({ default: m.ArtistsSection })),
);
const ArtistDetailPage = lazy(() =>
  import('./components/ArtistDetailPage').then((m) => ({ default: m.ArtistDetailPage })),
);
const BooksSection = lazy(() =>
  import('./components/BooksSection').then((m) => ({ default: m.BooksSection })),
);
const SayingsSection = lazy(() =>
  import('./components/SayingsSection').then((m) => ({ default: m.SayingsSection })),
);
const FatherDetailPage = lazy(() =>
  import('./components/FatherDetailPage').then((m) => ({ default: m.FatherDetailPage })),
);
const CopticLanguageSection = lazy(() =>
  import('./components/CopticLanguageSection').then((m) => ({ default: m.CopticLanguageSection })),
);
const AboutSection = lazy(() =>
  import('./components/AboutSection').then((m) => ({ default: m.AboutSection })),
);
const ProfilePage = lazy(() =>
  import('./components/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const FavoritesPage = lazy(() =>
  import('./components/FavoritesPage').then((m) => ({ default: m.FavoritesPage })),
);
const UserManagementPage = lazy(() =>
  import('./components/UserManagementPage').then((m) => ({ default: m.UserManagementPage })),
);
const TopicsManagementPage = lazy(() =>
  import('./components/TopicsManagementPage').then((m) => ({ default: m.TopicsManagementPage })),
);
const SiteSettingsPage = lazy(() =>
  import('./components/SiteSettingsPage').then((m) => ({ default: m.SiteSettingsPage })),
);
const AnalyticsPage = lazy(() =>
  import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })),
);
const UserActivityPage = lazy(() =>
  import('./pages/UserActivityPage').then((m) => ({ default: m.UserActivityPage })),
);
const AdminExportPage = lazy(() =>
  import('./pages/AdminExportPage').then((m) => ({ default: m.AdminExportPage })),
);

const LoginModal = lazy(() => import('./components/LoginModal').then((m) => ({ default: m.LoginModal })));
const SignupModal = lazy(() => import('./components/SignupModal').then((m) => ({ default: m.SignupModal })));

const BioLinkPage = lazy(() =>
  import('./pages/BioLinkPage').then((m) => ({ default: m.BioLinkPage })),
);

const sectionToPath: Record<string, string> = {
  home: '/',
  liturgy: '/liturgy',
  hymns: '/hymns',
  various: '/various',
  images: '/images',
  artists: '/artists',
  books: '/books',
  sayings: '/sayings',
  coptic: '/coptic',
  about: '/about',
};

const pathToSection = (pathname: string): string => {
  switch (pathname) {
    case '/':
      return 'home';
    case '/liturgy':
      return 'liturgy';
    case '/hymns':
      return 'hymns';
    case '/various':
      return 'various';
    case '/images':
      return 'images';
    case '/artists':
      return 'artists';
    case '/books':
      return 'books';
    case '/sayings':
      return 'sayings';
    case '/coptic':
      return 'coptic';
    case '/about':
      return 'about';
    default:
      return 'home';
  }
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeSection = pathToSection(location.pathname);
  const isQrCodeRoute = location.pathname === '/qrcode';

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  const mainScrollContainerRef = useRef<HTMLElement>(null);
  const [deferredReady, setDeferredReady] = useState(false);

  useEffect(() => {
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(() => setDeferredReady(true), { timeout: 2000 });
    } else {
      const id = setTimeout(() => setDeferredReady(true), 0);
      return () => clearTimeout(id);
    }
  }, []);

  const handleSidebarSectionChange = useCallback((section: string) => {
    const path = sectionToPath[section];
    if (path) navigate(path);
  }, [navigate]);

  const handleOpenLogin = useCallback(() => setIsLoginModalOpen(true), []);

  useEffect(() => {
    const handler = () => setIsLoginModalOpen(true);
    window.addEventListener('openLoginModal', handler);
    return () => window.removeEventListener('openLoginModal', handler);
  }, []);
  const handleNavigateToProfile = useCallback(() => navigate('/profile'), [navigate]);
  const handleNavigateToFavorites = useCallback(() => navigate('/favorites'), [navigate]);
  const handleNavigateToUserManagement = useCallback(() => navigate('/admin/users'), [navigate]);
  const handleNavigateToTopicsManagement = useCallback(() => navigate('/admin/topics'), [navigate]);
  const handleNavigateToSiteSettings = useCallback(() => navigate('/admin/settings'), [navigate]);
  const handleNavigateToAnalytics = useCallback(() => navigate('/admin/analytics'), [navigate]);
  const handleNavigateToActivity = useCallback(() => navigate('/admin/activity'), [navigate]);
  const handleNavigateToExport = useCallback(() => navigate('/admin/export'), [navigate]);
  const handleCollapseChange = useCallback((collapsed: boolean) => setIsSidebarCollapsed(collapsed), []);
  useEffect(() => {
    const pageTitles: Record<string, string> = {
      '/': ' خدمة الأرشيدياكون حبيب جرجس',
      '/liturgy': 'بوربوينت الليتورجية',
      '/hymns': 'مكتبة الترانيم للعرض',
      '/various': 'بوربوينت متنوعة',
      '/images': 'مكتبة الصور',
      '/artists': 'الفنانون',
      '/books': 'مكتبة الكتب',
      '/sayings': 'أقوال أباء',
      '/coptic': 'لغة قبطية',
      '/about': 'عن الخدمة',
      '/profile': 'الملف الشخصي',
      '/favorites': 'المفضلة',
      '/admin/users': 'إدارة المستخدمين',
      '/admin/topics': 'إدارة الموضوعات',
      '/admin/settings': 'إعدادات الموقع',
      '/admin/analytics': 'الإحصائيات والتحليلات',
      '/admin/activity': 'سجل نشاط المستخدمين',
      '/admin/export': 'تصدير البيانات',
       '/qrcode': 'بطاقة خدمة الأرشيدياكون حبيب جرجس',
    };

    document.title = pageTitles[location.pathname] || 'لوحة التحكم';
  }, [location.pathname]);

  // Standalone digital business card route — rendered without the sidebar/main shell.
  if (isQrCodeRoute) {
    return (
      <AuthProvider>
        <SectionsVisibilityProvider>
          <AnalyticsRouteTracker />
          {deferredReady && (
            <Suspense fallback={null}>
              <LazyToaster />
            </Suspense>
          )}
          <Suspense fallback={null}>
            <Routes>
              <Route path="/qrcode" element={<BioLinkPage />} />
            </Routes>
          </Suspense>
        </SectionsVisibilityProvider>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <SectionsVisibilityProvider>
        <AnalyticsRouteTracker />
        {deferredReady && (
          <Suspense fallback={null}>
            <LazyToaster />
          </Suspense>
        )}
        <div className="flex h-screen bg-background overflow-x-hidden" dir="rtl">
        {deferredReady ? (
          <Suspense
            fallback={
              <div className="hidden lg:flex w-20 bg-sidebar" aria-hidden="true" />
            }
          >
            <ChurchSidebar
              activeSection={activeSection}
              onSectionChange={handleSidebarSectionChange}
              onCollapseChange={handleCollapseChange}
              onOpenLogin={handleOpenLogin}
              onNavigateToProfile={handleNavigateToProfile}
              onNavigateToFavorites={handleNavigateToFavorites}
              onNavigateToUserManagement={handleNavigateToUserManagement}
              onNavigateToTopicsManagement={handleNavigateToTopicsManagement}
              onNavigateToSiteSettings={handleNavigateToSiteSettings}
              onNavigateToAnalytics={handleNavigateToAnalytics}
              onNavigateToActivity={handleNavigateToActivity}
              onNavigateToExport={handleNavigateToExport}
            />
          </Suspense>
        ) : (
          <div className="hidden lg:block w-64 shrink-0" aria-hidden="true" />
        )}

        <main
          ref={mainScrollContainerRef}
          className={`flex-1 p-4 lg:p-8 h-screen overflow-y-auto pt-20 lg:pt-0 transition-all duration-300 ${
            isSidebarCollapsed ? 'lg:mr-20' : 'lg:mr-64'
          }`}
        >
          <div className="max-w-7xl mx-auto mt-[30px]">
          <Suspense
            fallback={
              <div className="w-full flex items-center justify-center py-10 text-muted-foreground">
                جاري التحميل...
              </div>
            }
          >
            <Routes>
              <Route path="/" element={<HomeSection />} />
              <Route path="/liturgy" element={<LiturgySection />} />
              <Route
                path="/hymns"
                element={<HymnsSection isSidebarCollapsed={isSidebarCollapsed} scrollContainerRef={mainScrollContainerRef} />}
              />
              <Route path="/various" element={<VariousSection />} />
              <Route
                path="/images"
                element={<ImageLibrarySection isSidebarCollapsed={isSidebarCollapsed} scrollContainerRef={mainScrollContainerRef} />}
              />
              <Route path="/artists" element={<ArtistsSection />} />
              <Route path="/artists/:id" element={<ArtistDetailPage />} />
              <Route
                path="/books"
                element={<SectionVisibilityGuard sectionId="books" fallback={<HomeSection />}><BooksSection /></SectionVisibilityGuard>}
              />
              <Route path="/sayings" element={<SayingsSection />} />
              <Route path="/sayings/authors/:id" element={<FatherDetailPage />} />
              <Route path="/coptic" element={<CopticLanguageSection />} />
              <Route path="/about" element={<AboutSection />} />
              <Route
                path="/profile"
                element={<ProfilePage onNavigateToFavorites={() => navigate('/favorites')} />}
              />
              <Route path="/favorites" element={<FavoritesPage />} />
              <Route path="/admin/users" element={<UserManagementPage />} />
              <Route path="/admin/topics" element={<TopicsManagementPage />} />
              <Route path="/admin/settings" element={<SiteSettingsPage />} />
              <Route path="/admin/analytics" element={<AnalyticsPage />} />
              <Route path="/admin/activity" element={<UserActivityPage />} />
              <Route path="/admin/export" element={<AdminExportPage />} />
              <Route path="*" element={<HomeSection />} />
            </Routes>
          </Suspense>
          </div>
        </main>

        {/* Lazy-load modals only when opened to reduce initial JS evaluation */}
        {(isLoginModalOpen || isSignupModalOpen) && (
          <Suspense fallback={null}>
            {isLoginModalOpen && (
              <LoginModal
                isOpen={isLoginModalOpen}
                onClose={() => setIsLoginModalOpen(false)}
                onSwitchToSignup={() => {
                  setIsLoginModalOpen(false);
                  setIsSignupModalOpen(true);
                }}
              />
            )}
            {isSignupModalOpen && (
              <SignupModal
                isOpen={isSignupModalOpen}
                onClose={() => setIsSignupModalOpen(false)}
                onSwitchToLogin={() => {
                  setIsSignupModalOpen(false);
                  setIsLoginModalOpen(true);
                }}
              />
            )}
          </Suspense>
        )}
      </div>
      </SectionsVisibilityProvider>
    </AuthProvider>
  );
}

// ---------------------------------------------------------------------------
// SectionVisibilityGuard
// Redirects visitors away from a section that an admin has hidden from the
// public site. Admins/editors always see every section (role-aware hook).
// ---------------------------------------------------------------------------

function SectionVisibilityGuard({
  sectionId,
  children,
  fallback,
}: {
  sectionId: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isSectionVisible, loaded } = useSectionsVisibility();
  const { loading: authLoading } = useAuth();

  if (authLoading || !loaded) {
    return null;
  }

  if (!isSectionVisible(sectionId)) {
    return <>{fallback ?? <HomeSection />}</>;
  }

  return <>{children}</>;
}


