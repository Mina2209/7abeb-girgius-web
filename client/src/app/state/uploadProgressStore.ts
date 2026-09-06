import { useSyncExternalStore } from 'react';

export type UploadStatus = 'uploading' | 'success' | 'error';

export interface UploadProgressItem {
  id: number;
  fileName: string;
  progress: number;
  status: UploadStatus;
  error?: string;
}

/**
 * Global upload progress store, callable from anywhere (services included) via
 * the exported imperative API, and subscribable from React via `useUploads()`.
 * Success entries auto-dismiss after a few seconds; error entries stay until
 * manually dismissed. Mirrors the module-level subscription pattern used by
 * sonner's `toast()` + `<Toaster />`.
 */
let uploads: UploadProgressItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const successTimers = new Map<number, ReturnType<typeof setTimeout>>();

function emit() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): UploadProgressItem[] {
  return uploads;
}

function setUploads(updater: (prev: UploadProgressItem[]) => UploadProgressItem[]) {
  const next = updater(uploads);
  if (next !== uploads) {
    uploads = next;
    emit();
  }
}

function clearSuccessTimer(id: number) {
  const timer = successTimers.get(id);
  if (timer) {
    clearTimeout(timer);
    successTimers.delete(id);
  }
}

export function startUpload(fileName: string): number {
  const id = nextId++;
  setUploads((prev) => [
    ...prev,
    { id, fileName, progress: 0, status: 'uploading' },
  ]);
  return id;
}

export function updateProgress(id: number, loaded: number, total: number) {
  setUploads((prev) =>
    prev.map((u) =>
      u.id === id
        ? {
            ...u,
            progress:
              total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : u.progress,
          }
        : u,
    ),
  );
}

export function completeUpload(id: number) {
  clearSuccessTimer(id);
  setUploads((prev) =>
    prev.map((u) => (u.id === id ? { ...u, progress: 100, status: 'success' } : u)),
  );
  const timer = setTimeout(() => {
    dismissUpload(id);
  }, 5000);
  successTimers.set(id, timer);
}

export function failUpload(id: number, error: string) {
  clearSuccessTimer(id);
  setUploads((prev) =>
    prev.map((u) => (u.id === id ? { ...u, status: 'error', error } : u)),
  );
}

export function dismissUpload(id: number) {
  clearSuccessTimer(id);
  setUploads((prev) => prev.filter((u) => u.id !== id));
}

export function useUploads(): UploadProgressItem[] {
  return useSyncExternalStore(subscribe, getSnapshot);
}