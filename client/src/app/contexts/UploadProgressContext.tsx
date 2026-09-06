import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';

export type UploadStatus = 'uploading' | 'success' | 'error';

export interface UploadProgressItem {
  id: number;
  fileName: string;
  progress: number;
  status: UploadStatus;
  error?: string;
}

interface UploadProgressContextValue {
  uploads: UploadProgressItem[];
  startUpload: (fileName: string) => number;
  updateProgress: (id: number, loaded: number, total: number) => void;
  completeUpload: (id: number) => void;
  failUpload: (id: number, error: string) => void;
  dismissUpload: (id: number) => void;
}

const UploadProgressContext = createContext<UploadProgressContextValue | null>(null);

export function UploadProgressProvider({ children }: { children: ReactNode }) {
  const [uploads, setUploads] = useState<UploadProgressItem[]>([]);
  const nextIdRef = useRef(1);
  const successTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const settleSuccess = useCallback((id: number) => {
    const timer = successTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      successTimersRef.current.delete(id);
    }
  }, []);

  const startUpload = useCallback((fileName: string) => {
    const id = nextIdRef.current++;
    setUploads((prev) => [
      ...prev,
      { id, fileName, progress: 0, status: 'uploading' as const },
    ]);
    return id;
  }, []);

  const updateProgress = useCallback((id: number, loaded: number, total: number) => {
    setUploads((prev) =>
      prev.map((u) =>
        u.id === id
          ? {
              ...u,
              progress: total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : u.progress,
            }
          : u,
      ),
    );
  }, []);

  const completeUpload = useCallback(
    (id: number) => {
      setUploads((prev) =>
        prev.map((u) => (u.id === id ? { ...u, progress: 100, status: 'success' } : u)),
      );
      settleSuccess(id);
      const timer = setTimeout(() => {
        setUploads((prev) => prev.filter((u) => u.id !== id));
        successTimersRef.current.delete(id);
      }, 5000);
      successTimersRef.current.set(id, timer);
    },
    [settleSuccess],
  );

  const failUpload = useCallback((id: number, error: string) => {
    settleSuccess(id);
    setUploads((prev) =>
      prev.map((u) => (u.id === id ? { ...u, status: 'error', error } : u)),
    );
  }, [settleSuccess]);

  const dismissUpload = useCallback((id: number) => {
    settleSuccess(id);
    setUploads((prev) => prev.filter((u) => u.id !== id));
  }, [settleSuccess]);

  return (
    <UploadProgressContext.Provider
      value={{ uploads, startUpload, updateProgress, completeUpload, failUpload, dismissUpload }}
    >
      {children}
    </UploadProgressContext.Provider>
  );
}

export function useUploadProgress(): UploadProgressContextValue {
  const ctx = useContext(UploadProgressContext);
  if (!ctx) {
    throw new Error('useUploadProgress must be used within an UploadProgressProvider');
  }
  return ctx;
}