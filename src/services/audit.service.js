import { getDb } from '../db/connection.js';

/**
 * Audit log service: Write-only append logging for security-sensitive actions.
 * Explicitly sanitizes and omits sensitive secrets (passwords, tokens).
 */
export async function logAuditEvent({
  actorUserId = null,
  actorEmail = null,
  action,
  targetType,
  targetId = null,
  outcome = 'SUCCESS', // 'SUCCESS' | 'FAILURE'
  metadata = {},
  ipAddress = null,
  userAgent = null,
}) {
  try {
    const db = getDb();
    const auditCol = db.collection('admin_audit_logs');

    // Deep sanitize metadata to guarantee no passwords or raw secrets leak into logs
    const sanitizedMetadata = sanitizeAuditMetadata(metadata);

    const logEntry = {
      actorUserId: actorUserId ? String(actorUserId) : null,
      actorEmail: actorEmail || 'system/anonymous',
      action,
      targetType,
      targetId: targetId ? String(targetId) : null,
      outcome,
      metadata: sanitizedMetadata,
      ipAddress: ipAddress || 'unknown',
      userAgent: userAgent ? String(userAgent).substring(0, 255) : null,
      createdAt: new Date(),
    };

    await auditCol.insertOne(logEntry);
    return logEntry;
  } catch (err) {
    // Audit logging failure should be logged to stderr without crashing the request flow
    console.error('Audit Logging Failed:', err.message);
    return null;
  }
}

function sanitizeAuditMetadata(data) {
  if (!data || typeof data !== 'object') return {};
  const sanitized = {};
  const forbiddenKeys = new Set([
    'password',
    'passwordHash',
    'token',
    'sessionToken',
    'sessionTokenHash',
    'rawToken',
    'secret',
    'authorization',
  ]);

  for (const [k, v] of Object.entries(data)) {
    if (forbiddenKeys.has(k.toLowerCase())) {
      sanitized[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      sanitized[k] = sanitizeAuditMetadata(v);
    } else {
      sanitized[k] = v;
    }
  }

  return sanitized;
}

export const AUDIT_CATEGORIES = {
  AUTH: {
    label: 'Authentication & Security',
    prefix: ['AUTH_'],
  },
  USERS: {
    label: 'Users & Accounts',
    prefix: ['USER_'],
  },
  ROLES: {
    label: 'Roles & Access Control',
    prefix: ['ROLE_', 'PERMISSION_'],
  },
  CONTENT: {
    label: 'CMS Posts & Media',
    prefix: ['CMS_POST_', 'CATEGORY_', 'MEDIA_'],
  },
  LANDING: {
    label: 'Landing Pages',
    prefix: ['LANDING_PAGE_'],
  },
  LEADS: {
    label: 'Leads & CRM',
    prefix: ['LEAD_', 'lead.'],
  },
  NEWSLETTER: {
    label: 'Subscribers & Newsletter',
    prefix: ['SUBSCRIBER'],
  },
  SETTINGS: {
    label: 'System & Theme Settings',
    prefix: ['SETTINGS_', 'THEME_'],
  },
};

export async function getAuditLogs({
  page = 1,
  limit = 20,
  actorUserId = null,
  action = null,
  targetType = null,
  outcome = null,
  startDate = null,
  endDate = null,
  search = null,
  category = null,
}) {
  const db = getDb();
  const auditCol = db.collection('admin_audit_logs');

  const filter = {};
  if (actorUserId) filter.actorUserId = actorUserId;
  if (targetType) filter.targetType = targetType;
  if (outcome) filter.outcome = outcome;

  // Exact action filter or category filter
  if (action) {
    filter.action = action;
  } else if (category && AUDIT_CATEGORIES[category]) {
    const prefixes = AUDIT_CATEGORIES[category].prefix;
    const regexPatterns = prefixes.map(p => `^${p.replace('.', '\\.')}`).join('|');
    filter.action = { $regex: regexPatterns, $options: 'i' };
  }

  // Date range filter
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  // Search query across email, IP, action, targetId, targetType
  if (search && search.trim()) {
    const term = search.trim();
    const searchRegex = { $regex: term, $options: 'i' };
    filter.$or = [
      { actorEmail: searchRegex },
      { action: searchRegex },
      { targetType: searchRegex },
      { targetId: searchRegex },
      { ipAddress: searchRegex },
    ];
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const [total, logs] = await Promise.all([
    auditCol.countDocuments(filter),
    auditCol
      .find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .toArray(),
  ]);

  return {
    logs: logs.map(l => ({ ...l, id: l._id.toString(), _id: undefined })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 1,
    },
  };
}

export async function getAuditStats() {
  const db = getDb();
  const auditCol = db.collection('admin_audit_logs');

  const now = new Date();
  const past24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const past7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalEvents,
    events24h,
    events7d,
    failedEvents,
    authFailures24h,
    topActors,
    distinctActions,
    recentFailures,
  ] = await Promise.all([
    auditCol.countDocuments(),
    auditCol.countDocuments({ createdAt: { $gte: past24h } }),
    auditCol.countDocuments({ createdAt: { $gte: past7d } }),
    auditCol.countDocuments({ outcome: 'FAILURE' }),
    auditCol.countDocuments({
      action: 'AUTH_LOGIN_FAILED',
      createdAt: { $gte: past24h },
    }),
    auditCol
      .aggregate([
        { $match: { actorEmail: { $ne: null } } },
        { $group: { _id: '$actorEmail', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ])
      .toArray(),
    auditCol.distinct('action'),
    auditCol
      .find({ outcome: 'FAILURE' })
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray(),
  ]);

  return {
    totalEvents,
    events24h,
    events7d,
    failedEvents,
    authFailures24h,
    topActors: topActors.map(a => ({ email: a._id, count: a.count })),
    distinctActions: distinctActions.sort(),
    recentFailures: recentFailures.map(l => ({ ...l, id: l._id.toString(), _id: undefined })),
    categories: Object.entries(AUDIT_CATEGORIES).map(([key, value]) => ({
      key,
      label: value.label,
    })),
  };
}

export async function exportAuditLogs({
  search = null,
  category = null,
  action = null,
  outcome = null,
  startDate = null,
  endDate = null,
  format = 'csv',
}) {
  const db = getDb();
  const auditCol = db.collection('admin_audit_logs');

  const filter = {};
  if (action) {
    filter.action = action;
  } else if (category && AUDIT_CATEGORIES[category]) {
    const prefixes = AUDIT_CATEGORIES[category].prefix;
    const regexPatterns = prefixes.map(p => `^${p.replace('.', '\\.')}`).join('|');
    filter.action = { $regex: regexPatterns, $options: 'i' };
  }

  if (outcome) filter.outcome = outcome;

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
  }

  if (search && search.trim()) {
    const term = search.trim();
    const searchRegex = { $regex: term, $options: 'i' };
    filter.$or = [
      { actorEmail: searchRegex },
      { action: searchRegex },
      { targetType: searchRegex },
      { targetId: searchRegex },
      { ipAddress: searchRegex },
    ];
  }

  const logs = await auditCol
    .find(filter)
    .sort({ createdAt: -1 })
    .limit(5000)
    .toArray();

  if (format === 'json') {
    return {
      contentType: 'application/json',
      filename: `security-audit-report-${new Date().toISOString().slice(0, 10)}.json`,
      data: JSON.stringify(logs.map(l => ({ ...l, id: l._id.toString(), _id: undefined })), null, 2),
    };
  }

  // Generate CSV with RFC 4180 escaping
  const headers = ['Timestamp', 'Action', 'Outcome', 'Actor Email', 'Target Type', 'Target ID', 'IP Address', 'Metadata'];
  const rows = logs.map(l => [
    `"${new Date(l.createdAt).toISOString()}"`,
    `"${(l.action || '').replace(/"/g, '""')}"`,
    `"${l.outcome || 'SUCCESS'}"`,
    `"${(l.actorEmail || '').replace(/"/g, '""')}"`,
    `"${(l.targetType || '').replace(/"/g, '""')}"`,
    `"${(l.targetId || '').replace(/"/g, '""')}"`,
    `"${(l.ipAddress || '').replace(/"/g, '""')}"`,
    `"${JSON.stringify(l.metadata || {}).replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  return {
    contentType: 'text/csv; charset=utf-8',
    filename: `security-audit-report-${new Date().toISOString().slice(0, 10)}.csv`,
    data: csvContent,
  };
}
