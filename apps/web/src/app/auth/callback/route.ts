import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabaseServer';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/student/dashboard';

  if (code) {
    try {
      const supabase = createServerSupabaseClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL(next, requestUrl.origin));
      }
      console.error('[Supabase Auth Callback Error]', error);
    } catch (err) {
      console.error('[Supabase Auth Callback Exception]', err);
    }
  }

  // Fallback if exchange fails or no code
  return NextResponse.redirect(new URL('/?auth_error=unable_to_authenticate', requestUrl.origin));
}
