import { createClient } from './supabase';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function fetchWithAuth<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const customHeaders = (options.headers as Record<string, string>) || {};
  let token = customHeaders['Authorization']?.replace(/^Bearer\s+/i, '') ||
              customHeaders['authorization']?.replace(/^Bearer\s+/i, '') || null;

  if (!token) {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      token = data?.session?.access_token || null;
    } catch (err) {
      // If Supabase is offline or running locally in dev/mock mode
    }

    // Fallback for development/testing if custom token is set in sessionStorage
    if (!token && typeof window !== 'undefined') {
      token = sessionStorage.getItem('pyassess_dev_token') || null;
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  // Add 10-second timeout to prevent infinite hanging
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: options.signal || controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMessage = data?.error || `Request failed with status ${res.status}`;
      const error: any = new Error(errorMessage);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data as T;
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      const timeoutError: any = new Error(`Request timed out for endpoint: ${endpoint}`);
      timeoutError.status = 408;
      throw timeoutError;
    }
    throw err;
  }
}
