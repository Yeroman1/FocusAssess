import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next');

  if (code) {
    try {
      const supabase = createServerSupabaseClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data?.session) {
        const userEmail = data.session.user?.email?.toLowerCase();
        const isSoleAdmin = userEmail === 'yeritti2017@gmail.com';

        let destination = '/student/dashboard';

        if (isSoleAdmin) {
          destination = '/admin/dashboard';
        } else {
          // Query backend to resolve authoritative role (identifies teachers added by admin)
          try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
            const profileRes = await fetch(`${apiUrl}/auth/me`, {
              headers: { Authorization: `Bearer ${data.session.access_token}` },
              cache: 'no-store',
            });
            if (profileRes.ok) {
              const resData = await profileRes.json();
              if (resData?.user?.role === 'instructor') {
                destination = '/instructor/dashboard';
              } else if (resData?.user?.role === 'admin') {
                destination = '/admin/dashboard';
              }
            }
          } catch (err) {
            console.warn('[OAuth Callback] Role fetch fallback:', err);
          }
        }

        // If specific return destination requested (and user is not an unprivileged user trying to hit admin)
        if (next && next !== '/admin/dashboard') {
          destination = next;
        }

        return NextResponse.redirect(new URL(destination, requestUrl.origin));
      }

      console.error('[OAuth Callback Error]', error);
      return NextResponse.redirect(
        new URL(`/?auth_error=${encodeURIComponent(error?.message || 'Authentication exchange failed')}`, requestUrl.origin)
      );
    } catch (err: any) {
      console.error('[OAuth Callback Exception]', err);
      return NextResponse.redirect(
        new URL(`/?auth_error=${encodeURIComponent(err.message || 'Authentication error')}`, requestUrl.origin)
      );
    }
  }

  // Fallback if no code provided
  return NextResponse.redirect(new URL('/', requestUrl.origin));
}

