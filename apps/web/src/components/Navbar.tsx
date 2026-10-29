'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface NavbarProps {
  userRole?: string;
  userName?: string;
  userEmail?: string;
}

export function Navbar({ userRole, userName, userEmail }: NavbarProps) {
  const pathname = usePathname();
  const isHomePage = pathname === '/';
  const { user, profile, isLoading, signInWithGoogle, signOut } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Derive active display values from Supabase profile or props fallback
  const isSoleAdmin = user?.email?.toLowerCase() === 'yeritti2017@gmail.com' || profile?.role === 'admin';
  const effectiveRole = isSoleAdmin ? 'ADMIN' : (profile?.role || userRole || (user ? 'Student' : 'Guest')).toUpperCase();
  const effectiveName = profile?.fullName || userName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const effectiveEmail = profile?.email || userEmail || user?.email || '';
  const effectiveAvatar = profile?.avatarUrl || user?.user_metadata?.avatar_url;

  const handleGoogleSignIn = async () => {
    try {
      setIsSigningIn(true);
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign-in failed:', err);
      setIsSigningIn(false);
    }
  };

  const dashboardTarget =
    isSoleAdmin
      ? '/admin/dashboard'
      : profile?.role === 'instructor'
      ? '/instructor/dashboard'
      : '/student/dashboard';

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-surface/85 backdrop-blur-xl pt-safe shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-surface-container-high/60">
      <div className="h-16 px-3 sm:px-4 md:px-8 max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand & Identity */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary-container text-white flex items-center justify-center font-mono font-bold text-xs sm:text-sm shadow-sm flex-shrink-0">
              FA
            </div>
            <span className="font-semibold text-base sm:text-lg text-on-surface tracking-tight">FocusAssess</span>
          </Link>

          {/* Role badge ONLY inside authenticated dashboard pages, NEVER on home page */}
          {!isHomePage && user && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface-container-high text-secondary text-[10px] sm:text-xs uppercase font-mono font-semibold tracking-wide flex-shrink-0">
              {effectiveRole}
            </span>
          )}

          <div className="hidden sm:flex items-center gap-1.5 pl-2 border-l border-surface-container-high">
            <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse" />
            <span className="font-mono text-xs text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-on-tertiary-container">verified_user</span>
              SECURE KERNEL
            </span>
          </div>
        </div>

        {/* User Navigation Links & Profile */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <Link
            href="/rules"
            className="text-xs text-on-surface-variant hover:text-on-surface hidden md:inline-flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">gavel</span>
            Integrity Rules
          </Link>

          {/* ON HOME PAGE: Zero user name, zero avatar, zero role pill, zero logout icon */}
          {isHomePage ? (
            <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-surface-container-high">
              {user ? (
                <Link
                  href={dashboardTarget}
                  className="h-9 px-3 sm:px-4 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-slate-800 transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <span><span className="hidden xs:inline">Go to </span>Dashboard</span>
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              ) : (
                <button
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn || isLoading}
                  className="h-9 px-2.5 sm:px-3.5 rounded-xl bg-surface-container-low hover:bg-surface-container border border-surface-container-high text-xs font-semibold text-on-surface flex items-center gap-1.5 sm:gap-2 shadow-sm transition-all active:scale-[0.98] disabled:opacity-60"
                >
                  {isSigningIn ? (
                    <span className="material-symbols-outlined text-[16px] animate-spin">refresh</span>
                  ) : (
                    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
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
                  )}
                  <span><span className="hidden xs:inline">Sign in with </span>Google</span>
                </button>
              )}
            </div>
          ) : (
            /* INSIDE AUTHENTICATED DASHBOARDS: Show user profile, name, avatar, and logout icon */
            user && (
              <div className="flex items-center gap-2 pl-2 border-l border-surface-container-high">
                {effectiveAvatar ? (
                  <img
                    src={effectiveAvatar}
                    alt={effectiveName}
                    className="w-8 h-8 rounded-full border border-surface-container-high object-cover shadow-sm"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-container text-white flex items-center justify-center text-xs font-bold uppercase shadow-sm">
                    {effectiveName.slice(0, 2)}
                  </div>
                )}
                <div className="hidden lg:flex flex-col text-left">
                  <span className="text-xs font-medium text-on-surface leading-tight">{effectiveName}</span>
                  <span className="text-[10px] text-on-surface-variant font-mono truncate max-w-[140px]">{effectiveEmail}</span>
                </div>
                <button
                  onClick={signOut}
                  title="Sign out of FocusAssess"
                  className="ml-1 p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-surface-container transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">logout</span>
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </header>
  );
}
