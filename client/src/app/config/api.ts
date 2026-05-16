export function getApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL ?? '').trim();
  return raw.replace(/\/$/, '');
}

export function isApiConfigured(): boolean {
  return getApiBaseUrl().length > 0;
}
