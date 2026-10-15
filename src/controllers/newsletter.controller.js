/**
 * Newsletter & Blog Subscribers Controller
 * 
 * Enterprise Standards:
 * - Cryptographic Token Hashing: Only SHA-256 hashes of unsubscribe tokens stored in MongoDB.
 * - Scanner Safe: GET verification never unsubscribes. Opt-out strictly requires POST.
 * - RFC 8058 One-Click list-unsubscribe header compatibility.
 * - Formula Injection Defense: Exported CSV cells sanitized against spreadsheet formula execution.
 * - Audit Integration: Every administrative action and export is logged.
 * - Privacy: Masked IPs and display emails.
 */

import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection.js';
import {
  generateSecureToken,
  hashToken,
  normalizeEmail,
  maskEmail,
  maskIp,
  sanitizeCsvField,
} from '../utils/crypto.js';
import { logAuditEvent } from '../services/audit.service.js';
import { sendConfirmationEmail, sendWelcomeEmail } from '../services/email.service.js';

const COL_NAME = 'newsletter_subscribers';

// RFC 5322 compliant email regex
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

/* ── POST /api/public/newsletter/subscribe ───────────────────────────────── */
export async function subscribe(req, res) {
  try {
    const {
      email,
      source = 'footer',
      policyVersion = '2026.1',
      _hp_company = '', // Invisible bot honeypot field
    } = req.body || {};

    // 1. Bot Honeypot Defense: Silently absorb bot submissions
    if (_hp_company && String(_hp_company).trim().length > 0) {
      return res.status(200).json({
        success: true,
        message: 'Thank you for subscribing to GyanVaniAi updates.',
      });
    }

    // 2. Validate Email Format
    if (!email || !EMAIL_REGEX.test(String(email).trim())) {
      return res.status(400).json({
        error: 'Please enter a valid work email address.',
        code: 'INVALID_EMAIL',
      });
    }

    const displayEmail = String(email).trim();
    const emailNormalized = normalizeEmail(displayEmail);

    const db = getDb();
    const col = db.collection(COL_NAME);

    // 3. Suppression check (Spam complaint or hard bounce suppression)
    const existing = await col.findOne({ emailNormalized });
    if (existing && existing.status === 'suppressed') {
      // Respond generically to prevent enumeration
      return res.status(200).json({
        success: true,
        message: 'Thank you for subscribing to GyanVaniAi updates.',
      });
    }

    // 4. Idempotency Check: Already active subscriber
    if (existing && existing.status === 'subscribed') {
      return res.status(200).json({
        success: true,
        alreadySubscribed: true,
        message: "You're already subscribed to our newsletter.",
      });
    }

    // 5. Generate secure random tokens and hash them
    const rawUnsubscribeToken = generateSecureToken(32);
    const unsubscribeTokenHash = hashToken(rawUnsubscribeToken);

    const isDoubleOptIn = process.env.NEWSLETTER_DOUBLE_OPT_IN === 'true';
    const rawConfirmToken = isDoubleOptIn ? generateSecureToken(32) : null;
    const confirmationTokenHash = isDoubleOptIn ? hashToken(rawConfirmToken) : null;
    const confirmationExpiresAt = isDoubleOptIn ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

    const ipMasked = maskIp(req.ip);
    const userAgentSnippet = (req.headers['user-agent'] || '').slice(0, 256);
    const now = new Date();

    if (existing) {
      // 6. Explicit Resubscription
      await col.updateOne(
        { _id: existing._id },
        {
          $set: {
            status: isDoubleOptIn ? 'pending_confirmation' : 'subscribed',
            unsubscribeTokenHash,
            confirmationTokenHash,
            confirmationExpiresAt,
            resubscribedAt: now,
            unsubscribedAt: null,
            unsubscribeReason: null,
            'consent.source': source,
            'consent.recordedAt': now,
            'consent.policyVersion': policyVersion,
            'consent.ipMasked': ipMasked,
            'consent.userAgentSnippet': userAgentSnippet,
            updatedAt: now,
          },
        }
      );
    } else {
      // 7. Insert Fresh Subscriber
      try {
        await col.insertOne({
          email: displayEmail,
          emailNormalized,
          status: isDoubleOptIn ? 'pending_confirmation' : 'subscribed',
          unsubscribeTokenHash,
          confirmationTokenHash,
          confirmationExpiresAt,
          consent: {
            source,
            recordedAt: now,
            policyVersion,
            ipMasked,
            userAgentSnippet,
          },
          confirmedAt: isDoubleOptIn ? null : now,
          unsubscribedAt: null,
          unsubscribeReason: null,
          resubscribedAt: null,
          metadata: {
            pageUrl: req.headers['referer'] || null,
          },
          createdAt: now,
          updatedAt: now,
        });
      } catch (insertErr) {
        // Handle concurrent duplicate insertion race condition gracefully
        if (insertErr.code === 11000 || insertErr.message?.includes('duplicate key')) {
          return res.status(200).json({
            success: true,
            alreadySubscribed: true,
            message: "You're already subscribed to our newsletter.",
          });
        }
        throw insertErr;
      }
    }

    // 8. Dispatch Email Notification
    const siteUrl = process.env.PUBLIC_SITE_URL || 'http://localhost:5173';
    const apiUrl = process.env.API_BASE_URL || 'http://localhost:5000/api';

    if (isDoubleOptIn && rawConfirmToken) {
      const confirmationUrl = `${apiUrl}/public/newsletter/confirm?token=${rawConfirmToken}`;
      sendConfirmationEmail({
        to: displayEmail,
        confirmationUrl,
        policyVersion,
      }).catch(err => console.error('Failed to dispatch double opt-in confirmation email:', err.message));
    } else {
      const unsubscribeUrl = `${siteUrl}/unsubscribe?token=${rawUnsubscribeToken}`;
      sendWelcomeEmail({
        to: displayEmail,
        unsubscribeUrl,
      }).catch(err => console.error('Failed to dispatch welcome email:', err.message));
    }

    return res.status(200).json({
      success: true,
      message: isDoubleOptIn
        ? 'Please check your inbox to confirm your subscription.'
        : 'Thank you for subscribing to GyanVaniAi updates.',
      ...(process.env.NODE_ENV !== 'production' ? { previewToken: rawUnsubscribeToken } : {}),
    });
  } catch (err) {
    console.error('Newsletter Subscribe Error:', err);
    return res.status(500).json({
      error: 'An unexpected error occurred while subscribing.',
      code: 'SERVER_ERROR',
    });
  }
}

/* ── GET /api/public/newsletter/unsubscribe/verify ────────────────────────── */
// SAFE READ-ONLY ENDPOINT: Scanner bots pre-fetching this link will NEVER unsubscribe
// REQUIREMENT: Strictly requires a valid cryptographically secure token. Rejects email alone to prevent harvesting.
export async function verifyUnsubscribeToken(req, res) {
  try {
    const { token } = req.query || {};

    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.status(400).json({
        valid: false,
        error: 'A valid unsubscribe token is required.',
        code: 'TOKEN_REQUIRED',
      });
    }

    const db = getDb();
    const col = db.collection(COL_NAME);

    const tokenHash = hashToken(String(token).trim());
    const subscriber = await col.findOne({ unsubscribeTokenHash: tokenHash });

    if (!subscriber) {
      return res.status(404).json({
        valid: false,
        error: 'Invalid or expired unsubscribe link.',
        code: 'TOKEN_INVALID',
      });
    }

    return res.status(200).json({
      valid: true,
      maskedEmail: maskEmail(subscriber.email),
      status: subscriber.status,
      alreadyUnsubscribed: subscriber.status === 'unsubscribed',
    });
  } catch (err) {
    console.error('Verify Unsubscribe Token Error:', err);
    return res.status(500).json({ valid: false, error: 'Failed to verify token.' });
  }
}

/* ── POST /api/public/newsletter/unsubscribe ─────────────────────────────── */
// EXPLICIT ACTION ENDPOINT: Compliant with RFC 8058 One-Click list-unsubscribe
// REQUIREMENT: Strictly requires a valid token. Never permits unsubscription via email alone.
export async function unsubscribe(req, res) {
  try {
    const { token, reason = 'user_request' } = req.body || {};
    const queryToken = req.query?.token;
    const finalToken = token || queryToken;

    if (!finalToken || typeof finalToken !== 'string' || finalToken.trim().length === 0) {
      return res.status(400).json({
        error: 'A valid unsubscribe token is required to unsubscribe.',
        code: 'TOKEN_REQUIRED',
      });
    }

    const db = getDb();
    const col = db.collection(COL_NAME);

    const tokenHash = hashToken(String(finalToken).trim());
    const subscriber = await col.findOne({ unsubscribeTokenHash: tokenHash });

    if (!subscriber) {
      // Idempotent generic success response to prevent token enumeration
      return res.status(200).json({
        success: true,
        message: 'You have been unsubscribed from our newsletter.',
      });
    }

    const now = new Date();
    await col.updateOne(
      { _id: subscriber._id },
      {
        $set: {
          status: 'unsubscribed',
          unsubscribedAt: now,
          unsubscribeReason: String(reason).slice(0, 200),
          updatedAt: now,
        },
      }
    );

    return res.status(200).json({
      success: true,
      message: 'You have been successfully unsubscribed from GyanVaniAi newsletter.',
    });
  } catch (err) {
    console.error('Newsletter Unsubscribe Error:', err);
    return res.status(500).json({
      error: 'Failed to process unsubscribe request.',
      code: 'SERVER_ERROR',
    });
  }
}

/* ── GET & POST /api/public/newsletter/confirm ─────────────────────────────── */
// Double opt-in verification handler
// REQUIREMENT: Protect against automated email security scanners activating subscriptions on GET requests.
// GET: Validates token without mutating DB, rendering an interactive confirmation prompt.
// POST: Executes the actual state mutation (pending_confirmation -> subscribed).
export async function confirmSubscription(req, res) {
  try {
    const token = req.query?.token || req.body?.token;
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.status(400).send('Invalid or missing confirmation token.');
    }

    const tokenHash = hashToken(String(token).trim());
    const db = getDb();
    const col = db.collection(COL_NAME);

    const subscriber = await col.findOne({
      confirmationTokenHash: tokenHash,
      confirmationExpiresAt: { $gt: new Date() },
    });

    if (!subscriber) {
      return res.status(400).send('Confirmation link has expired or is invalid.');
    }

    // Email Scanner Protection: If scanner sends a GET request, do NOT mutate DB
    if (req.method === 'GET') {
      const isJsonPreferred = req.headers.accept?.includes('application/json');
      if (isJsonPreferred) {
        return res.status(200).json({
          valid: true,
          maskedEmail: maskEmail(subscriber.email),
          requiresPostConfirmation: true,
          message: 'Please send a POST request with this token to finalize confirmation.',
        });
      }

      // Render clean confirmation UI with POST button for human interaction
      const htmlPrompt = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Your Subscription | GyanVaniAi</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 36px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5); }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 12px; color: #fff; }
    p { color: #94a3b8; font-size: 14px; line-height: 1.6; margin-bottom: 24px; }
    .btn { background: #6366f1; color: #fff; border: none; padding: 14px 28px; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 0.2s; width: 100%; }
    .btn:hover { background: #4f46e5; }
    .note { font-size: 12px; color: #64748b; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Confirm Newsletter Subscription</h1>
    <p>Please confirm that you want to receive AI architecture insights and engineering updates at <strong>${maskEmail(subscriber.email)}</strong>.</p>
    <form method="POST" action="/api/public/newsletter/confirm?token=${encodeURIComponent(token)}">
      <input type="hidden" name="token" value="${encodeURIComponent(token)}" />
      <button type="submit" class="btn">Yes, Confirm My Subscription</button>
    </form>
    <div class="note">This verification step ensures that automated email scanners do not activate subscriptions.</div>
  </div>
</body>
</html>`;
      return res.status(200).send(htmlPrompt);
    }

    // POST Request: Actual human confirmation and state mutation
    const now = new Date();
    await col.updateOne(
      { _id: subscriber._id },
      {
        $set: {
          status: 'subscribed',
          confirmedAt: now,
          confirmationTokenHash: null,
          confirmationExpiresAt: null,
          updatedAt: now,
        },
      }
    );

    if (req.headers.accept?.includes('application/json') || req.is('application/json')) {
      return res.status(200).json({
        success: true,
        message: 'Your subscription has been successfully confirmed.',
      });
    }

    return res.redirect('http://localhost:5173/blog?confirmed=1');
  } catch (err) {
    console.error('Confirm Subscription Error:', err);
    return res.status(500).send('Failed to confirm subscription.');
  }
}

/* ── GET /api/admin/subscribers ──────────────────────────────────────────── */
export async function getSubscribers(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const { search, status } = req.query;
    const filter = {};

    if (status && status !== 'all' && ['subscribed', 'unsubscribed', 'pending_confirmation', 'suppressed'].includes(status)) {
      filter.status = status;
    }

    if (search && search.trim()) {
      const term = search.trim();
      filter.$or = [
        { email: { $regex: term, $options: 'i' } },
        { emailNormalized: { $regex: term, $options: 'i' } },
        { 'consent.source': { $regex: term, $options: 'i' } },
      ];
    }

    const db = getDb();
    const col = db.collection(COL_NAME);

    const [subscribers, total] = await Promise.all([
      col.find(filter)
        .sort({ 'consent.recordedAt': -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      col.countDocuments(filter),
    ]);

    return res.status(200).json({
      subscribers: subscribers.map(s => ({
        id: s._id.toString(),
        email: s.email,
        status: s.status,
        source: s.consent?.source || 'footer',
        policyVersion: s.consent?.policyVersion || '2026.1',
        subscribedAt: s.consent?.recordedAt || s.createdAt,
        confirmedAt: s.confirmedAt,
        unsubscribedAt: s.unsubscribedAt,
        unsubscribeReason: s.unsubscribeReason,
        resubscribedAt: s.resubscribedAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Get Subscribers Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve subscribers.', code: 'SERVER_ERROR' });
  }
}

/* ── GET /api/admin/subscribers/stats ─────────────────────────────────────── */
export async function getSubscriberStats(req, res) {
  try {
    const db = getDb();
    const col = db.collection(COL_NAME);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      total,
      subscribedCount,
      unsubscribedCount,
      pendingCount,
      suppressedCount,
      newLast30Days,
    ] = await Promise.all([
      col.countDocuments({}),
      col.countDocuments({ status: 'subscribed' }),
      col.countDocuments({ status: 'unsubscribed' }),
      col.countDocuments({ status: 'pending_confirmation' }),
      col.countDocuments({ status: 'suppressed' }),
      col.countDocuments({ 'consent.recordedAt': { $gte: thirtyDaysAgo } }),
    ]);

    const churnRate = total > 0 ? Math.round((unsubscribedCount / total) * 100) : 0;
    const activeRate = total > 0 ? Math.round((subscribedCount / total) * 100) : 0;

    return res.status(200).json({
      total,
      subscribed: subscribedCount,
      unsubscribed: unsubscribedCount,
      pending: pendingCount,
      suppressed: suppressedCount,
      newLast30Days,
      churnRate,
      activeRate,
    });
  } catch (err) {
    console.error('Get Subscriber Stats Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve stats.', code: 'SERVER_ERROR' });
  }
}

/* ── PATCH /api/admin/subscribers/:id/status ─────────────────────────────── */
export async function updateSubscriberStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, reason } = req.body || {};

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid subscriber ID.', code: 'INVALID_ID' });
    }

    const allowed = ['subscribed', 'unsubscribed', 'suppressed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.', code: 'INVALID_STATUS' });
    }

    const db = getDb();
    const col = db.collection(COL_NAME);

    const subscriber = await col.findOne({ _id: new ObjectId(id) });
    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found.', code: 'NOT_FOUND' });
    }

    const now = new Date();
    const updateDoc = {
      status,
      updatedAt: now,
    };

    if (status === 'unsubscribed') {
      updateDoc.unsubscribedAt = now;
      updateDoc.unsubscribeReason = reason || 'admin_manual_update';
    } else if (status === 'subscribed') {
      updateDoc.resubscribedAt = now;
      updateDoc.unsubscribedAt = null;
      updateDoc.unsubscribeReason = null;
    }

    await col.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc });

    await logAuditEvent({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'SUBSCRIBER_STATUS_CHANGED',
      targetType: 'newsletter_subscriber',
      targetId: id,
      outcome: 'SUCCESS',
      metadata: { previousStatus: subscriber.status, newStatus: status, reason },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: `Subscriber status updated to ${status}.`,
    });
  } catch (err) {
    console.error('Update Subscriber Status Error:', err);
    return res.status(500).json({ error: 'Failed to update subscriber.', code: 'SERVER_ERROR' });
  }
}

/* ── DELETE /api/admin/subscribers/:id ───────────────────────────────────── */
// GDPR Art. 17 Right to Erasure
export async function deleteSubscriber(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid subscriber ID.', code: 'INVALID_ID' });
    }

    const db = getDb();
    const col = db.collection(COL_NAME);

    const subscriber = await col.findOne({ _id: new ObjectId(id) });
    if (!subscriber) {
      return res.status(404).json({ error: 'Subscriber not found.', code: 'NOT_FOUND' });
    }

    await col.deleteOne({ _id: new ObjectId(id) });

    await logAuditEvent({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'SUBSCRIBER_DELETED',
      targetType: 'newsletter_subscriber',
      targetId: id,
      outcome: 'SUCCESS',
      metadata: { emailNormalized: subscriber.emailNormalized },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'Subscriber record permanently erased (GDPR Article 17 compliance).',
    });
  } catch (err) {
    console.error('Delete Subscriber Error:', err);
    return res.status(500).json({ error: 'Failed to delete subscriber.', code: 'SERVER_ERROR' });
  }
}

/* ── GET /api/admin/subscribers/export ────────────────────────────────────── */
// Formula Injection Sanitized CSV Export
export async function exportSubscribersCsv(req, res) {
  try {
    const { status } = req.query;
    const filter = {};
    if (status && status !== 'all') {
      filter.status = status;
    }

    const db = getDb();
    const col = db.collection(COL_NAME);

    const subscribers = await col
      .find(filter)
      .sort({ 'consent.recordedAt': -1 })
      .toArray();

    // CSV Header Row
    const headers = [
      'ID',
      'Email',
      'Status',
      'Source',
      'Policy Version',
      'Subscribed Date (UTC)',
      'Unsubscribed Date (UTC)',
      'Unsubscribe Reason',
      'Resubscribed Date (UTC)',
    ];

    const rows = [headers.join(',')];

    for (const s of subscribers) {
      const row = [
        sanitizeCsvField(s._id.toString()),
        `"${sanitizeCsvField(s.email)}"`,
        sanitizeCsvField(s.status),
        sanitizeCsvField(s.consent?.source || 'footer'),
        sanitizeCsvField(s.consent?.policyVersion || '2026.1'),
        sanitizeCsvField(s.consent?.recordedAt ? new Date(s.consent.recordedAt).toISOString() : ''),
        sanitizeCsvField(s.unsubscribedAt ? new Date(s.unsubscribedAt).toISOString() : ''),
        `"${sanitizeCsvField(s.unsubscribeReason || '')}"`,
        sanitizeCsvField(s.resubscribedAt ? new Date(s.resubscribedAt).toISOString() : ''),
      ];
      rows.push(row.join(','));
    }

    const csvContent = rows.join('\r\n');

    await logAuditEvent({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'SUBSCRIBERS_EXPORTED',
      targetType: 'newsletter_subscribers',
      outcome: 'SUCCESS',
      metadata: { filterStatus: status || 'all', recordCount: subscribers.length },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="gyanvaniai_subscribers_${timestamp}.csv"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('Export Subscribers CSV Error:', err);
    return res.status(500).json({ error: 'Failed to export subscribers.', code: 'SERVER_ERROR' });
  }
}
