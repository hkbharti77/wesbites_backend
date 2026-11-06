import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection.js';
import { logAuditEvent } from '../services/audit.service.js';
import {
  parseSenderAddress,
  parseInboundEmailContent,
  stripQuotedEmailText,
  extractLeadIdFromEmail,
  sanitizeInboundHtml,
} from '../services/emailParser.service.js';

/**
 * Handle incoming inbound emails from Cloudflare Email Workers, AWS SES SNS, SendGrid, or direct Webhooks.
 * Correlates the inbound message with the corresponding lead and appends it to the conversation thread.
 */
export async function handleInboundEmailWebhook(req, res) {
  // 1. Webhook Secret Authentication
  const configuredSecret = process.env.INBOUND_WEBHOOK_SECRET;
  if (configuredSecret) {
    const providedSecret =
      req.headers['x-webhook-secret'] ||
      (req.headers['authorization'] || '').replace(/^Bearer\s+/i, '') ||
      req.query?.secret;

    if (!providedSecret || providedSecret !== configuredSecret) {
      console.warn(`[Inbound Email Webhook] Unauthorized request from IP: ${req.ip}`);
      return res.status(401).json({ error: 'Unauthorized webhook secret.', code: 'UNAUTHORIZED_WEBHOOK' });
    }
  }

  // 2. AWS SNS Subscription Confirmation (if using AWS SNS as webhook dispatcher)
  if (req.body?.Type === 'SubscriptionConfirmation' && req.body?.SubscribeURL) {
    console.log(`[Inbound Email Webhook] Received AWS SNS SubscriptionConfirmation: ${req.body.SubscribeURL}`);
    try {
      await fetch(req.body.SubscribeURL);
      return res.status(200).json({ success: true, message: 'SNS subscription confirmed successfully.' });
    } catch (snsErr) {
      console.error('Failed to confirm SNS subscription:', snsErr.message);
      return res.status(500).json({ error: 'Failed to confirm SNS subscription.' });
    }
  }

  // 3. Normalize Request Payload across providers
  let payload = req.body || {};

  // If payload wrapped in AWS SNS Message string
  if (payload.Type === 'Notification' && typeof payload.Message === 'string') {
    try {
      payload = JSON.parse(payload.Message);
    } catch {
      // Keep payload as is
    }
  }

  // Extract core fields
  const rawFrom = payload.from || payload.sender || payload.mail?.source || '';
  const rawTo = payload.to || payload.recipient || (payload.mail?.destination ? payload.mail.destination[0] : '');
  const rawSubject = payload.subject || payload.mail?.commonHeaders?.subject || '';
  let rawText = payload.text || payload.bodyText || payload.content || '';
  let rawHtml = payload.html || payload.bodyHtml || '';
  const inboundMessageId = payload.messageId || payload.mail?.messageId || `<inbound.${Date.now()}@gyanvaniai.com>`;
  const inReplyTo = payload.inReplyTo || payload.mail?.commonHeaders?.inReplyTo || payload.headers?.['in-reply-to'] || null;
  
  let references = payload.references || payload.mail?.commonHeaders?.references || payload.headers?.['references'] || [];
  if (typeof references === 'string') {
    references = references.split(/\s+/).filter(Boolean);
  }

  // 4. Parse & Clean Inbound Email Content (Extracts pure human message from raw RFC 822 MIME)
  const parsedContent = await parseInboundEmailContent({
    text: rawText,
    html: rawHtml,
    subject: rawSubject,
    from: rawFrom,
    to: rawTo,
    headers: payload.headers || {},
  });

  const finalFrom = parsedContent.cleanFrom || rawFrom;
  const finalTo = parsedContent.cleanTo || rawTo;
  const finalSubject = parsedContent.cleanSubject || rawSubject;
  const cleanBodyText = parsedContent.cleanText;
  const sanitizedHtml = sanitizeInboundHtml(parsedContent.cleanHtml);
  const resolvedInReplyTo = inReplyTo || parsedContent.inReplyTo;
  const resolvedReferences = (references && references.length > 0) ? references : (parsedContent.references || []);

  const { name: senderName, email: cleanFromEmail } = parseSenderAddress(finalFrom);
  if (!cleanFromEmail) {
    return res.status(400).json({
      error: 'Missing valid sender email address.',
      code: 'INVALID_SENDER',
    });
  }

  const db = getDb();
  const leadsCol = db.collection('contact_leads');
  let matchedLead = null;

  // 5. Tier 1: Look for explicit Lead ID in recipient address, subject, or headers
  const explicitLeadId = extractLeadIdFromEmail({
    to: finalTo,
    subject: finalSubject,
    headers: payload.headers || {},
  });

  if (explicitLeadId && ObjectId.isValid(explicitLeadId)) {
    matchedLead = await leadsCol.findOne({ _id: new ObjectId(explicitLeadId) });
  }

  // 6. Tier 2: Look for In-Reply-To or References matching our outbound Message-ID
  if (!matchedLead) {
    const targetMessageIds = [resolvedInReplyTo, ...resolvedReferences].filter(Boolean);
    if (targetMessageIds.length > 0) {
      matchedLead = await leadsCol.findOne({
        'messages.messageId': { $in: targetMessageIds },
      });
    }
  }

  // 7. Tier 3: Match by normalized sender email
  if (!matchedLead) {
    const emailToSearch = cleanFromEmail.toLowerCase().trim();
    // Prefer active leads (not closed/spam) sorted by recent activity
    matchedLead = await leadsCol.findOne(
      {
        $or: [
          { emailNormalized: emailToSearch },
          { email: emailToSearch },
        ],
      },
      { sort: { updatedAt: -1 } }
    );
  }

  // If no matching lead found, acknowledge receipt gracefully
  if (!matchedLead) {
    console.warn(`[Inbound Email] No matching lead found for sender "${cleanFromEmail}" (Subject: "${rawSubject}")`);
    return res.status(200).json({
      success: true,
      matched: false,
      message: 'Email received, but no corresponding active lead record was matched.',
      sender: cleanFromEmail,
    });
  }

  // 8. Build Message & Note Entries
  const now = new Date();
  const inboundMessage = {
    _id: new ObjectId(),
    direction: 'inbound',
    senderType: 'client',
    from: finalFrom,
    fromEmail: cleanFromEmail,
    fromName: senderName || matchedLead.name,
    to: finalTo,
    subject: finalSubject || `Re: Discussion with ${matchedLead.name}`,
    bodyText: cleanBodyText || '(No text content)',
    bodyHtml: sanitizedHtml || null,
    messageId: inboundMessageId,
    inReplyTo: resolvedInReplyTo || null,
    references: resolvedReferences.length > 0 ? resolvedReferences : null,
    createdAt: now,
  };

  const previewSnippet = (cleanBodyText || '').slice(0, 100);
  const noteEntry = {
    _id: new ObjectId(),
    type: 'client_reply',
    note: `Client replied via email: "${previewSnippet}${previewSnippet.length >= 100 ? '...' : ''}"`,
    emailSubject: finalSubject,
    emailMessage: cleanBodyText,
    sender: cleanFromEmail,
    senderName: senderName || matchedLead.name,
    createdAt: now,
  };

  // 9. Update Database Record
  const newStatus = matchedLead.status === 'converted' ? 'converted' : 'client_replied';

  await leadsCol.updateOne(
    { _id: matchedLead._id },
    {
      $push: {
        messages: inboundMessage,
        notes: noteEntry,
      },
      $set: {
        status: newStatus,
        lastMessageAt: now,
        lastMessageDirection: 'inbound',
        updatedAt: now,
      },
      $inc: { unreadClientReplies: 1 },
    }
  );

  // 10. Audit Logging
  await logAuditEvent({
    action: 'lead.client_replied',
    targetType: 'contact_lead',
    targetId: matchedLead._id.toString(),
    targetName: matchedLead.name,
    metadata: {
      from: cleanFromEmail,
      subject: rawSubject,
      channel: matchedLead.channel || 'crm',
      messageId: inboundMessageId,
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
  });

  console.log(`[Inbound Email Processed] Matched Lead #${matchedLead._id} (${matchedLead.name}) from ${cleanFromEmail}`);

  return res.status(200).json({
    success: true,
    matched: true,
    leadId: matchedLead._id,
    leadName: matchedLead.name,
    messageId: inboundMessage._id,
    unreadClientReplies: (matchedLead.unreadClientReplies || 0) + 1,
  });
}

