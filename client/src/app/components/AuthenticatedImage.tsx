import { useState } from 'react';
import type { ImgHTMLAttributes, ReactNode } from 'react';
import { ImageOff } from 'lucide-react';
import { useAuthenticatedImageUrl } from '../hooks/useAuthenticatedImageUrl';

export interface AuthenticatedImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  src: string;
  requiresAuth: boolean;
  authToken: string | null;
  loadingFallback?: ReactNode;
  errorFallback?: ReactNode;
}

/**
 * Image element that can load protected uploads through the API bearer-token
 * flow. Published/public images keep using ordinary browser image loading.
 */
export function AuthenticatedImage({
  src,
  requiresAuth,
  authToken,
  loadingFallback,
  errorFallback,
  onError,
  ...imgProps
}: AuthenticatedImageProps) {
  const { url, loading, error } = useAuthenticatedImageUrl(src, {
    requiresAuth,
    authToken,
  });
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  if (!src) return null;
  if (loading) {
    return <>{loadingFallback ?? <span className="inline-block h-6 w-6 animate-pulse rounded bg-muted" />}</>;
  }
  if (error || (url && failedUrl === url)) {
    return (
      <>
        {errorFallback ?? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ImageOff className="h-4 w-4" aria-hidden="true" />
            تعذر تحميل الصورة
          </span>
        )}
      </>
    );
  }

  return (
    <img
      {...imgProps}
      src={url}
      onError={(event) => {
        setFailedUrl(url);
        onError?.(event);
      }}
    />
  );
}
