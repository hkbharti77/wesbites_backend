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

export async function getAuditLogs({
  page = 1,
  limit = 20,
  actorUserId = null,
  action = null,
  targetType = null,
  outcome = null,
  startDate = null,
  endDate = null,
}) {
  const db = getDb();
  const auditCol = db.collection('admin_audit_logs');

  const filter = {};
  if (actorUserId) filter.actorUserId = actorUserId;
  if (action) filter.action = action;
  if (targetType) filter.targetType = targetType;
  if (outcome) filter.outcome = outcome;

  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) filter.createdAt.$lte = new Date(endDate);
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
      totalPages: Math.ceil(total / limitNum),
    },
  };
}
