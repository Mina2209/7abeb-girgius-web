import { getApiBaseUrl } from '../config/api';

export type ApiErrorCode = string | undefined;

export class ApiError extends Error {
  status: number;
  code?: ApiErrorCode;
  details?: unknown;

  constructor(params: {
    status: number;
    message: string;
    code?: ApiErrorCode;
    details?: unknown;
  }) {
    super(params.message);
    this.name = 'ApiError';
    this.status = params.status;
    this.code = params.code;
    this.details = params.details;
  }
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function triggerSessionExpired() {
  // Any component (AuthContext) can listen and signOut.
  window.dispatchEvent(new Event('sessionExpired'));
}

export async function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(init?.headers);

  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  if (init?.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const token = localStorage.getItem('token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...init,
    headers,
  });
}

async function toApiError(res: Response): Promise<ApiError> {
  const text = await res.text().catch(() => '');
  const parsed = safeParseJson(text);

  const message =
    (typeof parsed === 'object' && parsed && 'error' in parsed && typeof (parsed as any).error === 'string'
      ? (parsed as any).error
      : typeof parsed === 'object' && parsed && 'message' in parsed && typeof (parsed as any).message === 'string'
      ? (parsed as any).message
      : text) || res.statusText;

  const code: ApiErrorCode =
    typeof parsed === 'object' && parsed && 'code' in parsed && typeof (parsed as any).code === 'string'
      ? (parsed as any).code
      : undefined;

  return new ApiError({
    status: res.status,
    message: message || `API ${res.status}`,
    code,
    details: parsed,
  });
}

export async function apiGetJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiRequest(path, init);
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      triggerSessionExpired();
    }

    throw await toApiError(res);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as Promise<T>;
}

export async function apiPostJson<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  return apiGetJson<T>(path, {
    ...init,
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

export async function apiPutJson<T>(path: string, body: unknown, init?: RequestInit): Promise<T> {
  return apiGetJson<T>(path, {
    ...init,
    method: 'PUT',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

export async function apiDeleteJson<T>(path: string, init?: RequestInit): Promise<T> {
  return apiGetJson<T>(path, {
    ...init,
    method: 'DELETE',
  });
}

