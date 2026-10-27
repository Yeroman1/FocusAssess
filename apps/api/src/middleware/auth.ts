import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { UserRole, AccountStatus } from '@pyassess/shared';

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

  try {
    let authUser: { id: string; email?: string; user_metadata?: any };

    // In local unit/integration test mode with mock tokens
    if (process.env.NODE_ENV === 'test' && token.startsWith('test-token-')) {
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
      // Production Supabase Auth token verification
      const { data, error } = await supabase.auth.getUser(token);
      if (error || !data.user) {
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

    // First-time registration bootstrap
    if (!profile) {
      // Secure first-admin bootstrap: only if email matches server-configured INITIAL_ADMIN_EMAIL
      const assignedRole: UserRole =
        normalizedEmail === config.initialAdminEmail ? 'admin' : 'student';

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

      console.log(`[PyAssess Auth] Created new profile for ${profile.email} with role ${profile.role}`);
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

    // Check account status
    if (profile.status === 'suspended') {
      return res.status(403).json({
        error: 'Account Suspended: Access to PyAssess is restricted. Please contact platform administration.',
      });
    }

    req.user = {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      role: profile.role as UserRole,
      status: profile.status as AccountStatus,
      avatarUrl: profile.avatarUrl,
    };

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
