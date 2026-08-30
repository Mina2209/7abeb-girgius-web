import { getApiBaseUrl } from '../config/api';

type ApiErrorCode = string | undefined;

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

// ---- Resilience: retry + throttling (Task 13) ----------------------------------
// GET requests are idempotent, so we safely retry them on transient failures
// (HTTP 429/502/503/504 or network errors) using exponential backoff with jitter.
// Mutations (POST/PUT/DELETE) are never retried to avoid double-submits.

const MIN_REQUEST_GAP_MS = 150;
const MAX_GET_RETRIES = 2;
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

let lastRequestAt = 0;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/** Ensure at least MIN_REQUEST_GAP_MS between outgoing requests (throttle). */
async function throttle() {
  const now = Date.now();
  const wait = MIN_REQUEST_GAP_MS - (now - lastRequestAt);
  if (wait > 0) {
    await sleep(wait);
  }
  lastRequestAt = Date.now();
}

function isRetryableStatus(status: number) {
  return RETRYABLE_STATUS.has(status);
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const isGet = method === 'GET';
  let attempt = 0;

  for (;;) {
    let res: Response | undefined;
    let networkError: unknown;

    try {
      res = await fetch(url, { ...init });
    } catch (err) {
      networkError = err;
    }

    const canRetry =
      isGet && attempt < MAX_GET_RETRIES && (networkError !== undefined || (res && isRetryableStatus(res.status)));

    if (!canRetry) {
      if (networkError !== undefined) throw networkError;
      return res as Response;
    }

    attempt += 1;
    const backoffMs = 400 * 2 ** (attempt - 1) + Math.round(Math.random() * 300);
    await sleep(backoffMs);
  }
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

  await throttle();

  return fetchWithRetry(url, {
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

