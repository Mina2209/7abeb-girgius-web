import { Suspense, useEffect, useMemo, useState, lazy } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { ChurchSidebar } from './components/ChurchSidebar';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from './components/ui/sonner';

const HomeSection = lazy(() => import('./components/HomeSection').then((m) => ({ default: m.HomeSection })));
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

const LoginModal = lazy(() => import('./components/LoginModal').then((m) => ({ default: m.LoginModal })));
const SignupModal = lazy(() => import('./components/SignupModal').then((m) => ({ default: m.SignupModal })));


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

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);

  useEffect(() => {
    const pageTitles: Record<string, string> = {
      '/': ' خدمة الأرشيدياكون حبيب جرجس',
      '/liturgy': 'بوربوينت الليتورجية',
      '/hymns': 'مكتبة الترانيم',
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
    };

    document.title = pageTitles[location.pathname] || 'لوحة التحكم';
  }, [location.pathname]);

  return (
    <AuthProvider>
      <Toaster />
      <div className="flex h-screen bg-background" dir="rtl">
        <ChurchSidebar
          activeSection={activeSection}
          onSectionChange={(section) => {
            const path = sectionToPath[section];
            if (path) navigate(path);
          }}
          onCollapseChange={setIsSidebarCollapsed}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onNavigateToProfile={() => navigate('/profile')}
          onNavigateToFavorites={() => navigate('/favorites')}
          onNavigateToUserManagement={() => navigate('/admin/users')}
          onNavigateToTopicsManagement={() => navigate('/admin/topics')}
          onNavigateToSiteSettings={() => navigate('/admin/settings')}
        />

        <main
          className={`flex-1 p-4 lg:p-8 h-screen overflow-y-auto pt-20 lg:pt-8 transition-all duration-300 ${
            isSidebarCollapsed ? 'lg:mr-20' : 'lg:mr-64'
          }`}
        >
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
                element={<HymnsSection isSidebarCollapsed={isSidebarCollapsed} />}
              />
              <Route path="/various" element={<VariousSection />} />
              <Route
                path="/images"
                element={<ImageLibrarySection isSidebarCollapsed={isSidebarCollapsed} />}
              />
              <Route path="/artists" element={<ArtistsSection />} />
              <Route path="/artists/:id" element={<ArtistDetailPage />} />
              <Route path="/books" element={<BooksSection />} />
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
              <Route path="*" element={<HomeSection />} />
            </Routes>
          </Suspense>
        </main>
      </div>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onSwitchToSignup={() => {
          setIsLoginModalOpen(false);
          setIsSignupModalOpen(true);
        }}
      />

      <SignupModal
        isOpen={isSignupModalOpen}
        onClose={() => setIsSignupModalOpen(false)}
        onSwitchToLogin={() => {
          setIsSignupModalOpen(false);
          setIsLoginModalOpen(true);
        }}
      />
    </AuthProvider>
  );
}

