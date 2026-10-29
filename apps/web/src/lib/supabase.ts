import { createBrowserClient } from '@supabase/ssr';

let client: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (client) return client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://soykkihevqtugkzuxood.supabase.co';
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNveWtraWhldnF0dWdrenV4b29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxODQ2NjgsImV4cCI6MjEwMTc2MDY2OH0.NyCNZJHqH9mu4XEF6mGwlvFrPBSd_3h43rpHlhMs9O8';

  client = createBrowserClient(supabaseUrl, supabaseKey);
  return client;
}
