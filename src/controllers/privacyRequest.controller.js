/**
 * Data Subject Rights (DSR) & Privacy Grievance Controller
 * Operationalizes DPDP Act, 2023 Sections 6(4), 11, 12, 13 and DPDP Rules, 2025 Rule 11
 */

import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection.js';
import { logAuditEvent } from '../services/audit.service.js';
import { normalizeEmail } from '../utils/crypto.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const VALID_REQUEST_TYPES = [
  'Data Access Request',
  'Data Erasure Request',
  'Data Correction Request',
  'Consent Withdrawal',
  'Privacy Complaint',
  'Other',
];

/**
 * Generate cryptographic human-readable ticket ID (e.g. DSR-20261018-8F2B)
 */
function generateTicketId() {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `DSR-${dateStr}-${randomSuffix}`;
}

/**
 * Calculate statutory 15-business-day resolution deadline
 */
function calculateSlaDeadline(startDate = new Date(), businessDays = 15) {
  const date = new Date(startDate);
  let count = 0;
  while (count < businessDays) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) { // Skip Sunday (0) and Saturday (6)
      count++;
    }
  }
  return date;
}

/**
 * Public DSR & Grievance Submission Endpoint (Zero Session Auth)
 * Rate limited, bot-trapped, and generates official statutory ticket
 */
export async function submitPrivacyRequest(req, res) {
  try {
    const {
      name,
      email,
      phone,
      requestType,
      description,
      _hp_company, // Bot honeypot field
    } = req.body || {};

    // 1. Bot Honeypot Defense
    if (_hp_company && String(_hp_company).trim().length > 0) {
      console.warn(`[SPAM BOT TRAPPED] Privacy Request Honeypot triggered from IP: ${req.ip}`);
      return res.status(200).json({
        success: true,
        message: 'Your privacy request has been recorded. Reference Ticket: DSR-AUTO-CONFIRMED',
        ticketId: 'DSR-AUTO-CONFIRMED',
      });
    }

    // 2. Strict Input Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
      return res.status(400).json({
        error: 'Please provide your full legal name (2–100 characters).',
        code: 'INVALID_NAME',
      });
    }

    if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email) || email.length > 255) {
      return res.status(400).json({
        error: 'Please provide a valid email address for statutory communication.',
        code: 'INVALID_EMAIL',
      });
    }

    if (phone && (typeof phone !== 'string' || phone.length > 35)) {
      return res.status(400).json({
        error: 'Phone number format is invalid.',
        code: 'INVALID_PHONE',
      });
    }

    const typeNormalized = VALID_REQUEST_TYPES.find(
      t => t.toLowerCase() === String(requestType || '').trim().toLowerCase()
    ) || 'Other';

    if (!description || typeof description !== 'string' || description.trim().length < 10 || description.trim().length > 3000) {
      return res.status(400).json({
        error: 'Please describe your request in detail (between 10 and 3,000 characters).',
        code: 'INVALID_DESCRIPTION',
      });
    }

    const rawChannel = (req.body.channel || (req.body.source?.includes('portfolio') ? 'portfolio' : 'saas_crm')).toLowerCase();
    const channel = rawChannel === 'portfolio' ? 'portfolio' : 'saas_crm';
    const source = req.body.source || (channel === 'portfolio' ? 'portfolio_dsr_portal' : 'website_privacy_form');

    const emailNormalized = normalizeEmail(email);
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const userAgent = (req.headers['user-agent'] || 'unknown').substring(0, 300);

    const now = new Date();
    const ticketId = generateTicketId();
    const slaResolutionDueAt = calculateSlaDeadline(now, 15);

    const db = getDb();
    const col = db.collection('privacy_requests');

    // 3. Deduplication check: prevent duplicate submissions within 10 minutes per channel
    const duplicateWindow = new Date(now.getTime() - 10 * 60 * 1000);
    const existingRecent = await col.findOne({
      emailNormalized,
      requestType: typeNormalized,
      channel,
      createdAt: { $gte: duplicateWindow },
    });

    if (existingRecent) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        channel,
        message: `A recent privacy request for this email is already being processed. Your tracking reference is ${existingRecent.ticketId}.`,
        ticketId: existingRecent.ticketId,
        slaResolutionDueAt: existingRecent.slaResolutionDueAt,
      });
    }

    // 4. Construct Statutory Request Document with Channel Isolation
    const requestDoc = {
      ticketId,
      channel,
      source,
      name: name.trim(),
      email: email.trim(),
      emailNormalized,
      phone: phone ? phone.trim() : null,
      requestType: typeNormalized,
      description: description.trim(),
      status: 'received', // received | under_review | identity_verified | in_progress | resolved | rejected
      identityVerificationStatus: 'pending', // pending | verified | unverified
      slaResolutionDueAt,
      assignedTo: null,
      resolutionNotes: null,
      resolvedAt: null,
      metadata: {
        ipAddress,
        userAgent,
        source,
        channel,
      },
      createdAt: now,
      updatedAt: now,
    };

    const result = await col.insertOne(requestDoc);

    // 5. Audit Log (Forensic Evidence of Receipt)
    await logAuditEvent({
      actorEmail: emailNormalized,
      action: 'PRIVACY_REQUEST_SUBMITTED',
      targetType: 'privacy_request',
      targetId: result.insertedId.toString(),
      metadata: {
        ticketId,
        requestType: typeNormalized,
        slaResolutionDueAt: slaResolutionDueAt.toISOString(),
      },
      ipAddress,
      userAgent,
    });

    return res.status(201).json({
      success: true,
      message: `Your privacy request has been recorded in compliance with India DPDP Act, 2023. Our Grievance Officer will process your request within 15 business days.`,
      ticketId,
      slaResolutionDueAt: slaResolutionDueAt.toISOString(),
      acknowledgementDueHours: 24,
    });
  } catch (err) {
    console.error('Submit Privacy Request Error:', err);
    return res.status(500).json({
      error: 'Failed to process privacy request. Please contact our Grievance Officer at contact@gyanvaniai.com.',
      code: 'SERVER_ERROR',
    });
  }
}

/**
 * Administrative Endpoints (Protected by RBAC)
 */
export async function getPrivacyRequests(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status && req.query.status !== 'all') {
      filter.status = req.query.status;
    }
    if (req.query.requestType && req.query.requestType !== 'all') {
      filter.requestType = req.query.requestType;
    }
    if (req.query.channel && req.query.channel !== 'all') {
      const ch = req.query.channel.toLowerCase();
      filter.$or = [
        { channel: ch },
        { 'metadata.channel': ch },
        { 'metadata.source': ch === 'portfolio' ? /portfolio/i : /website|saas/i },
      ];
    }
    if (req.query.search && req.query.search.trim()) {
      const s = req.query.search.trim();
      const searchConditions = [
        { ticketId: { $regex: s, $options: 'i' } },
        { name: { $regex: s, $options: 'i' } },
        { emailNormalized: { $regex: s.toLowerCase(), $options: 'i' } },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    const db = getDb();
    const col = db.collection('privacy_requests');

    const [records, total] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ]);

    return res.status(200).json({
      requests: records,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error('Get Privacy Requests Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve privacy requests.', code: 'SERVER_ERROR' });
  }
}

export async function updatePrivacyRequest(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid ID format.', code: 'INVALID_ID' });
    }

    const { status, identityVerificationStatus, resolutionNotes, assignedTo } = req.body || {};
    const updateFields = { updatedAt: new Date() };

    const validStatuses = ['received', 'under_review', 'identity_verified', 'in_progress', 'resolved', 'rejected'];
    if (status) {
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Allowed: ${validStatuses.join(', ')}`, code: 'INVALID_STATUS' });
      }
      updateFields.status = status;
      if (status === 'resolved' || status === 'rejected') {
        updateFields.resolvedAt = new Date();
      }
    }

    if (identityVerificationStatus) {
      updateFields.identityVerificationStatus = identityVerificationStatus;
    }

    if (resolutionNotes !== undefined) {
      updateFields.resolutionNotes = resolutionNotes;
    }

    if (assignedTo !== undefined) {
      updateFields.assignedTo = assignedTo;
    }

    const db = getDb();
    const col = db.collection('privacy_requests');
    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: updateFields },
      { returnDocument: 'after' }
    );

    const doc = result.value || (await col.findOne({ _id: new ObjectId(id) }));
    if (!doc) {
      return res.status(404).json({ error: 'Privacy request not found.', code: 'NOT_FOUND' });
    }

    await logAuditEvent({
      actorUserId: req.user?.id,
      actorEmail: req.user?.email,
      action: 'PRIVACY_REQUEST_UPDATED',
      targetType: 'privacy_request',
      targetId: id,
      metadata: updateFields,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({ success: true, request: doc });
  } catch (err) {
    console.error('Update Privacy Request Error:', err);
    return res.status(500).json({ error: 'Failed to update request.', code: 'SERVER_ERROR' });
  }
}
