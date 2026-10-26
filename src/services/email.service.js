import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import {
  buildPortfolioAdminNotificationEmail,
  buildCrmAdminNotificationEmail,
  buildPortfolioConfirmationEmail,
  buildCrmConfirmationEmail,
} from './leadEmailTemplates.js';

dotenv.config();

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, ''); // strip spaces from app password

  if (!user || !pass) {
    console.warn('⚠️ SMTP_USER or SMTP_PASS is missing in environment variables. Email sending is currently disabled.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: true,
    },
  });

  return transporter;
}

/**
 * Verify SMTP connection and credentials
 */
export async function verifySmtpConnection() {
  const client = getTransporter();
  if (!client) {
    return { ok: false, error: 'SMTP credentials (SMTP_USER or SMTP_PASS) not configured.' };
  }
  try {
    await client.verify();
    return { ok: true, message: 'SMTP connection established successfully.' };
  } catch (err) {
    console.error('SMTP Connection Verification Failed:', err);
    return { ok: false, error: err.message };
  }
}

/**
 * Double Opt-In Confirmation Email
 * Sent when NEWSLETTER_DOUBLE_OPT_IN is enabled
 */
export async function sendConfirmationEmail({ to, confirmationUrl, policyVersion = '2026.1' }) {
  const client = getTransporter();
  if (!client) {
    console.warn(`[DEV EMAIL MOCK] Double Opt-In Email for ${to}: ${confirmationUrl}`);
    return { ok: true, mocked: true };
  }

  const fromName = process.env.SMTP_FROM_NAME || 'GyanVaniAi Insights';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Your Subscription</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; margin: 0; padding: 30px 15px; color: #f8fafc; }
    .container { max-width: 560px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 40px 32px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
    .logo { font-size: 20px; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 16px; line-height: 1.3; }
    p { font-size: 15px; line-height: 1.6; color: #94a3b8; margin-bottom: 24px; }
    .cta-btn { display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4); }
    .footer { font-size: 12px; color: #64748b; margin-top: 36px; border-top: 1px solid #334155; padding-top: 20px; line-height: 1.5; }
    .link { color: #818cf8; word-break: break-all; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">GyanVaniAi</div>
    <h1>Confirm Your Subscription</h1>
    <p>Thank you for requesting to receive technical articles, architectural whitepapers, and product updates from GyanVaniAi.</p>
    <p>Please click the button below to verify your email address and activate your subscription:</p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="${confirmationUrl}" class="cta-btn" target="_blank">Confirm Subscription</a>
    </div>
    <p style="font-size: 13px;">If the button above does not work, copy and paste this verification URL into your browser:</p>
    <p style="font-size: 13px;"><a href="${confirmationUrl}" class="link">${confirmationUrl}</a></p>
    <div class="footer">
      This link will expire in 24 hours. If you did not request this newsletter, no further action is required and you will not be subscribed.<br>
      Privacy Policy Version: ${policyVersion} • GyanVaniAi Engineering
    </div>
  </div>
</body>
</html>`;

  const text = `Confirm your GyanVaniAi subscription:
Please visit the following URL to confirm your email:
${confirmationUrl}

If you did not request this, please ignore this email. Link expires in 24 hours.`;

  return client.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: 'Confirm your GyanVaniAi Newsletter Subscription',
    html,
    text,
  });
}

/**
 * Welcome Email with RFC 8058 One-Click List-Unsubscribe Headers
 */
export async function sendWelcomeEmail({ to, unsubscribeUrl }) {
  const client = getTransporter();
  if (!client) {
    console.warn(`[DEV EMAIL MOCK] Welcome Email for ${to}. Unsubscribe URL: ${unsubscribeUrl}`);
    return { ok: true, mocked: true };
  }

  const fromName = process.env.SMTP_FROM_NAME || 'GyanVaniAi Engineering';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to GyanVaniAi</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; margin: 0; padding: 30px 15px; color: #f8fafc; }
    .container { max-width: 560px; margin: 0 auto; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 40px 32px; }
    .logo { font-size: 20px; font-weight: 800; color: #6366f1; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 16px; }
    p { font-size: 15px; line-height: 1.6; color: #94a3b8; margin-bottom: 20px; }
    .footer { font-size: 12px; color: #64748b; margin-top: 36px; border-top: 1px solid #334155; padding-top: 20px; line-height: 1.5; }
    .footer a { color: #818cf8; text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">GyanVaniAi</div>
    <h1>You're Subscribed!</h1>
    <p>Welcome to GyanVaniAi Engineering updates. You'll receive practical insights on enterprise AI architecture, RAG systems, and voice intelligence.</p>
    <p>We respect your inbox: zero spam, strictly high-value engineering deep dives.</p>
    <div class="footer">
      You are receiving this email because you subscribed on gyanvaniai.com.<br>
      To opt out anytime with one click, <a href="${unsubscribeUrl}">unsubscribe here</a>.
    </div>
  </div>
</body>
</html>`;

  const text = `Welcome to GyanVaniAi Engineering Updates!

You are subscribed to receive technical articles and updates.
To opt out at any time, visit: ${unsubscribeUrl}`;

  // RFC 8058 One-Click List-Unsubscribe Header Integration
  const headers = {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };

  return client.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject: 'Welcome to GyanVaniAi Engineering Updates',
    html,
    text,
    headers,
  });
}

/**
 * Outbound Newsletter Campaign Dispatcher
 * Injects RFC 8058 List-Unsubscribe headers and mandatory unsubscribe footers
 */
export async function sendCampaignEmail({ to, subject, htmlContent, textContent, unsubscribeUrl }) {
  const client = getTransporter();
  if (!client) {
    throw new Error('SMTP client is not configured.');
  }

  const fromName = process.env.SMTP_FROM_NAME || 'GyanVaniAi';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  const wrappedHtml = `${htmlContent}
<br><hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 30px 0;"><div style="font-size: 12px; color: #64748b; text-align: center;">
  You are receiving this campaign as a subscriber to GyanVaniAi.<br>
  <a href="${unsubscribeUrl}" style="color: #6366f1; text-decoration: underline;">Click here to unsubscribe with one click</a>.
</div>`;

  const wrappedText = `${textContent || ''}

----------------------------------------
To unsubscribe from these updates, visit:
${unsubscribeUrl}`;

  const headers = {
    'List-Unsubscribe': `<${unsubscribeUrl}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };

  return client.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to,
    subject,
    html: wrappedHtml,
    text: wrappedText,
    headers,
  });
}

/**
 * Dispatch internal notification to admin team upon new lead submission
 * Routes dynamically to Portfolio or CRM aesthetic template based on lead.channel
 */
export async function sendLeadNotificationToAdmin({ lead }) {
  const client = getTransporter();
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER || 'contact@gyanvaniai.com';

  if (!client) {
    console.log(`[DEV EMAIL MOCK] New Lead Notification to Admin (${adminEmail}): Channel: ${lead.channel || 'crm'}, Lead from ${lead.name} (${lead.email})`);
    return { ok: true, mocked: true };
  }

  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  const isPortfolio = lead.channel === 'portfolio';

  const { fromName, subject, html } = isPortfolio
    ? buildPortfolioAdminNotificationEmail({ lead, adminEmail, fromEmail })
    : buildCrmAdminNotificationEmail({ lead, adminEmail, fromEmail });

  try {
    await client.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: adminEmail,
      subject,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error(`Failed to send admin lead notification email (${lead.channel || 'crm'}):`, err.message);
    return { ok: false, error: err.message };
  }
}

/**
 * Dispatch customer inquiry confirmation receipt to user
 * Routes dynamically to Portfolio or CRM aesthetic template based on lead.channel
 */
export async function sendLeadConfirmationToUser({ lead }) {
  const client = getTransporter();
  const isPortfolio = lead.channel === 'portfolio';

  if (!client) {
    console.log(`[DEV EMAIL MOCK] Lead Confirmation (${lead.channel || 'crm'}) to User (${lead.email}): Received request`);
    return { ok: true, mocked: true };
  }

  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;
  const siteUrl = isPortfolio
    ? (process.env.PUBLIC_PORTFOLIO_URL || 'https://hkbharti77.website')
    : (process.env.PUBLIC_WEBSITE_URL || 'https://www.gyanvaniai.com');
  const whatsappUrl = 'https://wa.me/918700620913?text=Hi%20Himanshu%2C%20I%20would%20like%20to%20connect%20regarding%20my%20recent%20inquiry.';

  const { fromName, replyTo, subject, html, text } = isPortfolio
    ? buildPortfolioConfirmationEmail({ lead, siteUrl, whatsappUrl })
    : buildCrmConfirmationEmail({ lead, siteUrl, whatsappUrl });

  try {
    await client.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: lead.email,
      replyTo: replyTo || fromEmail,
      subject,
      html,
      text,
    });
    return { ok: true };
  } catch (err) {
    console.warn(`Failed to send user lead confirmation email (${lead.channel || 'crm'}):`, err.message);
    return { ok: false, error: err.message };
  }
}
