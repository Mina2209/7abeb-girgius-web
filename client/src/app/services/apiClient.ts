import { getApiBaseUrl } from '../config/api';

export async function apiRequest(path: string, init?: RequestInit): Promise<Response> {
  const base = getApiBaseUrl();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  
  // 1. تجهيز الـ Headers الافتراضية
  const headers = new Headers(init?.headers);
  
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  // إذا كان الطلب يحتوي على body ولم يتم تحديد Content-Type (وليس FormData الخاص برفع الصور)
  if (init?.body && !headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  // 2. جلب الـ Token الحقيقي (أو الـ mockToken مؤقتاً) وحقنه تلقائياً في الـ Header
  const token = localStorage.getItem('mockToken') || localStorage.getItem('mockAccessToken');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(url, {
    ...init,
    headers,
  });
}

// دالة الـ GET الحالية التي قمت بكتابتها
export async function apiGetJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await apiRequest(path, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${text || res.statusText}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// 3. إضافة دالة مساعدة لطلبات الـ POST
export async function apiPostJson<T>(path: string, body: any, init?: RequestInit): Promise<T> {
  return apiGetJson<T>(path, {
    ...init,
    method: 'POST',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

// 4. إضافة دالة مساعدة لطلبات الـ PUT (للتعديل)
export async function apiPutJson<T>(path: string, body: any, init?: RequestInit): Promise<T> {
  return apiGetJson<T>(path, {
    ...init,
    method: 'PUT',
    body: body instanceof FormData ? body : JSON.stringify(body),
  });
}

// 5. إضافة دالة مساعدة لطلبات الـ DELETE (للحذف)
export async function apiDeleteJson<T>(path: string, init?: RequestInit): Promise<T> {
  return apiGetJson<T>(path, {
    ...init,
    method: 'DELETE',
  });
}