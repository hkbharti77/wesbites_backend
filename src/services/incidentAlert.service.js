/**
 * Security Incident & Breach Notification Dispatcher
 * Operationalizes CERT-In Directions (2022) 6-Hour Incident Reporting Mandate
 * & DPDP Act 2023 Section 8(6) Personal Data Breach Intimation Requirement
 */

import nodemailer from 'nodemailer';

const RECENT_ALERTS = new Map();
const ALERT_DEDUPE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const CRITICAL_ACTIONS = new Set([
  'PRIVILEGE_ESCALATION_DENIED',
  'AUDIT_LOG_IMMUTABLE',
  'BULK_DATA_EXPORT',
  'AUTH_BRUTE_FORCE_TRIGGERED',
  'UNAUTHORIZED_ADMIN_MUTATION',
  'DATABASE_INTEGRITY_ANOMALY',
]);

/**
 * Evaluates an audit log entry and dispatches real-time security alerts if critical
 */
export async function dispatchSecurityIncidentAlert(auditEntry) {
  try {
    if (!auditEntry || !auditEntry.action) return;

    const isCritical = CRITICAL_ACTIONS.has(auditEntry.action) ||
      (auditEntry.outcome === 'FAILURE' && auditEntry.action.startsWith('AUTH_LOGIN_FAILED_'));

    if (!isCritical) return;

    const alertKey = `${auditEntry.action}:${auditEntry.ipAddress || 'unknown'}:${auditEntry.actorEmail || 'unknown'}`;
    const now = Date.now();
    const lastAlertTime = RECENT_ALERTS.get(alertKey);

    if (lastAlertTime && (now - lastAlertTime < ALERT_DEDUPE_WINDOW_MS)) {
      // Alert already dispatched recently for this actor/IP - skip to prevent mail flooding
      return;
    }

    RECENT_ALERTS.set(alertKey, now);

    const recipient = process.env.SECURITY_ALERT_EMAIL ||
      process.env.GRIEVANCE_OFFICER_EMAIL ||
      'contact@gyanvaniai.com';

    // Calculate CERT-In statutory 6-hour deadline
    const certInDeadline = new Date(now + 6 * 60 * 60 * 1000);

    const incidentData = {
      action: auditEntry.action,
      severity: 'CRITICAL',
      detectedAt: new Date(now).toISOString(),
      certInDeadlineUtc: certInDeadline.toISOString(),
      certInDeadlineIst: certInDeadline.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      actorEmail: auditEntry.actorEmail || 'anonymous',
      ipAddress: auditEntry.ipAddress || 'unknown',
      userAgent: auditEntry.userAgent || 'unknown',
      metadata: auditEntry.metadata || {},
    };

    console.warn(`\n🚨 [SECURITY BREACH ALERT] Critical event detected: ${auditEntry.action} from IP ${auditEntry.ipAddress}`);
    console.warn(`⏰ CERT-In Statutory 6-Hour Reporting Deadline: ${incidentData.certInDeadlineIst} (IST)\n`);

    // Attempt to send email alert if SMTP is configured
    await sendIncidentEmail(recipient, incidentData);

    return incidentData;
  } catch (err) {
    // Fail safe: Alerting errors must never crash caller flow
    console.error('Security Incident Dispatch Error:', err.message);
    return null;
  }
}

async function sendIncidentEmail(to, incident) {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

  if (!user || !pass) {
    // Development or unconfigured SMTP: log to stdout for operational audit trail
    console.info(`[DEV INCIDENT DISPATCH MOCK] To: ${to} | Subject: CRITICAL SECURITY INCIDENT: ${incident.action}`);
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: true },
  });

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; border: 2px solid #e11d48; border-radius: 8px; overflow: hidden;">
      <div style="background-color: #e11d48; color: #ffffff; padding: 18px 24px;">
        <h2 style="margin: 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px;">
          🚨 Critical Security Incident Alert
        </h2>
        <p style="margin: 6px 0 0 0; font-size: 13px; opacity: 0.9;">
          Gyan VaniAi Enterprise Security & Compliance Telemetry
        </p>
      </div>

      <div style="padding: 24px; background-color: #ffffff; color: #1e293b; font-size: 14px; line-height: 1.6;">
        <div style="background-color: #fff1f2; border-left: 4px solid #e11d48; padding: 12px 16px; margin-bottom: 20px; font-size: 13px;">
          <strong style="color: #9f1239;">Mandatory Statutory Timeline:</strong><br>
          Under CERT-In Directions 2022 and DPDP Act 2023 §8(6), cyber security incidents and personal data breaches must be reviewed and reported within <strong>6 hours of detection</strong>.<br>
          <strong>Statutory Filing Due:</strong> ${incident.certInDeadlineIst} (IST)
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; font-weight: bold; width: 180px; color: #64748b;">Incident Trigger:</td>
            <td style="padding: 8px 0; font-family: monospace; color: #e11d48; font-weight: bold;">${incident.action}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Originating IP:</td>
            <td style="padding: 8px 0; font-family: monospace;">${incident.ipAddress}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Actor / User:</td>
            <td style="padding: 8px 0;">${incident.actorEmail}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 8px 0; font-weight: bold; color: #64748b;">Detected At (UTC):</td>
            <td style="padding: 8px 0;">${incident.detectedAt}</td>
          </tr>
        </table>

        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 20px;">
          <strong style="font-size: 12px; color: #475569; text-transform: uppercase;">Sanitized Incident Metadata:</strong>
          <pre style="margin: 8px 0 0 0; font-size: 12px; white-space: pre-wrap; word-break: break-all;">${JSON.stringify(incident.metadata, null, 2)}</pre>
        </div>

        <p style="margin: 0; font-size: 12px; color: #64748b;">
          This is an automated high-priority compliance notification generated by GyanVaniAi Admin Security Engine.<br>
          For incident escalation, contact the designated Grievance Redressal Officer at ${to}.
        </p>
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Gyan VaniAi Security" <${user}>`,
    to,
    subject: `[SECURITY ALERT] ${incident.action} Detected - CERT-In 6-Hour SLA`,
    html,
  });
}
