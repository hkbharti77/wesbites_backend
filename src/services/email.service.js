
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
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
 */
export async function sendLeadNotificationToAdmin({ lead }) {
  const client = getTransporter();
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.SMTP_USER || 'contact@gyanvaniai.com';

  if (!client) {
    console.log(`[DEV EMAIL MOCK] New Lead Notification to Admin (${adminEmail}): Lead from ${lead.name} (${lead.email})`);
    return { ok: true, mocked: true };
  }

  const fromName = process.env.SMTP_FROM_NAME || 'GyanVaniAi Lead Engine';
  const fromEmail = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER;

  const html = `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 32px; }
    .badge { display: inline-block; background: #4f46e5; color: white; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 16px; }
    h2 { margin: 0 0 16px 0; color: #fff; }
    .field { margin-bottom: 12px; font-size: 14px; }
    .label { color: #94a3b8; font-weight: 500; }
    .val { color: #f8fafc; font-weight: 600; }
    .msg-box { background: #0f172a; border: 1px solid #334155; padding: 16px; border-radius: 8px; margin-top: 16px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; }
    .footer { margin-top: 24px; font-size: 12px; color: #64748b; border-top: 1px solid #334155; padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">New Lead Received</div>
    <h2>Lead from ${lead.name}</h2>
    <div class="field"><span class="label">Email:</span> <span class="val">${lead.email}</span></div>
    ${lead.phone ? `<div class="field"><span class="label">Phone:</span> <span class="val">${lead.phone}</span></div>` : ''}
    ${lead.company ? `<div class="field"><span class="label">Company:</span> <span class="val">${lead.company}</span></div>` : ''}
    <div class="field"><span class="label">Channel:</span> <span class="val" style="color: #38bdf8;">${lead.channel === 'portfolio' ? '💼 Portfolio Website' : '🏢 SaaS CRM'}</span></div>
    <div class="field"><span class="label">Source:</span> <span class="val">${lead.source || 'Website'}</span></div>
    <div class="field"><span class="label">Timestamp:</span> <span class="val">${new Date(lead.createdAt).toLocaleString()}</span></div>
    
    <div class="label" style="margin-top: 16px;">Message / Inquiry:</div>
    <div class="msg-box">${lead.message}</div>

    <div class="footer">
      GyanVaniAi CMS Lead Management • Channel: ${lead.channel || 'crm'} • Manage this lead in your Admin Console.
    </div>
  </div>
</body>
</html>`;

  try {
    const channelTag = lead.channel === 'portfolio' ? '💼 Portfolio' : '🏢 CRM';
    await client.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: adminEmail,
      subject: `🚨 [${channelTag}] New Inquiry: ${lead.name} (${lead.company || lead.email})`,
      html,
    });
    return { ok: true };
  } catch (err) {
    console.error('Failed to send admin lead notification email:', err.message);
    return { ok: false, error: err.message };
  }
}

/**
/**
 * Helper to build personalized confirmation email for portfolio inquiries (Himanshu Bharti)
 */
function buildPortfolioConfirmationEmail({ lead, siteUrl, whatsappUrl }) {
  const fromName = 'Himanshu Bharti';
  const replyTo = 'hkbharti77@gmail.com';
  const subject = `Thank you for reaching out — Himanshu Bharti`;

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; padding: 12px !important; }
      .service-col { display: block !important; width: 100% !important; margin-bottom: 12px !important; }
      .hero-title { font-size: 22px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #0b0f19; color: #f1f5f9;">
  <center>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0f19;">
      <tr>
        <td align="center" style="padding: 10px;">
          <!-- Main Container -->
          <table border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="max-width: 600px; width: 100%; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
            
            <!-- Portfolio Header Banner -->
            <tr>
              <td align="center" style="background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%); padding: 36px 30px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="center">
                      <div style="display: inline-block; background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(165, 180, 252, 0.3); padding: 6px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; color: #a5b4fc; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px;">
                        Direct Consultation &amp; Inquiry
                      </div>
                      <h1 class="hero-title" style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                        Himanshu Bharti
                      </h1>
                      <p style="margin: 8px 0 0 0; font-size: 14px; color: #c7d2fe; line-height: 1.5;">
                        Software Engineer &bull; Generative AI, RAG &amp; Full Stack Architecture
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Welcome & Personal Receipt Section -->
            <tr>
              <td style="padding: 32px 30px 20px 30px;">
                <h2 style="margin: 0 0 14px 0; font-size: 20px; font-weight: 700; color: #ffffff;">
                  Hello ${lead.name || 'there'},
                </h2>
                <p style="margin: 0 0 16px 0; font-size: 15px; color: #94a3b8; line-height: 1.6;">
                  Thank you for reaching out through my portfolio website! I have received your message regarding <strong style="color: #f8fafc;">${lead.subject || 'your inquiry'}</strong>.
                </p>
                <p style="margin: 0 0 20px 0; font-size: 15px; color: #94a3b8; line-height: 1.6;">
                  I personally review every inquiry and project brief. I will get back to you with technical thoughts and next steps within <strong style="color: #10b981;">24 hours</strong>.
                </p>

                <!-- Submission Summary Card -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; border: 1px solid #1e293b; border-radius: 12px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 16px 20px;">
                      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #818cf8; margin-bottom: 8px;">
                        📋 Your Message Details
                      </div>
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
                        <tr>
                          <td style="padding: 4px 0; color: #64748b; width: 90px;">Name:</td>
                          <td style="padding: 4px 0; color: #f1f5f9; font-weight: 600;">${lead.name}</td>
                        </tr>
                        <tr>
                          <td style="padding: 4px 0; color: #64748b;">Email:</td>
                          <td style="padding: 4px 0; color: #818cf8; font-family: monospace;">${lead.email}</td>
                        </tr>
                        ${lead.phone ? `<tr>
                          <td style="padding: 4px 0; color: #64748b;">Phone:</td>
                          <td style="padding: 4px 0; color: #f1f5f9; font-family: monospace;">${lead.phone}</td>
                        </tr>` : ''}
                        ${lead.company ? `<tr>
                          <td style="padding: 4px 0; color: #64748b;">Company:</td>
                          <td style="padding: 4px 0; color: #f1f5f9; font-weight: 600;">${lead.company}</td>
                        </tr>` : ''}
                        <tr>
                          <td style="padding: 6px 0 0 0; color: #64748b; vertical-align: top;">Message:</td>
                          <td style="padding: 6px 0 0 0; color: #cbd5e1; line-height: 1.5; font-style: italic;">&ldquo;${lead.message}&rdquo;</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Technical Domains Section -->
            <tr>
              <td style="padding: 0 30px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="center" style="border-top: 1px solid #1f2937; padding-top: 24px; padding-bottom: 16px;">
                      <span style="background-color: #1e1b4b; color: #a5b4fc; padding: 5px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                        Core Engineering Expertise
                      </span>
                      <h3 style="margin: 12px 0 6px 0; font-size: 18px; font-weight: 700; color: #ffffff;">
                        What I Build &amp; Specialize In
                      </h3>
                      <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                        High-performance AI applications, scalable microservices, and modern web software.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Skills Grid -->
            <tr>
              <td style="padding: 10px 30px 24px 30px;">
                
                <!-- Skill 1 -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; margin-bottom: 12px;">
                  <tr>
                    <td style="padding: 16px 20px;">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td width="36" valign="top" style="padding-right: 12px;">
                            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(99, 102, 241, 0.2); text-align: center; line-height: 36px; font-size: 18px;">
                              🧠
                            </div>
                          </td>
                          <td valign="top">
                            <h4 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #ffffff;">
                              Generative AI, RAG &amp; LLM Orchestration
                            </h4>
                            <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                              Autonomous agent workflows with LangChain, LlamaIndex, Vector DBs (Pinecone/Milvus), and OpenAI/Claude/OpenRouter APIs.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Skill 2 -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; margin-bottom: 12px;">
                  <tr>
                    <td style="padding: 16px 20px;">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td width="36" valign="top" style="padding-right: 12px;">
                            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(16, 185, 129, 0.2); text-align: center; line-height: 36px; font-size: 18px;">
                              💻
                            </div>
                          </td>
                          <td valign="top">
                            <h4 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #ffffff;">
                              Full Stack Architecture &amp; REST/WebSocket APIs
                            </h4>
                            <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                              FastAPI (Python), Node.js, Express, React, TypeScript, TailwindCSS, MongoDB, PostgreSQL, and real-time state synchronization.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Skill 3 -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; margin-bottom: 12px;">
                  <tr>
                    <td style="padding: 16px 20px;">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td width="36" valign="top" style="padding-right: 12px;">
                            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(56, 189, 248, 0.2); text-align: center; line-height: 36px; font-size: 18px;">
                              ⚡
                            </div>
                          </td>
                          <td valign="top">
                            <h4 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #ffffff;">
                              Cloud Infrastructure, DevOps &amp; Production Deployments
                            </h4>
                            <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                              Docker containerization, CI/CD pipelines, Vercel edge deployments, AWS infrastructure, and DPDP-compliant data handling.
                            </p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>

            <!-- Fast-Track WhatsApp CTA Section -->
            <tr>
              <td align="center" style="background: linear-gradient(180deg, #111827 0%, #0f172a 100%); padding: 24px 30px; border-top: 1px solid #1f2937;">
                <p style="margin: 0 0 14px 0; font-size: 14px; font-weight: 600; color: #ffffff;">
                  Need an urgent consultation or want to discuss a project directly?
                </p>
                <table border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="border-radius: 10px; background-color: #25D366; padding: 12px 24px; box-shadow: 0 4px 14px rgba(37, 211, 102, 0.35);">
                      <a href="${whatsappUrl}" target="_blank" style="font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; display: inline-block;">
                        💬 Chat on WhatsApp (+91 87006 20913) &rarr;
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 16px 0 0 0; font-size: 12px; color: #94a3b8;">
                  Connect with me: 
                  <a href="https://github.com/hkbharti77" target="_blank" style="color: #818cf8; text-decoration: underline; margin: 0 6px;">GitHub</a> &bull;
                  <a href="https://www.linkedin.com/in/himanshu-bharti-81a5a618a" target="_blank" style="color: #818cf8; text-decoration: underline; margin: 0 6px;">LinkedIn</a> &bull;
                  <a href="${siteUrl}" target="_blank" style="color: #818cf8; text-decoration: underline; margin: 0 6px;">Portfolio Site</a>
                </p>
              </td>
            </tr>

            <!-- Footer Compliance & Personal Details -->
            <tr>
              <td style="background-color: #0b0f19; padding: 24px 30px; border-top: 1px solid #1e293b; text-align: center;">
                <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
                  &copy; 2026 Himanshu Bharti. All rights reserved.
                </p>
                <p style="margin: 0 0 10px 0; font-size: 11px; color: #475569; line-height: 1.5;">
                  Himanshu Bharti &bull; Software Engineer &bull; Delhi NCR, India &bull; Direct: <a href="mailto:hkbharti77@gmail.com" style="color: #6366f1;">hkbharti77@gmail.com</a>
                </p>
                <p style="margin: 0; font-size: 10px; color: #334155;">
                  This email was sent in response to your inquiry submitted on my portfolio website. Processed under India's Digital Personal Data Protection (DPDP) Act, 2023.
                </p>
              </td>
            </tr>

          </table>
          <!-- End Container -->
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;

  const text = `
Hello ${lead.name || 'there'},

Thank you for reaching out through my portfolio website! I have received your message regarding: ${lead.subject || 'your inquiry'}.

I personally review all messages and project briefs. I will get back to you with next steps within 24 hours.

--- YOUR MESSAGE DETAILS ---
Name: ${lead.name}
Email: ${lead.email}
${lead.phone ? `Phone: ${lead.phone}\n` : ''}${lead.company ? `Company: ${lead.company}\n` : ''}Message: ${lead.message}

--- CORE SPECIALIZATIONS ---
1. Generative AI, RAG & LLMs (LangChain, Vector DBs, Autonomous Agents)
2. Full Stack Engineering (FastAPI, Node.js, Express, React, TypeScript, MongoDB, PostgreSQL)
3. Cloud Infrastructure & DevOps (Docker, CI/CD, Production Edge Deployments)

--- DIRECT CONNECT ---
WhatsApp: +91 87006 20913 (${whatsappUrl})
Portfolio: ${siteUrl}
GitHub: https://github.com/hkbharti77
LinkedIn: https://www.linkedin.com/in/himanshu-bharti-81a5a618a
Direct Email: hkbharti77@gmail.com

© 2026 Himanshu Bharti. All rights reserved.
`.trim();

  return { fromName, replyTo, subject, html, text };
}

/**
 * Helper to build marketing consultation receipt for SaaS CRM inquiries (GyanVaniAi)
 */
function buildCrmConfirmationEmail({ lead, siteUrl, whatsappUrl }) {
  const fromName = process.env.SMTP_FROM_NAME || 'GyanVaniAi Technologies';
  const replyTo = process.env.SMTP_FROM_EMAIL || 'contact@gyanvaniai.com';
  const subject = `Welcome to GyanVaniAi — Inbound Consultation Received`;

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; padding: 12px !important; }
      .service-col { display: block !important; width: 100% !important; margin-bottom: 12px !important; }
      .hero-title { font-size: 22px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #0b0f19; color: #f1f5f9;">
  <center>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0f19;">
      <tr>
        <td align="center" style="padding: 10px;">
          <!-- Main Container -->
          <table border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="max-width: 600px; width: 100%; background-color: #111827; border: 1px solid #1f2937; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
            
            <!-- Brand Header Banner -->
            <tr>
              <td align="center" style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4338ca 100%); padding: 36px 30px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="center">
                      <div style="display: inline-block; background: rgba(255,255,255,0.12); padding: 6px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; color: #a5b4fc; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px;">
                        Autonomous AI &amp; Revenue Operations
                      </div>
                      <h1 class="hero-title" style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                        Gyan VaniAi Technologies
                      </h1>
                      <p style="margin: 8px 0 0 0; font-size: 14px; color: #c7d2fe; line-height: 1.5;">
                        Next-Generation AI CRM, Voice Calling Bots &amp; Conversational Commerce
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Welcome & Receipt Section -->
            <tr>
              <td style="padding: 32px 30px 20px 30px;">
                <h2 style="margin: 0 0 14px 0; font-size: 20px; font-weight: 700; color: #ffffff;">
                  Hello ${lead.name || 'there'},
                </h2>
                <p style="margin: 0 0 16px 0; font-size: 15px; color: #94a3b8; line-height: 1.6;">
                  Thank you for reaching out! We have successfully received your consultation request regarding <strong style="color: #f8fafc;">${lead.subject || 'AI CRM Solutions'}</strong>.
                </p>
                <p style="margin: 0 0 20px 0; font-size: 15px; color: #94a3b8; line-height: 1.6;">
                  Our solutions architecture team has been notified. A senior specialist will review your workflow challenges and get back to you with tailored technical recommendations within <strong style="color: #10b981;">24 hours</strong>.
                </p>

                <!-- Submission Summary Card -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0f172a; border: 1px solid #1e293b; border-radius: 12px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 16px 20px;">
                      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #6366f1; margin-bottom: 8px;">
                        📋 Request Summary
                      </div>
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
                        <tr>
                          <td style="padding: 4px 0; color: #64748b; width: 90px;">Prospect:</td>
                          <td style="padding: 4px 0; color: #f1f5f9; font-weight: 600;">${lead.name}</td>
                        </tr>
                        <tr>
                          <td style="padding: 4px 0; color: #64748b;">Work Email:</td>
                          <td style="padding: 4px 0; color: #818cf8; font-family: monospace;">${lead.email}</td>
                        </tr>
                        ${lead.company ? `<tr>
                          <td style="padding: 4px 0; color: #64748b;">Company:</td>
                          <td style="padding: 4px 0; color: #f1f5f9; font-weight: 600;">${lead.company}</td>
                        </tr>` : ''}
                        ${lead.phone ? `<tr>
                          <td style="padding: 4px 0; color: #64748b;">Phone:</td>
                          <td style="padding: 4px 0; color: #f1f5f9; font-family: monospace;">${lead.phone}</td>
                        </tr>` : ''}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Divider with Title -->
            <tr>
              <td style="padding: 0 30px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="center" style="border-top: 1px solid #1f2937; padding-top: 24px; padding-bottom: 16px;">
                      <span style="background-color: #1e1b4b; color: #a5b4fc; padding: 5px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                        Explore Our Core AI Solutions
                      </span>
                      <h3 style="margin: 12px 0 6px 0; font-size: 18px; font-weight: 700; color: #ffffff;">
                        How Gyan VaniAi Scales Your Revenue Pipeline
                      </h3>
                      <p style="margin: 0; font-size: 13px; color: #94a3b8;">
                        Tailored enterprise software designed for high-velocity sales and automated operations.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Marketing Services Grid -->
            <tr>
              <td style="padding: 10px 30px 24px 30px;">
                
                <!-- Service 1: Custom AI CRM -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; margin-bottom: 12px;">
                  <tr>
                    <td style="padding: 16px 20px;">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td width="36" valign="top" style="padding-right: 12px;">
                            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(99, 102, 241, 0.2); text-align: center; line-height: 36px; font-size: 18px;">
                              🚀
                            </div>
                          </td>
                          <td valign="top">
                            <h4 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #ffffff;">
                              Custom AI CRM &amp; Revenue Operations
                            </h4>
                            <p style="margin: 0 0 8px 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                              Autonomous lead qualification, dynamic scoring, and automated omnichannel routing that turns inbound clicks into closed revenue.
                            </p>
                            <a href="${siteUrl}/services/crm-development" style="color: #818cf8; font-size: 12px; font-weight: 600; text-decoration: none;">
                              Explore CRM Platform &rarr;
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Service 2: WhatsApp Automation & Catalog CRM -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; margin-bottom: 12px;">
                  <tr>
                    <td style="padding: 16px 20px;">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td width="36" valign="top" style="padding-right: 12px;">
                            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(16, 185, 129, 0.2); text-align: center; line-height: 36px; font-size: 18px;">
                              💬
                            </div>
                          </td>
                          <td valign="top">
                            <h4 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #ffffff;">
                              WhatsApp Coexistence &amp; Catalog CRM
                            </h4>
                            <p style="margin: 0 0 8px 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                              Official WhatsApp Cloud API integration with automated catalogs, conversational checkout, and zero message drop-offs.
                            </p>
                            <a href="${siteUrl}/services/whatsapp-automation" style="color: #34d399; font-size: 12px; font-weight: 600; text-decoration: none;">
                              Discover WhatsApp Automation &rarr;
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Service 3: Voice AI Assistants & Calling Agents -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; margin-bottom: 12px;">
                  <tr>
                    <td style="padding: 16px 20px;">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td width="36" valign="top" style="padding-right: 12px;">
                            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(56, 189, 248, 0.2); text-align: center; line-height: 36px; font-size: 18px;">
                              🎙️
                            </div>
                          </td>
                          <td valign="top">
                            <h4 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #ffffff;">
                              Autonomous AI Calling Agents &amp; Voice Bots
                            </h4>
                            <p style="margin: 0 0 8px 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                              Sub-450ms human-like conversational voice agents for high-volume qualification, appointments, and 24/7 support.
                            </p>
                            <a href="${siteUrl}/services/voice-bot-assistant" style="color: #38bdf8; font-size: 12px; font-weight: 600; text-decoration: none;">
                              Listen to Voice AI Demos &rarr;
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Service 4: Multi-Agent AI & Enterprise RAG -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 12px; margin-bottom: 12px;">
                  <tr>
                    <td style="padding: 16px 20px;">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td width="36" valign="top" style="padding-right: 12px;">
                            <div style="width: 36px; height: 36px; border-radius: 8px; background: rgba(245, 158, 11, 0.2); text-align: center; line-height: 36px; font-size: 18px;">
                              ⚡
                            </div>
                          </td>
                          <td valign="top">
                            <h4 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #ffffff;">
                              AI Agents, Tool Calling &amp; Secure RAG
                            </h4>
                            <p style="margin: 0 0 8px 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                              Connect internal systems and private documents to autonomous agent workflows with strict DPDP compliance and zero data leakage.
                            </p>
                            <a href="${siteUrl}/services/ai-agent-development" style="color: #fbbf24; font-size: 12px; font-weight: 600; text-decoration: none;">
                              Explore AI Agent Architectures &rarr;
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>

            <!-- Fast-Track WhatsApp CTA Section -->
            <tr>
              <td align="center" style="background: linear-gradient(180deg, #111827 0%, #0f172a 100%); padding: 24px 30px; border-top: 1px solid #1f2937;">
                <p style="margin: 0 0 14px 0; font-size: 14px; font-weight: 600; color: #ffffff;">
                  Prefer immediate consultation or urgent enterprise deployment?
                </p>
                <table border="0" cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="center" style="border-radius: 10px; background-color: #25D366; padding: 12px 24px; box-shadow: 0 4px 14px rgba(37, 211, 102, 0.35);">
                      <a href="${whatsappUrl}" target="_blank" style="font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; display: inline-block;">
                        💬 Chat on WhatsApp (+91 87006 20913) &rarr;
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 14px 0 0 0; font-size: 12px; color: #64748b;">
                  Or browse our platform live: <a href="${siteUrl}" style="color: #818cf8; text-decoration: underline;">www.gyanvaniai.com</a>
                </p>
              </td>
            </tr>

            <!-- Footer Compliance & Company Details -->
            <tr>
              <td style="background-color: #0b0f19; padding: 24px 30px; border-top: 1px solid #1e293b; text-align: center;">
                <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
                  &copy; 2026 Gyan VaniAi Technologies. All rights reserved.
                </p>
                <p style="margin: 0 0 10px 0; font-size: 11px; color: #475569; line-height: 1.5;">
                  Office: Gyan VaniAi Technologies, New Delhi, India &bull; Direct Support: <a href="mailto:contact@gyanvaniai.com" style="color: #6366f1;">contact@gyanvaniai.com</a>
                </p>
                <p style="margin: 0; font-size: 10px; color: #334155;">
                  This email was sent in response to your demo and consultation request on our website. Processed under India's Digital Personal Data Protection (DPDP) Act, 2023.
                </p>
              </td>
            </tr>

          </table>
          <!-- End Container -->
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;

  const text = `
Hello ${lead.name || 'there'},

Thank you for reaching out to GyanVaniAi Technologies! We have received your consultation and demo request.

Our senior solutions architect team has been notified and will review your workflow challenges to get back to you within 24 hours.

--- REQUEST SUMMARY ---
Prospect: ${lead.name}
Email: ${lead.email}
Company: ${lead.company || 'Individual'}
Phone: ${lead.phone || 'Not provided'}
Inquiry: ${lead.message}

--- OUR CORE AI SERVICES ---
1. Custom AI CRM & Revenue Operations
   Autonomous lead scoring, dynamic deal pipelines, and skill-based assignment.
   Learn more: ${siteUrl}/services/crm-development

2. WhatsApp Coexistence & Catalog CRM
   Official WhatsApp Cloud API integration with automated catalogs and conversational checkout.
   Learn more: ${siteUrl}/services/whatsapp-automation

3. Autonomous Voice AI Calling Agents
   Ultra-low latency voice agents for inbound support and outbound qualification calls.
   Learn more: ${siteUrl}/services/voice-bot-assistant

4. Enterprise AI Agents & Secure RAG
   Multi-agent orchestration and private enterprise knowledge bases.
   Learn more: ${siteUrl}/services/ai-agent-development

--- IMMEDIATE ASSISTANCE ---
Prefer an instant consultation?
Chat with our engineering team on WhatsApp: +91 87006 20913
Link: ${whatsappUrl}

Website: ${siteUrl}
Support: contact@gyanvaniai.com
Gyan VaniAi Technologies, New Delhi, India
`.trim();

  return { fromName, replyTo, subject, html, text };
}

/**
 * Dispatch confirmation receipt + tailored showcase email to prospect
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
    ? (process.env.PUBLIC_PORTFOLIO_URL || 'https://hkbharti77.github.io/My-portfillos/')
    : (process.env.PUBLIC_WEBSITE_URL || 'https://www.gyanvaniai.com');
  const whatsappUrl = 'https://wa.me/918700620913?text=Hi%20Himanshu%2C%20I%20would%20like%20to%20connect%20regarding%20my%20recent%20inquiry.';

  const { fromName, replyTo, subject, html, text } = isPortfolio
    ? buildPortfolioConfirmationEmail({ lead, siteUrl, whatsappUrl, fromEmail })
    : buildCrmConfirmationEmail({ lead, siteUrl, whatsappUrl, fromEmail });

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
