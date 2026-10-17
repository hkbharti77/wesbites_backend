import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection.js';
import {
  hashPassword,
  verifyPassword,
  normalizeEmail,
  generateSecureToken,
  hashToken,
} from '../utils/crypto.js';
import {
  createSession,
  revokeSessionByToken,
  revokeAllUserSessions,
} from '../services/session.service.js';
import {
  setSessionCookie,
  clearSessionCookie,
} from '../middleware/cookieHelper.js';
import { resolveUserPermissions } from '../services/rbac.service.js';
import { logAuditEvent } from '../services/audit.service.js';
import { authRateLimiter, forgotPasswordRateLimiter } from '../middleware/rateLimiter.js';

export async function login(req, res) {
  try {
    const { email, password } = req.body || {};
    const ip = req.ip || req.connection.remoteAddress || 'unknown';

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required.',
        code: 'VALIDATION_ERROR',
      });
    }

    const emailNormalized = normalizeEmail(email);

    // Rate limiting key: IP + email combo
    const rateLimitKey = `${ip}:${emailNormalized}`;
    if (await authRateLimiter.isRateLimited(rateLimitKey)) {
      await logAuditEvent({
        action: 'AUTH_LOGIN_RATE_LIMITED',
        targetType: 'admin_user',
        outcome: 'FAILURE',
        metadata: { emailNormalized },
        ipAddress: ip,
        userAgent: req.headers['user-agent'],
      });

      return res.status(429).json({
        error: 'Too many failed login attempts. Please try again in 15 minutes.',
        code: 'RATE_LIMIT_EXCEEDED',
      });
    }

    const db = getDb();
    const usersCol = db.collection('admin_users');
    const user = await usersCol.findOne({ emailNormalized });

    // Generic error message for both non-existent account and wrong password
    const genericAuthError = 'Invalid email or password. Please verify your credentials.';

    if (!user) {
      await logAuditEvent({
        action: 'AUTH_LOGIN_FAILED',
        targetType: 'admin_user',
        outcome: 'FAILURE',
        metadata: { reason: 'USER_NOT_FOUND', emailNormalized },
        ipAddress: ip,
        userAgent: req.headers['user-agent'],
      });
      return res.status(401).json({ error: genericAuthError, code: 'INVALID_CREDENTIALS' });
    }

    if (user.status !== 'active') {
      await logAuditEvent({
        actorUserId: user._id,
        actorEmail: user.emailNormalized,
        action: 'AUTH_LOGIN_BLOCKED',
        targetType: 'admin_user',
        targetId: user._id,
        outcome: 'FAILURE',
        metadata: { reason: 'ACCOUNT_DEACTIVATED' },
        ipAddress: ip,
        userAgent: req.headers['user-agent'],
      });
      return res.status(403).json({
        error: 'Your administrative account has been deactivated. Please contact a Super Admin.',
        code: 'ACCOUNT_DEACTIVATED',
      });
    }

    const passwordMatch = await verifyPassword(password, user.passwordHash);
    if (!passwordMatch) {
      await logAuditEvent({
        actorUserId: user._id,
        actorEmail: user.emailNormalized,
        action: 'AUTH_LOGIN_FAILED',
        targetType: 'admin_user',
        targetId: user._id,
        outcome: 'FAILURE',
        metadata: { reason: 'PASSWORD_MISMATCH' },
        ipAddress: ip,
        userAgent: req.headers['user-agent'],
      });
      return res.status(401).json({ error: genericAuthError, code: 'INVALID_CREDENTIALS' });
    }

    // Successful login: Reset rate limit counter for this key
    await authRateLimiter.reset(rateLimitKey);

    // Create session in MongoDB
    const { rawToken, expiresAt } = await createSession({
      userId: user._id,
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });

    // Set secure HttpOnly cookie
    setSessionCookie(res, rawToken);

    // Update lastLoginAt
    await usersCol.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date(), updatedAt: new Date() } }
    );

    // Resolve roles & effective permissions
    const { roles, permissions, isSuperAdmin } = await resolveUserPermissions(user);

    await logAuditEvent({
      actorUserId: user._id,
      actorEmail: user.emailNormalized,
      action: 'AUTH_LOGIN_SUCCESS',
      targetType: 'admin_user',
      targetId: user._id,
      outcome: 'SUCCESS',
      metadata: { roles: roles.map(r => r.key) },
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      token: rawToken,
      user: {
        id: user._id.toString(),
        email: user.emailNormalized,
        name: user.name,
        status: user.status,
        roles,
        permissions,
        isSuperAdmin,
        lastLoginAt: new Date(),
      },
      expiresAt,
    });
  } catch (err) {
    console.error('Login Controller Error:', err);
    return res.status(500).json({
      error: 'An unexpected authentication error occurred.',
      code: 'AUTH_SERVER_ERROR',
    });
  }
}

export async function logout(req, res) {
  try {
    const rawToken = req.sessionToken;
    const user = req.user;

    if (rawToken) {
      await revokeSessionByToken(rawToken);
    }

    clearSessionCookie(res);

    if (user) {
      await logAuditEvent({
        actorUserId: user.id,
        actorEmail: user.email,
        action: 'AUTH_LOGOUT',
        targetType: 'admin_session',
        outcome: 'SUCCESS',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    });
  } catch (err) {
    console.error('Logout Controller Error:', err);
    return res.status(500).json({
      error: 'Error encountered during logout.',
      code: 'LOGOUT_ERROR',
    });
  }
}

export async function getCurrentUser(req, res) {
  return res.status(200).json({
    user: req.user,
  });
}

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body || {};
    const ip = req.ip || 'unknown';

    if (!email) {
      return res.status(400).json({
        error: 'Email address is required.',
        code: 'VALIDATION_ERROR',
      });
    }

    const emailNormalized = normalizeEmail(email);

    if (await forgotPasswordRateLimiter.isRateLimited(`${ip}:${emailNormalized}`)) {
      return res.status(429).json({
        error: 'Too many password reset requests. Please try again after 15 minutes.',
        code: 'RATE_LIMIT_EXCEEDED',
      });
    }

    const db = getDb();
    const usersCol = db.collection('admin_users');
    const resetsCol = db.collection('admin_password_resets');

    const user = await usersCol.findOne({ emailNormalized });

    let debugToken = null;

    if (user && user.status === 'active') {
      const rawToken = generateSecureToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await resetsCol.insertOne({
        userId: user._id,
        tokenHash,
        expiresAt,
        used: false,
        createdAt: new Date(),
        ipAddress: ip,
      });

      debugToken = rawToken;

      await logAuditEvent({
        actorUserId: user._id,
        actorEmail: user.emailNormalized,
        action: 'AUTH_PASSWORD_RESET_REQUESTED',
        targetType: 'admin_user',
        targetId: user._id,
        outcome: 'SUCCESS',
        ipAddress: ip,
        userAgent: req.headers['user-agent'],
      });
    }

    // Always return uniform message to prevent email enumeration
    const responsePayload = {
      success: true,
      message: 'If the provided email is registered, password reset instructions have been generated.',
    };

    // Expose debugToken in non-production for testing verification without requiring an external email transport
    if (process.env.NODE_ENV !== 'production' && debugToken) {
      responsePayload.devResetToken = debugToken;
    }

    return res.status(200).json(responsePayload);
  } catch (err) {
    console.error('Forgot Password Controller Error:', err);
    return res.status(500).json({
      error: 'Failed to process password reset request.',
      code: 'SERVER_ERROR',
    });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body || {};
    const ip = req.ip || 'unknown';

    if (!token || !newPassword) {
      return res.status(400).json({
        error: 'Reset token and new password are required.',
        code: 'VALIDATION_ERROR',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        error: 'Password must be at least 8 characters long.',
        code: 'PASSWORD_TOO_SHORT',
      });
    }

    const tokenHash = hashToken(token);
    const db = getDb();
    const resetsCol = db.collection('admin_password_resets');
    const usersCol = db.collection('admin_users');

    const resetRecord = await resetsCol.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      return res.status(400).json({
        error: 'Password reset link is invalid or has expired. Please request a new one.',
        code: 'RESET_TOKEN_INVALID',
      });
    }

    const user = await usersCol.findOne({ _id: resetRecord.userId });
    if (!user) {
      return res.status(400).json({
        error: 'Associated user account not found.',
        code: 'USER_NOT_FOUND',
      });
    }

    // Hash new password with bcrypt
    const passwordHash = await hashPassword(newPassword);

    // Update password
    await usersCol.updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash,
          passwordChangedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    // Invalidate reset token (single-use)
    await resetsCol.updateOne(
      { _id: resetRecord._id },
      { $set: { used: true, usedAt: new Date() } }
    );

    // Revoke all existing sessions for this user for security
    await revokeAllUserSessions(user._id);

    await logAuditEvent({
      actorUserId: user._id,
      actorEmail: user.emailNormalized,
      action: 'AUTH_PASSWORD_RESET_COMPLETED',
      targetType: 'admin_user',
      targetId: user._id,
      outcome: 'SUCCESS',
      ipAddress: ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'Your password has been successfully reset. Please sign in with your new credentials.',
    });
  } catch (err) {
    console.error('Reset Password Controller Error:', err);
    return res.status(500).json({
      error: 'Failed to reset password.',
      code: 'SERVER_ERROR',
    });
  }
}
