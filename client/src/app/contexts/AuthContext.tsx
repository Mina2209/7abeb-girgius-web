import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { logLogin, logLogout } from '../utils/activityLogger';

/**
 * AuthContext - LocalStorage-Based Authentication System
 * 
 * This context provides authentication functionality using browser localStorage ONLY.
 * No external services (Supabase, Firebase, etc.) are used.
 * 
 * All user data is stored locally in the browser and will persist across sessions
 * but is device/browser-specific (no cloud sync).
 * 
 * Default Accounts:
 * - Admin: admin@church.com / admin123
 * - Editor: editor@church.com / editor123
 * - New users default to "Viewer" role
 */

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  church_name: string;
  church_role: string;
  services: string[];
  avatar_url: string | null;
  created_at: string;
  role: 'viewer' | 'editor' | 'admin'; // User permission level
}

interface AuthContextType {
  user: any | null;
  profile: UserProfile | null;
  accessToken: string | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, churchName: string, churchRole: string, services: string[]) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hard-coded admin and editor emails
const ADMIN_EMAILS = ['admin@church.com', 'admin@example.com', 'deacon@church.com'];
const EDITOR_EMAILS = ['editor@church.com']; // Add editor emails here if needed

// Helper function to determine role
function getUserRole(email: string): 'viewer' | 'editor' | 'admin' {
  if (ADMIN_EMAILS.includes(email.toLowerCase())) return 'admin';
  if (EDITOR_EMAILS.includes(email.toLowerCase())) return 'editor';
  return 'viewer';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize mock users on mount
  useEffect(() => {
    const initializeMockUsers = () => {
      const existingUsers = localStorage.getItem('all_users');
      if (!existingUsers) {
        const mockUsers: UserProfile[] = [
          // Admin
          {
            id: 'user-1',
            email: 'admin@church.com',
            full_name: 'الأب بطرس مينا',
            church_name: 'كنيسة السيدة العذراء',
            church_role: 'كاهن',
            services: ['خدمة الأعذار'],
            avatar_url: null,
            created_at: '2024-01-15T10:00:00.000Z',
            role: 'admin',
          },
          // Editors
          {
            id: 'user-2',
            email: 'editor1@church.com',
            full_name: 'مارك جرجس',
            church_name: 'كنيسة السيدة العذراء',
            church_role: 'خادم',
            services: ['خدمة الأعذار'],
            avatar_url: null,
            created_at: '2024-02-10T14:30:00.000Z',
            role: 'editor',
          },
          {
            id: 'user-3',
            email: 'editor2@church.com',
            full_name: 'مريم يوسف',
            church_name: 'كنيسة الشهيد مارجرجس',
            church_role: 'خادمة',
            services: ['خدمة الأعذار'],
            avatar_url: null,
            created_at: '2024-02-20T09:15:00.000Z',
            role: 'editor',
          },
          // Viewers
          {
            id: 'user-4',
            email: 'viewer1@church.com',
            full_name: 'يوحنا بولس',
            church_name: 'كنيسة السيدة العذراء',
            church_role: 'شماس',
            services: ['خدمة الأعذار'],
            avatar_url: null,
            created_at: '2024-03-01T16:45:00.000Z',
            role: 'viewer',
          },
          {
            id: 'user-5',
            email: 'viewer2@church.com',
            full_name: 'كيرلس انطون',
            church_name: 'كنيسة مارمرقس',
            church_role: 'أبونا',
            services: ['خدمة الأعذار'],
            avatar_url: null,
            created_at: '2024-03-05T11:20:00.000Z',
            role: 'viewer',
          },
        ];
        localStorage.setItem('all_users', JSON.stringify(mockUsers));
        console.log('✅ Mock users initialized');
      } else {
        // Migrate existing users from string to array format
        const users = JSON.parse(existingUsers);
        let needsMigration = false;
        
        const migratedUsers = users.map((user: any) => {
          if (typeof user.services === 'string') {
            needsMigration = true;
            return {
              ...user,
              services: user.services ? [user.services] : []
            };
          }
          return user;
        });
        
        if (needsMigration) {
          localStorage.setItem('all_users', JSON.stringify(migratedUsers));
          console.log('✅ Migrated users services to array format');
        }
      }
    };

    initializeMockUsers();
  }, []);

  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('mockUser');
    const savedProfile = localStorage.getItem('mockProfile');
    const savedToken = localStorage.getItem('mockToken');

    if (savedUser && savedProfile && savedToken) {
      setUser(JSON.parse(savedUser));
      const profile = JSON.parse(savedProfile);
      
      // Migrate services from string to array if needed
      if (typeof profile.services === 'string') {
        profile.services = profile.services ? [profile.services] : [];
        localStorage.setItem('mockProfile', JSON.stringify(profile));
      }
      
      setProfile(profile);
      setAccessToken(savedToken);
    }
    setLoading(false);
  }, []);

  const signUp = async (
    email: string,
    password: string,
    fullName: string,
    churchName: string,
    churchRole: string,
    services: string[]
  ) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const mockUser = {
      id: Date.now().toString(), // Unique ID
      email: email,
    };

    const mockProfile: UserProfile = {
      id: Date.now().toString(), // Unique ID
      email: email,
      full_name: fullName,
      church_name: churchName,
      church_role: churchRole,
      services: services,
      avatar_url: null,
      created_at: new Date().toISOString(),
      role: 'viewer', // Default role for new users
    };

    const mockToken = 'mock-token-' + Date.now();

    setUser(mockUser);
    setProfile(mockProfile);
    setAccessToken(mockToken);

    // Save to localStorage
    localStorage.setItem('mockUser', JSON.stringify(mockUser));
    localStorage.setItem('mockProfile', JSON.stringify(mockProfile));
    localStorage.setItem('mockToken', mockToken);

    // Add user to all_users list
    const allUsers = JSON.parse(localStorage.getItem('all_users') || '[]');
    if (!allUsers.find((u: UserProfile) => u.email === email)) {
      allUsers.push(mockProfile);
      localStorage.setItem('all_users', JSON.stringify(allUsers));
    }
  };

  const signIn = async (email: string, password: string) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if user exists in all_users list
    const allUsers = JSON.parse(localStorage.getItem('all_users') || '[]');
    const existingUser = allUsers.find((u: UserProfile) => u.email.toLowerCase() === email.toLowerCase());

    const mockUser = {
      id: existingUser?.id || '1',
      email: email,
    };

    // Use existing user profile or create new one
    const mockProfile: UserProfile = existingUser || {
      id: '1',
      email: email,
      full_name: getUserRole(email) === 'admin' ? 'مسؤول النظام' : 'مستخدم تجريبي',
      church_name: 'كنيسة السيدة العذراء',
      church_role: getUserRole(email) === 'admin' ? 'مسؤول' : 'خادم',
      services: ['خدمة الأعذار'],
      avatar_url: null,
      created_at: new Date().toISOString(),
      role: getUserRole(email),
    };

    const mockToken = 'mock-token-' + Date.now();

    setUser(mockUser);
    setProfile(mockProfile);
    setAccessToken(mockToken);

    // Save to localStorage
    localStorage.setItem('mockUser', JSON.stringify(mockUser));
    localStorage.setItem('mockProfile', JSON.stringify(mockProfile));
    localStorage.setItem('mockToken', mockToken);

    // Add mock favorites for testing
    const mockFavoriteHymns = [1, 2, 4];
    const mockFavoriteImages = [1, 3, 5, 8];
    const mockFavoriteSayings = [1, 3, 5, 7, 9];

    localStorage.setItem('favoriteHymns', JSON.stringify(mockFavoriteHymns));
    localStorage.setItem('favoriteImages', JSON.stringify(mockFavoriteImages));
    localStorage.setItem('favoriteSayings', JSON.stringify(mockFavoriteSayings));

    // Log login activity
    logLogin();
  };

  const signInWithGoogle = async () => {
    // Simulate OAuth delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const mockUser = {
      id: '1',
      email: 'user@gmail.com',
    };

    const mockProfile: UserProfile = {
      id: '1',
      email: 'user@gmail.com',
      full_name: 'Google User',
      church_name: 'كنيسة السيدة العذراء',
      church_role: 'خادم',
      services: ['خدمة الأعذار'],
      avatar_url: null,
      created_at: new Date().toISOString(),
      role: 'viewer', // Default role for new users
    };

    const mockToken = 'mock-token-google-' + Date.now();

    setUser(mockUser);
    setProfile(mockProfile);
    setAccessToken(mockToken);

    localStorage.setItem('mockUser', JSON.stringify(mockUser));
    localStorage.setItem('mockProfile', JSON.stringify(mockProfile));
    localStorage.setItem('mockToken', mockToken);

    // Add mock favorites for testing
    const mockFavoriteHymns = [1, 2, 4];
    const mockFavoriteImages = [1, 3, 5, 8];
    const mockFavoriteSayings = [1, 3, 5, 7, 9];

    localStorage.setItem('favoriteHymns', JSON.stringify(mockFavoriteHymns));
    localStorage.setItem('favoriteImages', JSON.stringify(mockFavoriteImages));
    localStorage.setItem('favoriteSayings', JSON.stringify(mockFavoriteSayings));

    // Log login activity
    logLogin();
  };

  const signInWithApple = async () => {
    // Simulate OAuth delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const mockUser = {
      id: '1',
      email: 'user@apple.com',
    };

    const mockProfile: UserProfile = {
      id: '1',
      email: 'user@apple.com',
      full_name: 'Apple User',
      church_name: 'كنيسة السيدة العذراء',
      church_role: 'خادم',
      services: ['خدمة الأعذار'],
      avatar_url: null,
      created_at: new Date().toISOString(),
      role: 'viewer', // Default role for new users
    };

    const mockToken = 'mock-token-apple-' + Date.now();

    setUser(mockUser);
    setProfile(mockProfile);
    setAccessToken(mockToken);

    localStorage.setItem('mockUser', JSON.stringify(mockUser));
    localStorage.setItem('mockProfile', JSON.stringify(mockProfile));
    localStorage.setItem('mockToken', mockToken);

    // Add mock favorites for testing
    const mockFavoriteHymns = [1, 2, 4];
    const mockFavoriteImages = [1, 3, 5, 8];
    const mockFavoriteSayings = [1, 3, 5, 7, 9];

    localStorage.setItem('favoriteHymns', JSON.stringify(mockFavoriteHymns));
    localStorage.setItem('favoriteImages', JSON.stringify(mockFavoriteImages));
    localStorage.setItem('favoriteSayings', JSON.stringify(mockFavoriteSayings));

    // Log login activity
    logLogin();
  };

  const signOut = async () => {
    // Log logout activity BEFORE clearing profile
    logLogout();
    
    setUser(null);
    setProfile(null);
    setAccessToken(null);

    localStorage.removeItem('mockUser');
    localStorage.removeItem('mockProfile');
    localStorage.removeItem('mockToken');
  };

  const refreshProfile = async () => {
    // Mock refresh - just reload from localStorage
    const savedProfile = localStorage.getItem('mockProfile');
    if (savedProfile) {
      setProfile(JSON.parse(savedProfile));
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        accessToken,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        signInWithApple,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // During hot reload, return a default context instead of throwing
    console.warn('useAuth called outside AuthProvider - using defaults');
    return {
      user: null,
      profile: null,
      accessToken: null,
      loading: false,
      signUp: async () => {},
      signIn: async () => {},
      signInWithGoogle: async () => {},
      signInWithApple: async () => {},
      signOut: async () => {},
      refreshProfile: async () => {},
    };
  }
  return context;
}