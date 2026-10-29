'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase';
import { fetchWithAuth, API_BASE_URL } from '@/lib/api';
import { UserRole, AccountStatus } from '@pyassess/shared';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  avatarUrl?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  profile: null,
  isLoading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

function createOptimisticProfile(user: User): UserProfile {
  const isInitialAdmin = user.email?.toLowerCase() === 'yeritti2017@gmail.com';
  const role: UserRole = isInitialAdmin
    ? 'admin'
    : ((user.user_metadata?.role as UserRole) || 'student');

  return {
    id: user.id,
    email: user.email || '',
    fullName:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'User',
    role,
    status: 'active',
    avatarUrl: user.user_metadata?.avatar_url || null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isFetchingRef = useRef(false);
  const lastFetchedUserIdRef = useRef<string | null>(null);

  const fetchProfile = useCallback(async (currentSession?: Session | null) => {
    const supabase = createClient();
    const activeSession = currentSession ?? (await supabase.auth.getSession()).data.session;
    const activeUser = activeSession?.user;
    if (!activeUser) {
      setProfile(null);
      lastFetchedUserIdRef.current = null;
      return;
    }

    if (isFetchingRef.current || lastFetchedUserIdRef.current === activeUser.id) {
      return;
    }

    isFetchingRef.current = true;
    lastFetchedUserIdRef.current = activeUser.id; // Lock immediately to prevent race conditions

    try {
      const token = activeSession.access_token;
      const res = await fetchWithAuth<{ user: UserProfile }>('/auth/me', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res && res.user) {
        if (res.user.email?.toLowerCase() === 'yeritti2017@gmail.com') {
          res.user.role = 'admin';
        }
        setProfile(res.user);
      }
    } catch (err) {
      console.warn('[AuthContext] Could not fetch server user profile:', err);
      setProfile((prev) => prev || createOptimisticProfile(activeUser));
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();

    async function initializeAuth() {
      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (initialSession?.user) {
          setSession(initialSession);
          setUser(initialSession.user);
          setProfile(createOptimisticProfile(initialSession.user));
          // Immediate unblock: UI never hangs waiting on network calls
          setIsLoading(false);

          // Asynchronously sync authoritative DB profile in background
          fetchProfile(initialSession);
        } else {
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('[AuthContext] Initialization error:', err);
        if (mounted) setIsLoading(false);
      }
    }

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || !newSession?.user) {
        setSession(null);
        setUser(null);
        setProfile(null);
        lastFetchedUserIdRef.current = null;
        setIsLoading(false);
        return;
      }

      setSession(newSession);
      setUser(newSession.user);
      setProfile((prev) => (prev?.id === newSession.user.id ? prev : createOptimisticProfile(newSession.user)));
      setIsLoading(false);

      // Asynchronously fetch profile if new user
      if (lastFetchedUserIdRef.current !== newSession.user.id) {
        fetchProfile(newSession);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signInWithGoogle = async (redirectTo?: string) => {
    const supabase = createClient();
    const callbackUrl = `${window.location.origin}/auth/callback${
      redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : ''
    }`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: callbackUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      console.error('[Google Sign-In Error]', error);
      throw error;
    }
  };

  const signOut = async () => {
    const token = session?.access_token;

    // 1. Immediately & synchronously wipe all client storage, auth tokens, and cookies
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.clear();

        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.startsWith('sb-') ||
              key.startsWith('pyassess_') ||
              key.includes('auth') ||
              key.includes('token'))
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => localStorage.removeItem(key));

        document.cookie.split(';').forEach((cookie) => {
          const eqPos = cookie.indexOf('=');
          const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
          if (name.startsWith('sb-') || name.includes('auth') || name.includes('token')) {
            document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;max-age=0;`;
          }
        });
      } catch (err) {
        console.warn('[SignOut] Storage cleanup error:', err);
      }
    }

    // 2. Dispatch server session revocation & Supabase sign-out in background (keepalive ensures delivery during page transition)
    if (token) {
      try {
        fetch(`${API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          keepalive: true,
        }).catch(() => {});
      } catch {
        // Ignore background fetch error
      }
    }

    try {
      const supabase = createClient();
      supabase.auth.signOut({ scope: 'global' }).catch(() => {});
    } catch {
      // Ignore background supabase error
    }

    // 3. Clear all React auth state
    setUser(null);
    setSession(null);
    setProfile(null);
    lastFetchedUserIdRef.current = null;

    // 4. Directly replace location with root homepage — nothing in between
    if (typeof window !== 'undefined') {
      window.location.replace('/');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        isLoading,
        signInWithGoogle,
        signOut,
        refreshProfile: () => fetchProfile(session),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
