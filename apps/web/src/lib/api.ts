import { createClient } from './supabase';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export async function fetchWithAuth<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  let token: string | null = null;

  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || null;
  } catch (err) {
    // If Supabase is offline or running locally in dev/mock mode
  }

  // Fallback for development/testing if custom token is set in sessionStorage
  if (!token && typeof window !== 'undefined') {
    token = sessionStorage.getItem('pyassess_dev_token') || 'test-token-student-1:student:student1@astu.edu.et';
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMessage = data?.error || `Request failed with status ${res.status}`;
    const error: any = new Error(errorMessage);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data as T;
}
