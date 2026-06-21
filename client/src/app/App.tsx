import { useState, useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { ChurchSidebar } from './components/ChurchSidebar';
import { HomeSection } from './components/HomeSection';
import { LiturgySection } from './components/LiturgySection';
import { HymnsSection } from './components/HymnsSection';
import { VariousSection } from './components/VariousSection';
import { ImageLibrarySection } from './components/ImageLibrarySection';
import { BooksSection } from './components/BooksSection';
import { SayingsSection } from './components/SayingsSection';
import { CopticLanguageSection } from './components/CopticLanguageSection';
import { AboutSection } from './components/AboutSection';
import { AuthProvider } from './contexts/AuthContext';
import { LoginModal } from './components/LoginModal';
import { SignupModal } from './components/SignupModal';
import { ProfilePage } from './components/ProfilePage';
import { FavoritesPage } from './components/FavoritesPage';
import { UserManagementPage } from './components/UserManagementPage';
import { TopicsManagementPage } from './components/TopicsManagementPage';
import { SiteSettingsPage } from './components/SiteSettingsPage';

const sectionToPath: Record<string, string> = {
  home: '/',
  liturgy: '/liturgy',
  hymns: '/hymns',
  various: '/various',
  images: '/images',
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

  // تأثير جلب وتحديث عنوان الـ Tab بناءً على المسار الحالي بدقة
  useEffect(() => {
    const pageTitles: Record<string, string> = {
      '/': ' خدمة الأرشيدياكون حبيب جرجس',
      '/liturgy': 'بوربوينت الليتورجية',
      '/hymns': 'مكتبة الترانيم',
      '/various': 'بوربوينت متنوعة',
      '/images': 'مكتبة الصور',
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

    // جلب الاسم المطابق للمسار الحالي، وفي حال عدم وجوده نضع اسماً افتراضياً
    const currentTitle = pageTitles[location.pathname] || 'لوحة التحكم';
    
    // تحديث عنوان المتصفح فوراً
    document.title = `${currentTitle}`;
  }, [location.pathname]); // يشتغل تلقائياً مع كل حركة انتقال أو ضغطة زرار تغير الـ URL

  return (
    <AuthProvider>
      <div className="flex h-screen bg-background" dir="rtl">
        <ChurchSidebar
          activeSection={activeSection}
          onSectionChange={(section) => {
            const path = sectionToPath[section];
            if (path) {
              navigate(path);
            }
          }}
          onCollapseChange={setIsSidebarCollapsed}
          onOpenLogin={() => setIsLoginModalOpen(true)}
          onNavigateToProfile={() => navigate('/profile')}
          onNavigateToFavorites={() => navigate('/favorites')}
          onNavigateToUserManagement={() => navigate('/admin/users')}
          onNavigateToTopicsManagement={() => navigate('/admin/topics')}
          onNavigateToSiteSettings={() => navigate('/admin/settings')}
        />
        <main className={`flex-1 p-8 h-screen overflow-y-auto pt-20 lg:pt-8 transition-all duration-300 ${
          isSidebarCollapsed ? 'lg:mr-20' : 'lg:mr-64'
        }`}>
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
            <Route path="/books" element={<BooksSection />} />
            <Route path="/sayings" element={<SayingsSection />} />
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