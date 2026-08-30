import { createContext, useContext, useState, useEffect, useMemo, useCallback, type ReactNode } from 'react';
import { apiGetJson } from '../services/apiClient';
import { useAuth } from './AuthContext';

/**
 * SectionsVisibilityContext - shared site section visibility.
 *
 * Loads `site_sections_visibility` from the server once and exposes a
 * role-aware `isSectionVisible(sectionId)`: admin/editor always see every
 * section, viewers only see sections that are publicly visible. This lets the
 * whole app (sidebar, routes, favorites, ...) react consistently when an admin
 * hides a library (e.g. books) from visitors.
 */

interface SectionsVisibilityContextType {
  visibility: Record<string, boolean>;
  isSectionVisible: (sectionId: string) => boolean;
  isSectionHidden: (sectionId: string) => boolean;
  loaded: boolean;
}

const SectionsVisibilityContext = createContext<SectionsVisibilityContextType | undefined>(undefined);

export function SectionsVisibilityProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [visibility, setVisibility] = useState<Record<string, boolean>>({});
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await apiGetJson<{ settings?: { site_sections_visibility?: Record<string, boolean> } }>(
        '/api/auth/settings/site',
        { method: 'GET' },
      );
      setVisibility(data?.settings?.site_sections_visibility ?? {});
    } catch {
      const saved = localStorage.getItem('site_sections_visibility');
      if (saved) {
        try {
          setVisibility(JSON.parse(saved));
        } catch {
          setVisibility({});
        }
      }
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      await load();
      if (cancelled) return;
      setLoaded(true);
    };
    run();

    const handleVisibilityChange = () => {
      load();
    };
    const handleUserChange = () => {
      load();
    };

    window.addEventListener('sectionsVisibilityChanged', handleVisibilityChange);
    window.addEventListener('userChanged', handleUserChange);
    window.addEventListener('storage', handleUserChange);

    return () => {
      cancelled = true;
      window.removeEventListener('sectionsVisibilityChanged', handleVisibilityChange);
      window.removeEventListener('userChanged', handleUserChange);
      window.removeEventListener('storage', handleUserChange);
    };
  }, [load]);

  const role = profile?.role ?? 'viewer';
  const isStaff = role === 'admin' || role === 'editor';

  const isSectionVisible = useCallback(
    (sectionId: string): boolean => {
      if (isStaff) return true;
      return visibility[sectionId] ?? true;
    },
    [isStaff, visibility],
  );

  const isSectionHidden = useCallback(
    (sectionId: string): boolean => {
      return !(visibility[sectionId] ?? true);
    },
    [visibility],
  );

  const value = useMemo<SectionsVisibilityContextType>(
    () => ({ visibility, isSectionVisible, isSectionHidden, loaded }),
    [visibility, isSectionVisible, isSectionHidden, loaded],
  );

  return (
    <SectionsVisibilityContext.Provider value={value}>
      {children}
    </SectionsVisibilityContext.Provider>
  );
}

export function useSectionsVisibility(): SectionsVisibilityContextType {
  const context = useContext(SectionsVisibilityContext);
  if (context === undefined) {
    console.warn('useSectionsVisibility called outside SectionsVisibilityProvider');
    return {
      visibility: {},
      isSectionVisible: () => true,
      isSectionHidden: () => false,
      loaded: false,
    };
  }
  return context;
}
