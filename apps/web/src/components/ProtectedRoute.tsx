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
  const { user, profile, isLoading } = useAuth();
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

  useEffect(() => {
    if (!isLoading && !user) {
      window.location.replace('/');
    }
  }, [isLoading, user]);

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

  // Loading spinner during initial session verification
  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-3 border-secondary/30 border-t-secondary rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium text-on-surface-variant">Verifying authenticated session...</p>
      </div>
    );
  }

  // Unauthenticated: directly redirect to home page, rendering nothing in between
  if (!user) {
    return null;
  }

  // Unauthorized role: immediately route to home/target without intermediate error screen
  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return null;
  }

  return <>{children}</>;
}
