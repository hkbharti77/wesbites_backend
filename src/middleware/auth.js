import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection.js';
import { parseCookies, SESSION_COOKIE_NAME } from './cookieHelper.js';
import { validateSession } from '../services/session.service.js';
import { resolveUserPermissions } from '../services/rbac.service.js';

export async function authenticateAdmin(req, res, next) {
  try {
    const cookies = parseCookies(req);
    let token = cookies[SESSION_COOKIE_NAME];

    // Fallback to Bearer token in Authorization header for API testing/mobile clients
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.substring(7).trim();
    }

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required. Please sign in.',
        code: 'UNAUTHENTICATED',
      });
    }

    const session = await validateSession(token);
    if (!session) {
      return res.status(401).json({
        error: 'Session expired or invalidated. Please sign in again.',
        code: 'SESSION_INVALID',
      });
    }

    const db = getDb();
    const usersCol = db.collection('admin_users');
    const user = await usersCol.findOne({ _id: new ObjectId(session.userId) });

    if (!user) {
      return res.status(401).json({
        error: 'User account not found.',
        code: 'USER_NOT_FOUND',
      });
    }

    if (user.status !== 'active') {
      return res.status(401).json({
        error: 'This administrative account has been deactivated.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    const { roles, permissions, isSuperAdmin } = await resolveUserPermissions(user);

    req.user = {
      id: user._id.toString(),
      email: user.emailNormalized,
      name: user.name,
      status: user.status,
      roles,
      permissions,
      isSuperAdmin,
    };
    req.sessionToken = token;

    next();
  } catch (err) {
    console.error('Authentication Middleware Error:', err);
    return res.status(500).json({
      error: 'Authentication verification encountered an internal error.',
      code: 'AUTH_INTERNAL_ERROR',
    });
  }
}
