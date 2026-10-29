// Auth & Access Control Middleware for FocusAssess
import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { UserRole, AccountStatus } from '@pyassess/shared';

// Polyfill global WebSocket for Node.js runtimes (< 22) where native WebSocket isn't enabled
if (typeof (globalThis as any).WebSocket === 'undefined') {
  (globalThis as any).WebSocket = class {};
}

// Initialize server-side Supabase client for secure token verification
const supabaseKey =
  config.supabaseSecretKey && config.supabaseSecretKey !== 'placeholder-service-role-key'
    ? config.supabaseSecretKey
    : config.supabasePublishableKey;

const supabase = createClient(config.supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: AccountStatus;
  avatarUrl?: string | null;
}

export interface AuthenticatedRequest<P = any, ResBody = any, ReqBody = any, ReqQuery = any>
  extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: AuthenticatedUser;
  body: ReqBody;
}

// In-memory token verification cache (60 seconds TTL) to eliminate redundant remote network calls
interface CachedUserSession {
  user: AuthenticatedUser;
  expiresAt: number;
}

const tokenCache = new Map<string, CachedUserSession>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Invalidate cached user sessions when role or status updates.
 */
export function invalidateUserAuthCache(userIdOrEmail?: string) {
  if (!userIdOrEmail) {
    tokenCache.clear();
    return;
  }
  const needle = userIdOrEmail.toLowerCase();
  for (const [token, cached] of tokenCache.entries()) {
    if (cached.user.id === userIdOrEmail || cached.user.email.toLowerCase() === needle) {
      tokenCache.delete(token);
    }
  }
}

/**
 * Verifies Supabase Bearer access token and attaches trusted PostgreSQL profile to req.user.
 */
export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized: Missing or invalid Bearer authentication token',
    });
  }

  const token = authHeader.split(' ')[1];

  // Fast path: Check in-memory token cache
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    req.user = cached.user;
    return next();
  }

  try {
    let authUser: { id: string; email?: string; user_metadata?: any };

    // In local unit/integration test or dev mode with test tokens
    if (process.env.NODE_ENV !== 'production' && token.startsWith('test-token-')) {
      const parts = token.replace('test-token-', '').split(':');
      const userId = parts[0] || 'test-student-id';
      const role = (parts[1] as UserRole) || 'student';
      const email = parts[2] || `${userId}@example.com`;

      authUser = {
        id: userId,
        email,
        user_metadata: { full_name: `Test User ${userId}`, role },
      };
    } else {
      // Production Supabase Auth token verification with 6s timeout guard
      const getUserPromise = supabase.auth.getUser(token);
      const timeoutPromise = new Promise<{ data: { user: null }; error: Error }>((_, reject) =>
        setTimeout(() => reject(new Error('Supabase token verification timed out')), 6000)
      );

      const { data, error } = (await Promise.race([getUserPromise, timeoutPromise])) as any;
      if (error || !data?.user) {
        return res.status(401).json({
          error: 'Unauthorized: Invalid, expired, or revoked Supabase access token',
        });
      }
      authUser = data.user;
    }

    if (!authUser.email) {
      return res.status(401).json({
        error: 'Unauthorized: Token does not contain an associated email address',
      });
    }

    // Load trusted profile from PostgreSQL (by Supabase auth ID or email)
    const normalizedEmail = authUser.email.toLowerCase();
    let profile = await prisma.profile.findFirst({
      where: {
        OR: [{ id: authUser.id }, { email: normalizedEmail }],
      },
    });

    // Check if this email has been pre-authorized as a Teacher by Admin
    const isAuthorizedTeacher = await prisma.authorizedTeacher.findUnique({
      where: { email: normalizedEmail },
    });

    // First-time registration bootstrap
    if (!profile) {
      // Secure first-admin bootstrap: only if email matches server-configured INITIAL_ADMIN_EMAIL
      const assignedRole: UserRole =
        normalizedEmail === config.initialAdminEmail
          ? 'admin'
          : isAuthorizedTeacher
          ? 'instructor'
          : 'student';

      profile = await prisma.profile.create({
        data: {
          id: authUser.id,
          email: normalizedEmail,
          fullName: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
          role: assignedRole,
          status: 'active',
          avatarUrl: authUser.user_metadata?.avatar_url || null,
        },
      });

      console.log(`[FocusAssess Auth] Created new profile for ${profile.email} with role ${profile.role}`);
    } else if (profile.id !== authUser.id) {
      // Synchronize database profile ID with real Supabase Auth ID
      profile = await prisma.profile.update({
        where: { id: profile.id },
        data: {
          id: authUser.id,
          avatarUrl: authUser.user_metadata?.avatar_url || profile.avatarUrl,
        },
      });
    }

    // Ensure the designated sole admin email always possesses the admin role
    if (normalizedEmail === config.initialAdminEmail && profile.role !== 'admin') {
      profile = await prisma.profile.update({
        where: { id: profile.id },
        data: { role: 'admin' },
      });
      console.log(`[FocusAssess Auth] Elevated designated admin ${profile.email} to admin role`);
    } else if (isAuthorizedTeacher && profile.role === 'student') {
      // Ensure pre-authorized teacher is immediately upgraded to instructor
      profile = await prisma.profile.update({
        where: { id: profile.id },
        data: { role: 'instructor' },
      });
      console.log(`[FocusAssess Auth] Elevated pre-authorized teacher ${profile.email} to instructor role`);
    }

    // Check account status
    if (profile.status === 'suspended') {
      return res.status(403).json({
        error: 'Account Suspended: Access to FocusAssess is restricted. Please contact platform administration.',
      });
    }

    const authenticatedUser: AuthenticatedUser = {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role as UserRole,
      status: profile.status as AccountStatus,
      avatarUrl: profile.avatarUrl,
    };

    // Cache the verified session
    tokenCache.set(token, {
      user: authenticatedUser,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    req.user = authenticatedUser;
    return next();
  } catch (err: any) {
    console.error('[Auth Error]', err);
    return res.status(500).json({
      error: 'Authentication verification error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  }
}

/**
 * Role-based authorization middleware
 */
export function requireRole(allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Forbidden: This operation requires one of the following roles: [${allowedRoles.join(', ')}]`,
      });
    }

    return next();
  };
}
