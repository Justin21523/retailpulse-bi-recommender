// API client — 所有 HTTP 請求都從這裡走
// Use the deployed base path when the app is mounted below /p/<project>.
import { publicPath } from './paths';

const API_BASE = publicPath('/api');

export function buildApiUrl(path: string, params?: Record<string, string | number | undefined>): string {
  let url = `${API_BASE}${path}`;
  if (params) {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
    });
    const q = sp.toString();
    if (q) url += `?${q}`;
  }
  return url;
}

export async function apiFetch<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const res = await fetch(buildApiUrl(path, params), {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${path} — ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function apiPostFile<T>(path: string, file: File): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(buildApiUrl(path), { method: 'POST', body: formData });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${path} — ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPostJSON<T>(path: string, body?: object): Promise<T> {
  const res = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${res.status}: ${path} — ${text}`);
  }
  return res.json() as Promise<T>;
}
