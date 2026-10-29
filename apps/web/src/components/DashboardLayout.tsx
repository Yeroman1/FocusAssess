'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@pyassess/shared';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  badge?: string | number;
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  portalRole?: UserRole;
  title?: string;
  subtitle?: string;
}

export function DashboardLayout({ children, portalRole, title, subtitle }: DashboardLayoutProps) {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentHash, setCurrentHash] = useState('');

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Sync currentHash from window location
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentHash(window.location.hash || '');
    }

    const updateHash = () => {
      if (typeof window !== 'undefined') {
        setCurrentHash(window.location.hash || '');
      }
    };

    window.addEventListener('hashchange', updateHash);
    window.addEventListener('popstate', updateHash);
    return () => {
      window.removeEventListener('hashchange', updateHash);
      window.removeEventListener('popstate', updateHash);
    };
  }, []);

  // Update hash when pathname changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentHash(window.location.hash || '');
    }
  }, [pathname]);

  // Determine user's effective role & active portal
  const isSoleAdmin = user?.email?.toLowerCase() === 'yeritti2017@gmail.com' || profile?.role === 'admin';
  const effectiveRole: UserRole = isSoleAdmin ? 'admin' : (portalRole || profile?.role || 'student');

  // Active portal currently viewed (student, instructor, admin)
  const activePortalRole: UserRole = portalRole || (
    pathname.startsWith('/admin') ? 'admin' : pathname.startsWith('/instructor') ? 'instructor' : 'student'
  );

  const userName = profile?.fullName || user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
  const userEmail = profile?.email || user?.email || '';
  const userAvatar = profile?.avatarUrl || user?.user_metadata?.avatar_url;

  // Role-specific navigation links for the active sidebar
  const studentNavItems: NavItem[] = [
    { label: 'Overview', href: '/student/dashboard', icon: 'dashboard' },
    { label: 'Available Exams', href: '/student/dashboard#available-exams', icon: 'key' },
    { label: 'My Submissions', href: '/student/dashboard#recent-submissions', icon: 'history_edu' },
    { label: 'Integrity Rules', href: '/rules', icon: 'gavel' },
  ];

  const instructorNavItems: NavItem[] = [
    { label: 'Instructor Overview', href: '/instructor/dashboard', icon: 'dashboard' },
    { label: 'Create Examination', href: '/instructor/exams/create', icon: 'add_circle' },
    { label: 'Manage Exams', href: '/instructor/dashboard#exams', icon: 'assignment' },
    { label: 'Submissions & Grading', href: '/instructor/dashboard#submissions', icon: 'grade' },
    { label: 'Proctoring Telemetry', href: '/instructor/dashboard#telemetry', icon: 'shield' },
    { label: 'Integrity Rules', href: '/rules', icon: 'gavel' },
  ];

  const adminNavItems: NavItem[] = [
    { label: 'Platform Overview', href: '/admin/dashboard', icon: 'dashboard' },
    { label: 'Teacher Management', href: '/admin/dashboard#teachers', icon: 'school' },
    { label: 'User Directory', href: '/admin/dashboard#users', icon: 'manage_accounts' },
    { label: 'Audit Trail Logs', href: '/admin/dashboard#audit', icon: 'receipt_long' },
    { label: 'Security Reports', href: '/admin/dashboard#reports', icon: 'shield' },
    { label: 'Integrity Rules', href: '/rules', icon: 'gavel' },
  ];

  // Active navigation items determined by current active portal view
  const navItems =
    activePortalRole === 'admin'
      ? adminNavItems
      : activePortalRole === 'instructor'
      ? instructorNavItems
      : studentNavItems;

  const roleMeta = {
    admin: {
      label: 'ADMINISTRATOR',
      shortLabel: 'ADMIN',
      badgeClass: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400',
      icon: 'admin_panel_settings',
      portalTitle: 'System Administration',
      color: '#f59e0b',
    },
    instructor: {
      label: 'INSTRUCTOR / TEACHER',
      shortLabel: 'INSTRUCTOR',
      badgeClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400',
      icon: 'school',
      portalTitle: 'Instructor Exam Console',
      color: '#10b981',
    },
    student: {
      label: 'STUDENT CANDIDATE',
      shortLabel: 'STUDENT',
      badgeClass: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400',
      icon: 'person',
      portalTitle: 'Student Assessment Hub',
      color: '#3b82f6',
    },
  }[activePortalRole];

  // Determine if a specific navItem is the SINGLE active item
  const isItemActive = (item: NavItem) => {
    const [itemPath, itemHash] = item.href.split('#');
    const hasHash = Boolean(itemHash);

    // If pathname doesn't match, this item is not active
    if (pathname !== itemPath) {
      return false;
    }

    // Check if the current URL has a hash matching any item in this navItems list
    const hasMatchingHashInList = navItems.some(
      (ni) => ni.href.includes('#') && '#' + ni.href.split('#')[1] === currentHash
    );

    if (hasMatchingHashInList) {
      return hasHash && '#' + itemHash === currentHash;
    }

    // Default: if no hash in URL, only the root item (without hash) is active
    return !hasHash;
  };

  // Reusable Sidebar Content for both Desktop and Mobile drawer
  const renderSidebarContent = (isMobile = false) => (
    <div className="flex flex-col h-full justify-between">
      <div className="p-4 sm:p-5 flex flex-col space-y-4">
        {/* Mobile Header (Brand + Close Button) */}
        {isMobile && (
          <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center font-mono font-bold text-xs shadow-sm">
                FA
              </div>
              <span className="font-bold text-base text-on-surface">FocusAssess</span>
            </Link>
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container"
              aria-label="Close menu"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        )}

        {/* Active Role Console Header Card */}
        <div className="p-3.5 rounded-2xl bg-surface-container-low/80 border border-surface-container-high flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-on-surface-variant">
              Active Console
            </span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="flex items-center gap-2.5">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shadow-sm flex-shrink-0 ${
                activePortalRole === 'admin'
                  ? 'bg-amber-600'
                  : activePortalRole === 'instructor'
                  ? 'bg-emerald-600'
                  : 'bg-primary'
              }`}
            >
              <span className="material-symbols-outlined text-[20px]">{roleMeta.icon}</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-bold text-on-surface truncate leading-tight">
                {roleMeta.portalTitle}
              </span>
              <span className="text-[10px] font-mono text-on-surface-variant uppercase font-semibold mt-0.5">
                {roleMeta.shortLabel} CONSOLE
              </span>
            </div>
          </div>
        </div>

        {/* Mobile Portal Switcher for Admin / Instructor */}
        {isMobile && isSoleAdmin && (
          <div className="p-2 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col gap-1.5">
            <span className="text-[10px] font-mono uppercase text-on-surface-variant font-bold px-1">
              Switch Console View
            </span>
            <div className="grid grid-cols-3 gap-1">
              <Link
                href="/admin/dashboard"
                onClick={() => setMobileOpen(false)}
                className={`py-1.5 rounded-lg text-center text-[11px] font-mono font-semibold transition-colors ${
                  activePortalRole === 'admin'
                    ? 'bg-black text-white shadow-sm'
                    : 'text-on-surface-variant bg-surface-container hover:text-on-surface hover:bg-slate-200'
                }`}
              >
                Admin
              </Link>
              <Link
                href="/instructor/dashboard"
                onClick={() => setMobileOpen(false)}
                className={`py-1.5 rounded-lg text-center text-[11px] font-mono font-semibold transition-colors ${
                  activePortalRole === 'instructor'
                    ? 'bg-black text-white shadow-sm'
                    : 'text-on-surface-variant bg-surface-container hover:text-on-surface hover:bg-slate-200'
                }`}
              >
                Teacher
              </Link>
              <Link
                href="/student/dashboard"
                onClick={() => setMobileOpen(false)}
                className={`py-1.5 rounded-lg text-center text-[11px] font-mono font-semibold transition-colors ${
                  activePortalRole === 'student'
                    ? 'bg-black text-white shadow-sm'
                    : 'text-on-surface-variant bg-surface-container hover:text-on-surface hover:bg-slate-200'
                }`}
              >
                Student
              </Link>
            </div>
          </div>
        )}

        {/* Navigation Items (Dynamically updates for Active Portal) */}
        <nav className="flex flex-col space-y-1">
          <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-on-surface-variant px-3 py-1">
            {roleMeta.shortLabel} Navigation
          </span>

          {navItems.map((item) => {
            const active = isItemActive(item);
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => {
                  setMobileOpen(false);
                  const [, itemHash] = item.href.split('#');
                  setCurrentHash(itemHash ? '#' + itemHash : '');
                }}
                className={`group h-10 px-3 rounded-xl flex items-center justify-between text-xs transition-all duration-150 ${
                  active
                    ? 'bg-black text-white font-bold shadow-md cursor-default'
                    : 'text-on-surface-variant font-medium bg-transparent hover:bg-black/5 dark:hover:bg-white/10 hover:text-black dark:hover:text-white hover:translate-x-1 active:scale-[0.99]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`material-symbols-outlined text-[18px] transition-colors ${
                      active
                        ? 'text-white'
                        : 'text-on-surface-variant group-hover:text-black dark:group-hover:text-white'
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`px-2 py-0.5 rounded-full font-mono text-[10px] transition-colors ${
                      active
                        ? 'bg-white/20 text-white font-bold'
                        : 'bg-surface-container text-on-surface-variant group-hover:bg-black/10 group-hover:text-black'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer Controls */}
      <div className="p-4 border-t border-surface-container-high/70 flex flex-col space-y-3">
        {/* Quick session status */}
        <div className="flex items-center justify-between text-[11px] font-mono text-on-surface-variant px-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Protected Session</span>
          </span>
          <span className="text-[10px] text-on-surface-variant/70 font-semibold">TLS 1.3</span>
        </div>

        {/* Secondary Sign Out in Sidebar */}
        <button
          onClick={() => signOut()}
          className="w-full h-9 rounded-xl px-3 flex items-center justify-center gap-2 text-xs font-semibold text-error bg-error-container/20 hover:bg-error-container/50 border border-error/15 transition-all active:scale-[0.99]"
          title="Terminate session and sign out"
        >
          <span className="material-symbols-outlined text-[17px]">logout</span>
          <span>Sign Out Session</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-surface w-full">
      {/* ========================================================================= */}
      {/* 1. PERSISTENT FIXED TOP BAR ACROSS STUDENT, TEACHER, AND ADMIN            */}
      {/* ========================================================================= */}
      <header className="fixed top-0 left-0 right-0 z-40 h-16 w-full bg-surface-container-lowest/95 backdrop-blur-md border-b border-surface-container-high/80 px-3 sm:px-6 md:px-8 flex items-center justify-between shadow-sm">
        {/* Left: Mobile Toggle + Brand + Status */}
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-xl text-on-surface-variant hover:bg-surface-container active:scale-95 transition-colors"
            aria-label="Toggle navigation drawer"
          >
            <span className="material-symbols-outlined text-[24px]">
              {mobileOpen ? 'close' : 'menu'}
            </span>
          </button>

          <Link href="/" className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 group">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-primary text-white flex items-center justify-center font-mono font-bold text-xs sm:text-sm shadow-sm group-hover:scale-105 transition-transform">
              FA
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base sm:text-lg text-on-surface tracking-tight leading-none">FocusAssess</span>
              <span className="text-[9px] sm:text-[10px] font-mono text-on-surface-variant font-medium tracking-wide mt-0.5 sm:mt-1 hidden xs:inline">
                EXAM PLATFORM
              </span>
            </div>
          </Link>

          <div className="hidden lg:flex items-center gap-1.5 pl-3 border-l border-surface-container-high">
            <span className="w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse" />
            <span className="font-mono text-xs text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-on-tertiary-container">verified_user</span>
              SECURE KERNEL
            </span>
          </div>
        </div>

        {/* Center: Admin & Multi-Role Portal Switcher Tabs */}
        {isSoleAdmin ? (
          <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-surface-container-low border border-surface-container-high shadow-inner">
            <Link
              href="/admin/dashboard"
              className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition-all ${
                activePortalRole === 'admin'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              Admin Portal
            </Link>
            <Link
              href="/instructor/dashboard"
              className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition-all ${
                activePortalRole === 'instructor'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              Teacher Portal
            </Link>
            <Link
              href="/student/dashboard"
              className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition-all ${
                activePortalRole === 'student'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              Student Hub
            </Link>
          </div>
        ) : profile?.role === 'instructor' ? (
          <div className="hidden md:flex items-center gap-1 p-1 rounded-xl bg-surface-container-low border border-surface-container-high shadow-inner">
            <Link
              href="/instructor/dashboard"
              className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition-all ${
                activePortalRole === 'instructor'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              Teacher Console
            </Link>
            <Link
              href="/student/dashboard"
              className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition-all ${
                activePortalRole === 'student'
                  ? 'bg-black text-white shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
            >
              Student View
            </Link>
          </div>
        ) : null}

        {/* Right: Integrity Rules + Role Badge + User Profile & Sign Out */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          <Link
            href="/rules"
            className="h-8 px-2.5 sm:px-3 rounded-lg border border-surface-container-high hover:bg-surface-container text-xs font-medium text-on-surface-variant hidden sm:flex items-center gap-1.5 transition-colors"
            title="View examination integrity guidelines"
          >
            <span className="material-symbols-outlined text-[15px]">gavel</span>
            <span className="hidden md:inline">Integrity Rules</span>
          </Link>

          {/* Role Badge in Top Bar */}
          <div
            className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full border text-[10px] sm:text-xs font-mono font-bold tracking-wide ${roleMeta.badgeClass}`}
          >
            <span className="material-symbols-outlined text-[13px] sm:text-[14px]">{roleMeta.icon}</span>
            <span className="hidden xs:inline">{roleMeta.label}</span>
            <span className="xs:hidden">{roleMeta.shortLabel}</span>
          </div>

          {/* User Avatar & Name in Top Bar */}
          <div className="flex items-center gap-2 pl-1 sm:pl-2 border-l border-surface-container-high">
            {userAvatar ? (
              <img
                src={userAvatar}
                alt={userName}
                className="w-8 h-8 rounded-full object-cover border border-surface-container-high shadow-sm"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-bold font-mono shadow-sm">
                {userName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-bold text-on-surface leading-tight truncate max-w-[130px]">{userName}</span>
              <span className="text-[10px] text-on-surface-variant font-mono truncate max-w-[130px]">{userEmail}</span>
            </div>
          </div>

          {/* Secure Sign Out Button in Top Bar */}
          <button
            onClick={() => signOut()}
            className="p-1.5 sm:px-3 sm:py-1.5 rounded-xl text-xs font-semibold text-error bg-error-container/30 hover:bg-error-container/60 border border-error/20 flex items-center gap-1.5 transition-all active:scale-95"
            title="Terminate session and sign out"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. DOCKED DESKTOP SIDEBAR (FIXED, NEVER CRUSHED, NEVER SHRUNK)           */}
      {/* ========================================================================= */}
      <aside className="hidden md:flex fixed top-16 left-0 bottom-0 w-64 bg-surface-container-lowest border-r border-surface-container-high/80 z-30 flex-col overflow-y-auto">
        {renderSidebarContent(false)}
      </aside>

      {/* ========================================================================= */}
      {/* 3. MOBILE SLIDE-OVER DRAWER WITH BACKDROP                                 */}
      {/* ========================================================================= */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 md:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      <div
        className={`fixed top-0 bottom-0 left-0 w-72 max-w-[85vw] bg-surface-container-lowest z-50 md:hidden flex flex-col shadow-2xl transition-transform duration-300 ease-in-out ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } overflow-y-auto`}
      >
        {renderSidebarContent(true)}
      </div>

      {/* ========================================================================= */}
      {/* 4. MAIN CONTENT WRAPPER (NATURAL WINDOW SCROLL, NO GESTURE BLOCKING)      */}
      {/* ========================================================================= */}
      <div className="md:pl-64 pt-16 min-h-screen w-full flex flex-col bg-surface">
        {/* Page Sub-Header / Breadcrumbs (if title or subtitle provided) */}
        {(title || subtitle) && (
          <div className="px-4 sm:px-6 md:px-8 py-4 border-b border-surface-container-high/40 bg-surface-container-lowest/50">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div>
                <h1 className="text-base sm:text-lg font-bold text-on-surface tracking-tight">
                  {title}
                </h1>
                {subtitle && (
                  <p className="text-[11px] text-on-surface-variant font-mono mt-0.5">{subtitle}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Page Content Body - fluid natural scrolling for touchpad, mouse, touch */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}