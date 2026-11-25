// In-memory token store (never persisted in localStorage/sessionStorage)
let customerBearerToken: string | null = null;
let adminBearerToken: string | null = null;

export function setCustomerToken(token: string | null): void {
  customerBearerToken = token;
}

export function getCustomerToken(): string | null {
  return customerBearerToken;
}

export function setAdminToken(token: string | null): void {
  adminBearerToken = token;
}

export function getAdminToken(): string | null {
  return adminBearerToken;
}

export async function apiRequest<T = any>(
  path: string,
  options: RequestInit & { authMode?: 'customer' | 'admin' | 'none' } = {}
): Promise<T> {
  const { authMode = 'customer', headers, ...rest } = options;
  const reqHeaders = new Headers(headers || {});
  if (!reqHeaders.has('Content-Type') && rest.body && !(rest.body instanceof FormData)) {
    reqHeaders.set('Content-Type', 'application/json');
  }

  if (authMode === 'admin' && adminBearerToken) {
    reqHeaders.set('Authorization', `Bearer ${adminBearerToken}`);
  } else if (authMode === 'customer' && customerBearerToken) {
    reqHeaders.set('Authorization', `Bearer ${customerBearerToken}`);
  }

  const res = await fetch(path, { ...rest, headers: reqHeaders });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

export async function uploadImageFile(
  file: File,
  mode: 'customer' | 'admin' | 'register' = 'customer'
): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  if (mode === 'register') {
    const res = await apiRequest<{ url: string }>('/api/auth/register-avatar', {
      method: 'POST',
      authMode: 'none',
      body: JSON.stringify({ dataUrl }),
    });
    return res.url;
  }
  const res = await apiRequest<{ url: string }>('/api/uploads', {
    method: 'POST',
    authMode: mode,
    body: JSON.stringify({ dataUrl }),
  });
  return res.url;
}
