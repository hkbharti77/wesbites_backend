import { getDb } from '../db/connection.js';
import { logAuditEvent } from '../services/audit.service.js';

export async function getSettings(req, res) {
  try {
    const db = getDb();
    const [userCount, activeSessionsCount, rolesCount] = await Promise.all([
      db.collection('admin_users').countDocuments(),
      db.collection('admin_sessions').countDocuments({ revokedAt: null, expiresAt: { $gt: new Date() } }),
      db.collection('admin_roles').countDocuments(),
    ]);

    const settings = {
      security: {
        sessionDurationHours: 24,
        passwordMinLength: 8,
        rateLimitLoginWindowMinutes: 15,
        rateLimitMaxLoginAttempts: 10,
        doubleSubmitCsrfProtection: true,
        cookieSameSite: 'Lax',
        cookieHttpOnly: true,
        cookieSecure: process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production',
        mfaSupported: false, // Extensible placeholder; not claiming active until TOTP is tested
      },
      system: {
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        database: 'MongoDB Atlas',
        databaseName: process.env.MONGODB_DB_NAME || 'gyanvaniai_admin',
        totalAdminUsers: userCount,
        activeSessions: activeSessionsCount,
        totalRoles: rolesCount,
      },
    };

    return res.status(200).json({ settings });
  } catch (err) {
    console.error('Get Settings Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve system settings.', code: 'SERVER_ERROR' });
  }
}

export async function updateSettings(req, res) {
  try {
    const { sessionDurationHours, passwordMinLength } = req.body || {};

    await logAuditEvent({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'SETTINGS_UPDATED',
      targetType: 'system_settings',
      outcome: 'SUCCESS',
      metadata: { sessionDurationHours, passwordMinLength },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'System settings updated successfully.',
    });
  } catch (err) {
    console.error('Update Settings Error:', err);
    return res.status(500).json({ error: 'Failed to update settings.', code: 'SERVER_ERROR' });
  }
}

/* ── Theme metadata ──────────────────────────────────────────────────────── */
const THEMES = [
  { id: 'midnight', name: 'Enterprise Midnight',  color: '#070b12', accent: '#2dd4bf', description: 'Deep ink with teal accents'          },
  { id: 'aurora',   name: 'Aurora AI Glass',       color: '#031816', accent: '#10b981', description: 'Forest green operational mesh'        },
  { id: 'slate',    name: 'Corporate Slate',        color: '#0f172a', accent: '#38bdf8', description: 'Steel slate with sky accents'         },
  { id: 'quantum',  name: 'Quantum Cyan Tech',      color: '#021820', accent: '#22d3ee', description: 'Deep aqua for technical focus'        },
  { id: 'amber',    name: 'Sunset Amber Tech',      color: '#140d06', accent: '#f59e0b', description: 'Warm amber on dark bronze'             },
  { id: 'light',    name: 'Light Pearl Enterprise', color: '#f0f3f6', accent: '#0f766e', description: 'Clean light with teal primary'        },
  { id: 'sapphire', name: 'Cobalt Enterprise',      color: '#07101f', accent: '#60a5fa', description: 'Deep cobalt for formal brand surfaces' },
];
const DAILY_SCHEDULE = [
  { day: 'Sunday',    themeId: 'amber',    name: 'Sunset Amber Tech'      },
  { day: 'Monday',    themeId: 'aurora',   name: 'Aurora AI Glass'         },
  { day: 'Tuesday',   themeId: 'slate',    name: 'Corporate Slate'         },
  { day: 'Wednesday', themeId: 'quantum',  name: 'Quantum Cyan Tech'       },
  { day: 'Thursday',  themeId: 'light',    name: 'Light Pearl Enterprise'  },
  { day: 'Friday',    themeId: 'midnight', name: 'Enterprise Midnight'     },
  { day: 'Saturday',  themeId: 'sapphire', name: 'Cobalt Enterprise'       },
];

/* ── GET /api/admin/settings/theme ───────────────────────────────────────── */
export async function getThemeSettings(req, res) {
  try {
    const db  = getDb();
    const doc = await db.collection('site_settings').findOne({ _id: 'theme' });
    return res.status(200).json({
      themeMode:     doc?.themeMode  || 'fixed',
      fixedTheme:    doc?.fixedTheme || 'midnight',
      updatedAt:     doc?.updatedAt  || null,
      updatedBy:     doc?.updatedBy  || null,
      themes:        THEMES,
      dailySchedule: DAILY_SCHEDULE,
    });
  } catch (err) {
    console.error('Get Theme Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve theme settings.', code: 'SERVER_ERROR' });
  }
}

/* ── PUT /api/admin/settings/theme ───────────────────────────────────────── */
export async function updateThemeSettings(req, res) {
  try {
    const { themeMode, fixedTheme } = req.body || {};
    if (!['auto', 'fixed'].includes(themeMode)) {
      return res.status(400).json({ error: 'Invalid themeMode.', code: 'INVALID_INPUT' });
    }
    if (themeMode === 'fixed' && !THEMES.some(t => t.id === fixedTheme)) {
      return res.status(400).json({ error: 'Invalid fixedTheme ID.', code: 'INVALID_INPUT' });
    }

    const db  = getDb();
    const now = new Date();
    await db.collection('site_settings').updateOne(
      { _id: 'theme' },
      { $set: { themeMode, fixedTheme: fixedTheme || 'midnight', updatedAt: now, updatedBy: req.user?.email || 'admin' } },
      { upsert: true }
    );

    await logAuditEvent({
      actorUserId: req.user?.id,
      actorEmail:  req.user?.email,
      action:      'THEME_UPDATED',
      targetType:  'site_settings',
      outcome:     'SUCCESS',
      metadata:    { themeMode, fixedTheme },
      ipAddress:   req.ip,
      userAgent:   req.headers['user-agent'],
    });

    return res.status(200).json({ success: true, message: 'Website theme published live.', themeMode, fixedTheme });
  } catch (err) {
    console.error('Update Theme Error:', err);
    return res.status(500).json({ error: 'Failed to update theme settings.', code: 'SERVER_ERROR' });
  }
}

/* ── GET /api/public/site-settings/theme (public website reads) ───────────── */
export async function getPublicTheme(req, res) {
  try {
    const db  = getDb();
    const doc = await db.collection('site_settings').findOne({ _id: 'theme' });
    return res.status(200).json({
      themeMode:  doc?.themeMode  || 'fixed',
      fixedTheme: doc?.fixedTheme || 'midnight',
      updatedAt:  doc?.updatedAt  || null,
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to retrieve theme.', code: 'SERVER_ERROR' });
  }
}

