import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef, ReactNode } from 'react';
import { logLogin, logLogout } from '../utils/activityLogger';
import { isApiConfigured } from '../config/api';
import { apiGetJson } from '../services/apiClient';
import { trackEvent } from '../services/analytics';
import type { ClientUser, UserProfile } from '../types/auth';

/**
 * AuthContext - Production Authentication System
 * * المزامنة الكاملة مع سيرفر الـ Express وقاعدة البيانات
 * والاعتماد على الصلاحيات القادمة من السيرفر مباشرة.
 */

interface AuthContextType {
  user: ClientUser | null;
  profile: UserProfile | null;
  accessToken: string | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    fullName: string,
    churchName: string,
    churchRole: string,
    services: string[],
  ) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}


const AuthContext = createContext<AuthContextType | undefined>(undefined);

type ServerRole = 'ADMIN' | 'EDITOR' | 'USER' | 'VIEWER';
type LoginResponse = {
  token: string;
  user: {
    id: string;
    username: string;
    email?: string;
    role: ServerRole;
    full_name?: string;
    church_name?: string;
    church_role?: string;
    services?: string[];
    avatar_url?: string | null;
    created_at?: string;
  };
};

function notifyUserChanged() {
  window.dispatchEvent(new Event('userChanged'));
}

// تحويل الصلاحيات القادمة من السيرفر إلى الصلاحيات المتوقعة في الـ Frontend
function mapServerRoleToClient(role: ServerRole): 'viewer' | 'editor' | 'admin' {
  if (role === 'ADMIN') return 'admin';
  if (role === 'EDITOR') return 'editor';
  return 'viewer';
}

function normalizeLoginIdentifier(identifier: string): string {
  const value = identifier.trim();
  if (!value) return value;
  return value.includes('@') ? value.split('@')[0] : value;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ClientUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // جلب بيانات الجلسة الحالية عند تشغيل التطبيق لأول مرة
  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const savedProfile = localStorage.getItem('profile');
    const savedToken = localStorage.getItem('token');

    if (savedUser && savedProfile && savedToken) {
      try {
        const parsedUser = JSON.parse(savedUser);
        const parsedProfile = JSON.parse(savedProfile);
        if (typeof (parsedProfile as any).services === 'string') {
          (parsedProfile as any).services = (parsedProfile as any).services ? [(parsedProfile as any).services] : [];
        }
        setUser(parsedUser);
        setProfile(parsedProfile as UserProfile);
        setAccessToken(savedToken);
      } catch (e) {
        console.error('Error parsing saved session data', e);
      }
    }
    setLoading(false);
  }, []);

  // Session expiration handling (triggered from apiClient on 401/403)
  useEffect(() => {
    const handler = () => {
      // Don't rely on token being present; just wipe client session.
      logLogout();
      trackEvent('logout');
      setUser(null);
      setProfile(null);
      setAccessToken(null);
      localStorage.removeItem('user');
      localStorage.removeItem('profile');
      localStorage.removeItem('token');
      notifyUserChanged();
    };

    window.addEventListener('sessionExpired', handler);
    return () => window.removeEventListener('sessionExpired', handler);
  }, []);


  // دالة إنشاء حساب جديد وإرساله للسيرفر بالكامل
  const signUp = useCallback(async (
    email: string,
    password: string,
    fullName: string,
    churchName: string,
    churchRole: string,
    services: string[]
  ) => {
    if (!isApiConfigured()) {
      throw new Error('السيرفر غير مهيأ بالكامل، يرجى التحقق من متغيرات البيئة.');
    }

    const username = normalizeLoginIdentifier(email);

    // إرسال طلب POST حقيقي إلى روت التسجيل في السيرفر
    const result = await apiGetJson<LoginResponse>('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username,
        email,
        password,
        full_name: fullName,
        church_name: churchName,
        church_role: churchRole,
        services
      }),
    });

    // إذا كان السيرفر يقوم بتسجيل الدخول تلقائياً بعد الإنشاء ويرد بـ Token
    if (result && result.token) {
      const clientRole = mapServerRoleToClient(result.user.role);
      
      const serverUser = {
        id: result.user.id,
        email: result.user.email || email,
        username: result.user.username,
      };

      const serverProfile: UserProfile = {
        id: result.user.id,
        email: result.user.email || email,
        full_name: result.user.full_name || fullName,
        church_name: result.user.church_name || churchName,
        church_role: result.user.church_role || churchRole,
        services: result.user.services || services,
        avatar_url: result.user.avatar_url || null,
        created_at: result.user.created_at || new Date().toISOString(),
        role: clientRole,
      };

      setUser(serverUser);
      setProfile(serverProfile);
      setAccessToken(result.token);

      localStorage.setItem('user', JSON.stringify(serverUser));
      localStorage.setItem('profile', JSON.stringify(serverProfile));
      localStorage.setItem('token', result.token);
      notifyUserChanged();
      logLogin();
      trackEvent('login_success', { properties: { role: clientRole } });
    }
  }, []);

  // دالة تسجيل الدخول الحالية المربوطة بالسيرفر
  const signIn = useCallback(async (email: string, password: string) => {
    if (!isApiConfigured()) {
      throw new Error('VITE_API_BASE_URL is not configured.');
    }

    const username = normalizeLoginIdentifier(email);
    const result = await apiGetJson<LoginResponse>('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const role = mapServerRoleToClient(result.user.role);
    const normalizedEmail = email.includes('@') ? email : `${result.user.username}@church.com`;
    
    const serverUser = {
      id: result.user.id,
      email: normalizedEmail,
      username: result.user.username,
    };

    // استخدام البيانات القادمة من السيرفر بالكامل مع وضع قيم افتراضية آمنة لو لم تتوفر
    const serverProfile: UserProfile = {
      id: result.user.id,
      email: normalizedEmail,
      full_name: result.user.full_name || result.user.username,
      church_name: result.user.church_name || 'كنيسة السيدة العذراء',
      church_role: result.user.church_role || (role === 'admin' ? 'مسؤول' : 'خادم'),
      services: result.user.services || ['خدمة الأعذار'],
      avatar_url: result.user.avatar_url || null,
      created_at: result.user.created_at || new Date().toISOString(),
      role,
    };

    setUser(serverUser);
    setProfile(serverProfile);
    setAccessToken(result.token);

    // الحفظ في الـ LocalStorage بالأسماء الإنتاجية النظيفة والأسماء القديمة لضمان التوافقية مؤقتاً
    localStorage.setItem('user', JSON.stringify(serverUser));
    localStorage.setItem('profile', JSON.stringify(serverProfile));
    localStorage.setItem('token', result.token);
    


    notifyUserChanged();
    logLogin();
    trackEvent('login_success', { properties: { role } });
  }, []);

  // دوال الـ OAuth (يمكنك تركها مؤقتاً لحين بناء الروت الخاص بها في السيرفر أو دمجها)
  const signInWithGoogle = useCallback(async () => {
    console.warn('نظام تسجيل الدخول عبر Google يحتاج للربط مع روت السيرفر المستقبلي');
  }, []);

  const signInWithApple = useCallback(async () => {
    console.warn('نظام تسجيل الدخول عبر Apple يحتاج للربط مع روت السيرفر المستقبلي');
  }, []);

  // دالة تسجيل الخروج وتنظيف المتصفح بالكامل
  const signOut = useCallback(async () => {
    logLogout();
    trackEvent('logout');
    
    setUser(null);
    setProfile(null);
    setAccessToken(null);

    // تنظيف كافة البيانات
    localStorage.removeItem('user');
    localStorage.removeItem('profile');
    localStorage.removeItem('token');

    
    notifyUserChanged();
  }, []);

  // دالة تحديث بيانات المستخدم الحالية من السيرفر مباشرة للتأكد من الصلاحيات والبيانات الفريش
  const refreshProfile = useCallback(async () => {
    try {
      if (!accessToken) return;
      
      // طلب بيانات الملف الشخصي المحدثة من السيرفر
      const updatedProfile = await apiGetJson<UserProfile>('/api/auth/profile');
      
      if (updatedProfile) {
        setProfile(updatedProfile);
        localStorage.setItem('profile', JSON.stringify(updatedProfile));
        notifyUserChanged();
      }
    } catch (error) {
      console.error("فشل جلب الملف الشخصي المحدث من السيرفر:", error);
    }
  }, [accessToken]);

  const contextValue = useMemo(() => ({
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
  }), [user, profile, accessToken, loading, signUp, signIn, signInWithGoogle, signInWithApple, signOut, refreshProfile]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
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