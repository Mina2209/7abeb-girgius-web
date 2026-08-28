/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_MEDIA_SERVER_URL?: string;
  readonly VITE_ANALYTICS_ENABLED?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
