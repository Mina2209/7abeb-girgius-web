import { useAuth } from '../contexts/AuthContext';

/**
 * Hook to get the current user's role
 */
export function useUserRole(): 'viewer' | 'editor' | 'admin' | null {
  const { profile } = useAuth();
  return profile?.role || null;
}

/**
 * Hook to check if the current user is an Editor or Admin (can edit content)
 */
export function useIsEditor(): boolean {
  const { profile } = useAuth();
  return profile?.role === 'editor' || profile?.role === 'admin';
}

/**
 * Hook to check if the current user is an Admin (full access including user management)
 */
export function useIsAdmin(): boolean {
  const { profile } = useAuth();
  return profile?.role === 'admin';
}

/**
 * Check if an email belongs to an admin user (for backward compatibility)
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const ADMIN_EMAILS = ['admin@church.com', 'admin@example.com', 'deacon@church.com'];
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
