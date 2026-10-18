import crypto from 'crypto';
import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection.js';
import { logAuditEvent } from '../services/audit.service.js';
import {
  sendLeadNotificationToAdmin,
  sendLeadConfirmationToUser,
} from '../services/email.service.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Public Lead Ingestion Endpoint (Rate-Limited, Deduplicated, DPDP-Compliant)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function submitPublicLead(req, res) {
  const {
    name,
    email,
    phone,
    company,
    subject,
    message,
    source,
    channel,
    consent,
    consentVersion,
    _hp_company, // Bot honeypot field
  } = req.body;

  // 1. Invisible Honeypot Spam Trap: If bot filled this out, silently discard or flag
  if (_hp_company && _hp_company.trim().length > 0) {
    console.warn(`[SPAM BOT TRAPPED] Honeypot triggered from IP: ${req.ip}`);
    return res.status(200).json({
      success: true,
      message: 'Thank you for reaching out! A solution architect will contact you shortly.',
    });
  }

  // 2. Strict Input Validation
  if (!name || typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 100) {
    return res.status(400).json({
      error: 'Please provide a valid full name (2–100 characters).',
      code: 'INVALID_NAME',
    });
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email) || email.length > 255) {
    return res.status(400).json({
      error: 'Please provide a valid work email address.',
      code: 'INVALID_EMAIL',
    });
  }

  if (phone && (typeof phone !== 'string' || phone.length > 35)) {
    return res.status(400).json({
      error: 'Phone number format is invalid.',
      code: 'INVALID_PHONE',
    });
  }

  if (company && (typeof company !== 'string' || company.length > 120)) {
    return res.status(400).json({
      error: 'Company name is too long (maximum 120 characters).',
      code: 'INVALID_COMPANY',
    });
  }

  if (!message || typeof message !== 'string' || message.trim().length < 5 || message.trim().length > 2500) {
    return res.status(400).json({
      error: 'Message must be between 5 and 2500 characters.',
      code: 'INVALID_MESSAGE',
    });
  }

  if (!consent) {
    return res.status(400).json({
      error: 'Explicit consent under India DPDP Act 2023 is required to process your request.',
      code: 'CONSENT_REQUIRED',
    });
  }

  const emailNormalized = email.trim().toLowerCase();
  const trimmedMessage = message.trim();
  const trimmedName = name.trim();
  const trimmedCompany = company ? company.trim() : null;
  const trimmedPhone = phone ? phone.trim() : null;
  const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  // 3. Deduplication Engine (Hash: email + message content)
  const dedupeHash = crypto
    .createHash('sha256')
    .update(`${emailNormalized}:${trimmedMessage.toLowerCase()}`)
    .digest('hex');

  const db = getDb();
  const leadsCol = db.collection('contact_leads');

  // Check for duplicate submission within last 15 minutes
  const duplicateWindowMs = 15 * 60 * 1000;
  const duplicateThreshold = new Date(Date.now() - duplicateWindowMs);

  const existingDuplicate = await leadsCol.findOne({
    dedupeHash,
    createdAt: { $gte: duplicateThreshold },
  });

  if (existingDuplicate) {
    // Idempotent duplicate handling: Increment hits and return HTTP 200 without DB pollution
    await leadsCol.updateOne(
      { _id: existingDuplicate._id },
      {
        $inc: { dedupeHits: 1 },
        $set: { lastDuplicateAt: new Date() },
      }
    );

    return res.status(200).json({
      success: true,
      message: 'We have already received your inquiry and our team is actively reviewing it!',
      duplicate: true,
    });
  }

  // 4. Construct Lead Document with Multi-Channel System Isolation
  const resolvedChannel = (channel && typeof channel === 'string' && channel.trim().toLowerCase()) || 
    (source && typeof source === 'string' && source.toLowerCase().includes('portfolio') ? 'portfolio' : 'crm');
  const resolvedSource = source || (resolvedChannel === 'portfolio' ? 'portfolio_contact_form' : 'website_contact');

  const now = new Date();
  const leadDoc = {
    name: trimmedName,
    email: email.trim(),
    emailNormalized,
    phone: trimmedPhone,
    company: trimmedCompany,
    subject: subject ? subject.trim() : (trimmedCompany ? `Lead from ${trimmedCompany}` : (resolvedChannel === 'portfolio' ? 'Portfolio Contact Inquiry' : 'Website Inquiry')),
    message: trimmedMessage,
    channel: resolvedChannel,
    source: resolvedSource,
    status: 'new', // new | contacted | in_progress | qualified | converted | closed | spam
    priority: 'medium', // low | medium | high | urgent
    dedupeHash,
    dedupeHits: 0,
    lastDuplicateAt: null,
    consent: {
      granted: true,
      version: consentVersion || 'DPDP-2023-v1',
      recordedAt: now,
      ip: ipAddress,
      userAgent: userAgent.substring(0, 300),
    },
    notes: [],
    assignedTo: null,
    metadata: {
      channel: resolvedChannel,
      ip: ipAddress,
      userAgent: userAgent.substring(0, 300),
      referer: req.headers['referer'] || '',
    },
    createdAt: now,
    updatedAt: now,
  };

  const result = await leadsCol.insertOne(leadDoc);
  leadDoc._id = result.insertedId;

  // 5. Audit Log Entry
  await logAuditEvent({
    actorEmail: emailNormalized,
    action: 'lead.submitted',
    targetType: 'contact_lead',
    targetId: result.insertedId,
    metadata: {
      channel: leadDoc.channel,
      source: leadDoc.source,
      hasPhone: Boolean(trimmedPhone),
      hasCompany: Boolean(trimmedCompany),
    },
    ipAddress,
    userAgent,
  });

  // 6. Asynchronous Notification Emails (Fire and forget; never blocks response)
  sendLeadNotificationToAdmin({ lead: leadDoc }).catch(() => {});
  sendLeadConfirmationToUser({ lead: leadDoc }).catch(() => {});

  const successMessage = resolvedChannel === 'portfolio'
    ? 'Thank you for reaching out! Your message has been received, and I will get back to you shortly.'
    : 'Thank you for contacting GyanVaniAi! A senior solution architect will review your workflow and respond within 24 hours.';

  return res.status(201).json({
    success: true,
    message: successMessage,
    leadId: result.insertedId,
    channel: resolvedChannel,
  });
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Administrative Lead Management Endpoints (Protected by RBAC)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export async function getLeads(req, res) {
  const db = getDb();
  const leadsCol = db.collection('contact_leads');

  const page = Math.max(1, parseInt(req.query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || '20', 10)));
  const skip = (page - 1) * limit;

  const filter = {};

  // Status Filter
  if (req.query.status && req.query.status !== 'all') {
    filter.status = req.query.status;
  }

  // Priority Filter
  if (req.query.priority && req.query.priority !== 'all') {
    filter.priority = req.query.priority;
  }

  // Channel System Filter (portfolio | crm | all)
  if (req.query.channel && req.query.channel !== 'all') {
    const ch = req.query.channel.trim().toLowerCase();
    if (ch === 'crm') {
      filter.$or = [{ channel: 'crm' }, { channel: { $exists: false } }];
    } else {
      filter.channel = ch;
    }
  }

  // Search Filter (name, emailNormalized, company, message)
  if (req.query.search && req.query.search.trim().length > 0) {
    const s = req.query.search.trim();
    filter.$or = [
      { name: { $regex: s, $options: 'i' } },
      { emailNormalized: { $regex: s.toLowerCase(), $options: 'i' } },
      { company: { $regex: s, $options: 'i' } },
      { message: { $regex: s, $options: 'i' } },
    ];
  }

  const [leads, total] = await Promise.all([
    leadsCol.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    leadsCol.countDocuments(filter),
  ]);

  return res.status(200).json({
    leads,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  });
}

export async function getLeadStats(req, res) {
  const db = getDb();
  const leadsCol = db.collection('contact_leads');

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const baseFilter = {};
  if (req.query.channel && req.query.channel !== 'all') {
    const ch = req.query.channel.trim().toLowerCase();
    if (ch === 'crm') {
      baseFilter.$or = [{ channel: 'crm' }, { channel: { $exists: false } }];
    } else {
      baseFilter.channel = ch;
    }
  }

  const [
    total,
    newLeads,
    contacted,
    inProgress,
    qualified,
    converted,
    closed,
    spam,
    todayCount,
    last30Days,
  ] = await Promise.all([
    leadsCol.countDocuments(baseFilter),
    leadsCol.countDocuments({ ...baseFilter, status: 'new' }),
    leadsCol.countDocuments({ ...baseFilter, status: 'contacted' }),
    leadsCol.countDocuments({ ...baseFilter, status: 'in_progress' }),
    leadsCol.countDocuments({ ...baseFilter, status: 'qualified' }),
    leadsCol.countDocuments({ ...baseFilter, status: 'converted' }),
    leadsCol.countDocuments({ ...baseFilter, status: 'closed' }),
    leadsCol.countDocuments({ ...baseFilter, status: 'spam' }),
    leadsCol.countDocuments({ ...baseFilter, createdAt: { $gte: startOfToday } }),
    leadsCol.countDocuments({ ...baseFilter, createdAt: { $gte: thirtyDaysAgo } }),
  ]);

  const activeLeads = total - closed - spam;
  const conversionRate = activeLeads > 0 ? Number(((converted / activeLeads) * 100).toFixed(1)) : 0;

  return res.status(200).json({
    total,
    new: newLeads,
    contacted,
    inProgress,
    qualified,
    converted,
    closed,
    spam,
    todayCount,
    last30Days,
    conversionRate,
  });
}

export async function getLeadById(req, res) {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid lead ID format.', code: 'INVALID_ID' });
  }

  const db = getDb();
  const lead = await db.collection('contact_leads').findOne({ _id: new ObjectId(id) });
  if (!lead) {
    return res.status(404).json({ error: 'Lead not found.', code: 'NOT_FOUND' });
  }

  return res.status(200).json(lead);
}

export async function updateLead(req, res) {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid lead ID format.', code: 'INVALID_ID' });
  }

  const { status, priority, assignedTo } = req.body;
  const updateFields = { updatedAt: new Date() };

  const validStatuses = ['new', 'contacted', 'in_progress', 'qualified', 'converted', 'closed', 'spam'];
  if (status) {
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Allowed: ${validStatuses.join(', ')}`, code: 'INVALID_STATUS' });
    }
    updateFields.status = status;
  }

  const validPriorities = ['low', 'medium', 'high', 'urgent'];
  if (priority) {
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({ error: `Invalid priority. Allowed: ${validPriorities.join(', ')}`, code: 'INVALID_PRIORITY' });
    }
    updateFields.priority = priority;
  }

  if (assignedTo !== undefined) {
    updateFields.assignedTo = assignedTo;
  }

  const db = getDb();
  const result = await db.collection('contact_leads').findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: updateFields },
    { returnDocument: 'after' }
  );

  const updatedDoc = result.value || (await db.collection('contact_leads').findOne({ _id: new ObjectId(id) }));
  if (!updatedDoc) {
    return res.status(404).json({ error: 'Lead not found.', code: 'NOT_FOUND' });
  }

  await logAuditEvent({
    actorUserId: req.user?.id,
    actorEmail: req.user?.email,
    action: 'lead.updated',
    targetType: 'contact_lead',
    targetId: id,
    metadata: updateFields,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return res.status(200).json({ success: true, lead: updatedDoc });
}

export async function addLeadNote(req, res) {
  const { id } = req.params;
  const { note } = req.body;

  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid lead ID format.', code: 'INVALID_ID' });
  }

  if (!note || typeof note !== 'string' || note.trim().length === 0) {
    return res.status(400).json({ error: 'Note cannot be empty.', code: 'EMPTY_NOTE' });
  }

  const noteEntry = {
    _id: new ObjectId(),
    note: note.trim(),
    authorName: req.user?.name || req.user?.email || 'Admin Staff',
    authorUserId: req.user?.id ? String(req.user.id) : null,
    createdAt: new Date(),
  };

  const db = getDb();
  const result = await db.collection('contact_leads').findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $push: { notes: noteEntry },
      $set: { updatedAt: new Date() },
    },
    { returnDocument: 'after' }
  );

  const updatedDoc = result.value || (await db.collection('contact_leads').findOne({ _id: new ObjectId(id) }));
  if (!updatedDoc) {
    return res.status(404).json({ error: 'Lead not found.', code: 'NOT_FOUND' });
  }

  await logAuditEvent({
    actorUserId: req.user?.id,
    actorEmail: req.user?.email,
    action: 'lead.note_added',
    targetType: 'contact_lead',
    targetId: id,
    metadata: { noteLength: note.length },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return res.status(200).json({ success: true, lead: updatedDoc, note: noteEntry });
}

export async function deleteLead(req, res) {
  const { id } = req.params;
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: 'Invalid lead ID format.', code: 'INVALID_ID' });
  }

  const db = getDb();
  const existing = await db.collection('contact_leads').findOne({ _id: new ObjectId(id) });
  if (!existing) {
    return res.status(404).json({ error: 'Lead not found.', code: 'NOT_FOUND' });
  }

  await db.collection('contact_leads').deleteOne({ _id: new ObjectId(id) });

  await logAuditEvent({
    actorUserId: req.user?.id,
    actorEmail: req.user?.email,
    action: 'lead.deleted',
    targetType: 'contact_lead',
    targetId: id,
    metadata: { emailNormalized: existing.emailNormalized, name: existing.name },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  return res.status(200).json({ success: true, message: 'Lead deleted permanently.' });
}

export async function exportLeadsCsv(req, res) {
  const db = getDb();
  const filter = {};
  if (req.query.status && req.query.status !== 'all') {
    filter.status = req.query.status;
  }
  if (req.query.channel && req.query.channel !== 'all') {
    const ch = req.query.channel.trim().toLowerCase();
    if (ch === 'crm') {
      filter.$or = [{ channel: 'crm' }, { channel: { $exists: false } }];
    } else {
      filter.channel = ch;
    }
  }

  const leads = await db.collection('contact_leads').find(filter).sort({ createdAt: -1 }).toArray();

  const sanitizeCell = (val) => {
    if (val === null || val === undefined) return '""';
    let str = String(val);
    // Formula Injection Mitigation (RFC 4180 security)
    if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
      str = "'" + str;
    }
    return `"${str.replace(/"/g, '""')}"`;
  };

  const headers = [
    'ID',
    'Channel',
    'Source',
    'Name',
    'Email',
    'Phone',
    'Company',
    'Subject',
    'Message',
    'Status',
    'Priority',
    'Consent Version',
    'Consent Date',
    'Created At',
  ];

  const rows = leads.map((l) => [
    sanitizeCell(l._id),
    sanitizeCell(l.channel || 'crm'),
    sanitizeCell(l.source || ''),
    sanitizeCell(l.name),
    sanitizeCell(l.email),
    sanitizeCell(l.phone || ''),
    sanitizeCell(l.company || ''),
    sanitizeCell(l.subject || ''),
    sanitizeCell(l.message || ''),
    sanitizeCell(l.source || ''),
    sanitizeCell(l.status),
    sanitizeCell(l.priority || 'medium'),
    sanitizeCell(l.consent?.version || 'DPDP-2023-v1'),
    sanitizeCell(l.consent?.recordedAt ? new Date(l.consent.recordedAt).toISOString() : ''),
    sanitizeCell(new Date(l.createdAt).toISOString()),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="gyanvaniai-leads-export-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.status(200).send(csvContent);
}
