'use client';

import React, { useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@pyassess/shared';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, profile, isLoading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const rolesKey = useMemo(() => allowedRoles?.slice().sort().join(',') || '', [allowedRoles]);

  useEffect(() => {
    if (isLoading || !user || !profile || !allowedRoles) return;

    if (!allowedRoles.includes(profile.role)) {
      const target =
        profile.role === 'admin'
          ? '/admin/dashboard'
          : profile.role === 'instructor'
          ? '/instructor/dashboard'
          : '/student/dashboard';

      if (pathname !== target) {
        router.replace(target);
      }
    }
  }, [user, profile, isLoading, rolesKey, pathname, router]);

  // Protect against bfcache (Back/Forward browser cache) displaying protected view after logout
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted && !user) {
        window.location.replace('/');
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [user]);

  // Loading spinner during session verification
  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-secondary/30 border-t-secondary rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-on-surface-variant">Verifying authenticated session...</p>
      </div>
    );
  }

  // Unauthenticated fallback prompt
  if (!user) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 text-center">
        <div className="max-w-md w-full bg-surface-container-lowest p-8 rounded-2xl border border-surface-container-high shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-xl bg-error-container/40 text-error flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[28px]">lock</span>
          </div>
          <h2 className="text-xl font-bold text-on-surface">Authentication Required</h2>
          <p className="text-sm text-on-surface-variant">
            You must be registered and signed in with your Google account to access this portal.
          </p>
          <button
            onClick={() => signInWithGoogle(pathname || '/student/dashboard')}
            className="w-full h-11 rounded-xl bg-primary text-white font-medium text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>
        </div>
      </div>
    );
  }

  // Unauthorized role fallback
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 text-center">
        <div className="max-w-md w-full bg-surface-container-lowest p-8 rounded-2xl border border-surface-container-high shadow-sm space-y-4">
          <div className="w-12 h-12 rounded-xl bg-error-container/40 text-error flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[28px]">block</span>
          </div>
          <h2 className="text-xl font-bold text-on-surface">Access Restricted</h2>
          <p className="text-sm text-on-surface-variant">
            Your account ({profile.email}) is registered with role <span className="font-semibold uppercase">{profile.role}</span>, which is not authorized to view this portal.
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full h-11 rounded-xl bg-surface-container-high text-on-surface font-medium text-sm hover:bg-surface-container-highest transition-all"
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
