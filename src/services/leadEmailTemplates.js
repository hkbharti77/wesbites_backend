/**
 * Channel-Isolated Email Templates for Inbound Leads
 * 
 * Channel 'portfolio': Himanshu Bharti Systems Studio
 *  - Theme: Broadsheet Editorial / Dark Obsidian (#131411) / Warm Cream (#f2f0e6) / Olive Bronze (#8a8f70)
 *  - Tone: Direct Senior Systems Engineer, Mutual NDA Protocol, Empirical AI Specs ($3.5k/$8.5k/$18.5k tiers)
 * 
 * Channel 'crm': Gyan Vani AI Technologies
 *  - Theme: Ultra-Modern Enterprise SaaS / Deep Space Navy (#070d1d) / Electric Emerald (#10b981) / Cyber Cyan (#06b6d4)
 *  - Tone: Enterprise Solutions Architecture, WhatsApp Coexistence CRM, Calling Bots, Revenue Automation
 */

/**
 * 1. Admin Notification — PORTFOLIO Channel
 * Broadcasts technical inquest dispatch to engineer (Himanshu)
 */
export function buildPortfolioAdminNotificationEmail({ lead, adminEmail, fromEmail }) {
  const fromName = 'Himanshu Bharti Systems Studio';
  const hasNda = Boolean(lead.ndaRequired);
  const subject = `⚖️ [PORTFOLIO INQUEST] ${lead.name} (${lead.company || lead.email}) ${hasNda ? '— [MUTUAL NDA REQUESTED]' : ''}`;

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #0b0c09; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f2f0e6;">
  <center>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0b0c09;">
      <tr>
        <td align="center" style="padding: 12px;">
          <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; background-color: #131411; border: 1px solid #2d3027; border-radius: 12px; overflow: hidden; box-shadow: 0 16px 36px rgba(0,0,0,0.6);">
            
            <!-- Broadsheet Header -->
            <tr>
              <td style="background-color: #1a1c17; border-bottom: 2px solid #8a8f70; padding: 28px 30px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td>
                      <div style="display: inline-block; background-color: #262920; border: 1px solid #454a3a; color: #c9a96e; padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px;">
                        Portfolio Dispatch &bull; Systems Studio
                      </div>
                      <h1 style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 700; color: #f2f0e6; letter-spacing: -0.3px;">
                        New Technical Inquest Received
                      </h1>
                      <p style="margin: 6px 0 0 0; font-size: 13px; color: #a4a899;">
                        Direct engineering dispatch via <strong style="color: #c9a96e;">hkbharti77.website</strong>
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Mutual NDA Alert Banner (if requested) -->
            ${hasNda ? `
            <tr>
              <td style="padding: 16px 30px 0 30px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #241b0b; border: 1px solid #b45309; border-radius: 8px;">
                  <tr>
                    <td style="padding: 12px 16px;">
                      <div style="font-size: 13px; font-weight: 700; color: #fde68a; margin-bottom: 4px;">
                        ⚖️ Mutual Non-Disclosure Agreement (NDA) Requested
                      </div>
                      <div style="font-size: 12px; color: #fef3c7; line-height: 1.5;">
                        The client checked the bilateral NDA requirement. Execute standard reciprocal agreement prior to repository access or architecture review.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ` : ''}

            <!-- Inquirer Metadata Table -->
            <tr>
              <td style="padding: 24px 30px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #181a15; border: 1px solid #282b22; border-radius: 8px; margin-bottom: 20px;">
                  <tr>
                    <td style="padding: 16px 20px;">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
                        <tr>
                          <td style="padding: 6px 0; color: #787c6e; width: 120px; font-weight: 600;">Inquirer:</td>
                          <td style="padding: 6px 0; color: #ffffff; font-weight: 700;">${lead.name}</td>
                        </tr>
                        <tr>
                          <td style="padding: 6px 0; color: #787c6e; font-weight: 600;">Email:</td>
                          <td style="padding: 6px 0;"><a href="mailto:${lead.email}" style="color: #c9a96e; text-decoration: none; font-family: monospace;">${lead.email}</a></td>
                        </tr>
                        ${lead.phone ? `
                        <tr>
                          <td style="padding: 6px 0; color: #787c6e; font-weight: 600;">Phone:</td>
                          <td style="padding: 6px 0;"><a href="tel:${lead.phone}" style="color: #f2f0e6; text-decoration: none; font-family: monospace;">${lead.phone}</a></td>
                        </tr>` : ''}
                        ${lead.company ? `
                        <tr>
                          <td style="padding: 6px 0; color: #787c6e; font-weight: 600;">Organization:</td>
                          <td style="padding: 6px 0; color: #ffffff; font-weight: 600;">${lead.company}</td>
                        </tr>` : ''}
                        <tr>
                          <td style="padding: 6px 0; color: #787c6e; font-weight: 600;">Inquiry Scope:</td>
                          <td style="padding: 6px 0; color: #a4a899;">${lead.subject || 'Portfolio Consultation'}</td>
                        </tr>
                        <tr>
                          <td style="padding: 6px 0; color: #787c6e; font-weight: 600;">Channel:</td>
                          <td style="padding: 6px 0; color: #8a8f70; font-family: monospace; font-weight: 700;">PORTFOLIO</td>
                        </tr>
                        <tr>
                          <td style="padding: 6px 0; color: #787c6e; font-weight: 600;">Statutory Consent:</td>
                          <td style="padding: 6px 0; color: #10b981; font-size: 12px;">✓ Verified (DPDP Act 2023)</td>
                        </tr>
                        <tr>
                          <td style="padding: 6px 0; color: #787c6e; font-weight: 600;">Received At:</td>
                          <td style="padding: 6px 0; color: #787c6e; font-size: 12px;">${new Date(lead.createdAt || Date.now()).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} IST</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Message Box -->
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #8a8f70; margin-bottom: 8px;">
                  Inquest Statement &bull; Project Brief
                </div>
                <div style="background-color: #0d0e0b; border: 1px solid #282b22; border-left: 3px solid #c9a96e; padding: 18px 20px; border-radius: 6px; font-size: 14px; line-height: 1.6; color: #f2f0e6; white-space: pre-wrap;">${lead.message}</div>

                <!-- Action CTA -->
                <table border="0" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
                  <tr>
                    <td style="background-color: #8a8f70; border-radius: 6px; padding: 10px 20px;">
                      <a href="mailto:${lead.email}?subject=Re:%20${encodeURIComponent(lead.subject || 'Technical Consultation')}%20%E2%80%94%20Himanshu%20Bharti" style="color: #131411; font-size: 13px; font-weight: 700; text-decoration: none; display: inline-block;">
                        ✉️ Reply to ${lead.name}
                      </a>
                    </td>
                    ${lead.phone ? `
                    <td style="padding-left: 12px;">
                      <a href="https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}" style="background-color: #24271f; border: 1px solid #3d4133; color: #f2f0e6; font-size: 13px; font-weight: 600; text-decoration: none; padding: 10px 18px; border-radius: 6px; display: inline-block;">
                        💬 Open WhatsApp
                      </a>
                    </td>` : ''}
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color: #0f100d; border-top: 1px solid #24271f; padding: 18px 30px; text-align: center; font-size: 11px; color: #616556;">
                Himanshu Bharti Systems Studio &bull; Systems &amp; AI Engineering &bull; Internal Dispatch Alert
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;

  return { fromName, subject, html };
}

/**
 * 2. Admin Notification — CRM Channel
 * Broadcasts enterprise inbound lead to sales/solutions engineering team
 */
export function buildCrmAdminNotificationEmail({ lead, adminEmail, fromEmail }) {
  const fromName = process.env.SMTP_FROM_NAME || 'GyanVaniAi Lead Engine';
  const subject = `🔥 [CRM INBOUND] New Demo Request: ${lead.name} (${lead.company || lead.email})`;

  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #070d1d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <center>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #070d1d;">
      <tr>
        <td align="center" style="padding: 12px;">
          <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; width: 100%; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 12px; overflow: hidden; box-shadow: 0 16px 36px rgba(0,0,0,0.6);">
            
            <!-- Enterprise Cyan/Emerald Header Banner -->
            <tr>
              <td style="background: linear-gradient(135deg, #064e3b 0%, #0f766e 50%, #0284c7 100%); padding: 28px 30px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td>
                      <div style="display: inline-block; background: rgba(255,255,255,0.15); color: #ffffff; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px;">
                        CRM Inbound Pipeline &bull; New Lead
                      </div>
                      <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.4px;">
                        Enterprise Demo Request
                      </h1>
                      <p style="margin: 6px 0 0 0; font-size: 13px; color: #ccfbf1;">
                        Captured via GyanVaniAi Platform (<a href="https://www.gyanvaniai.com" style="color: #ffffff; text-decoration: underline;">gyanvaniai.com</a>)
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Lead Details Card -->
            <tr>
              <td style="padding: 24px 30px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 8px; margin-bottom: 20px;">
                  <tr>
                    <td style="padding: 16px 20px;">
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
                        <tr>
                          <td style="padding: 6px 0; color: #94a3b8; width: 120px; font-weight: 600;">Prospect Name:</td>
                          <td style="padding: 6px 0; color: #ffffff; font-weight: 700;">${lead.name}</td>
                        </tr>
                        <tr>
                          <td style="padding: 6px 0; color: #94a3b8; font-weight: 600;">Work Email:</td>
                          <td style="padding: 6px 0;"><a href="mailto:${lead.email}" style="color: #38bdf8; text-decoration: none; font-family: monospace;">${lead.email}</a></td>
                        </tr>
                        ${lead.phone ? `
                        <tr>
                          <td style="padding: 6px 0; color: #94a3b8; font-weight: 600;">Phone / WhatsApp:</td>
                          <td style="padding: 6px 0;"><a href="tel:${lead.phone}" style="color: #10b981; font-weight: 600; text-decoration: none; font-family: monospace;">${lead.phone}</a></td>
                        </tr>` : ''}
                        ${lead.company ? `
                        <tr>
                          <td style="padding: 6px 0; color: #94a3b8; font-weight: 600;">Company:</td>
                          <td style="padding: 6px 0; color: #ffffff; font-weight: 700;">${lead.company}</td>
                        </tr>` : ''}
                        <tr>
                          <td style="padding: 6px 0; color: #94a3b8; font-weight: 600;">Channel:</td>
                          <td style="padding: 6px 0; color: #06b6d4; font-family: monospace; font-weight: 700;">CRM</td>
                        </tr>
                        <tr>
                          <td style="padding: 6px 0; color: #94a3b8; font-weight: 600;">Source:</td>
                          <td style="padding: 6px 0; color: #cbd5e1;">${lead.source || 'Website Contact Form'}</td>
                        </tr>
                        <tr>
                          <td style="padding: 6px 0; color: #94a3b8; font-weight: 600;">Compliance:</td>
                          <td style="padding: 6px 0; color: #10b981; font-size: 12px;">✓ DPDP Act 2023 Consent Recorded</td>
                        </tr>
                        <tr>
                          <td style="padding: 6px 0; color: #94a3b8; font-weight: 600;">Timestamp:</td>
                          <td style="padding: 6px 0; color: #94a3b8; font-size: 12px;">${new Date(lead.createdAt || Date.now()).toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} IST</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                <!-- Message Box -->
                <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #38bdf8; margin-bottom: 8px;">
                  Inquiry / Business Requirements
                </div>
                <div style="background-color: #090d16; border: 1px solid #1e293b; border-left: 3px solid #10b981; padding: 18px 20px; border-radius: 6px; font-size: 14px; line-height: 1.6; color: #e2e8f0; white-space: pre-wrap;">${lead.message}</div>

                <!-- Action CTA -->
                <table border="0" cellpadding="0" cellspacing="0" style="margin-top: 24px;">
                  <tr>
                    <td style="background-color: #10b981; border-radius: 6px; padding: 10px 20px;">
                      <a href="mailto:${lead.email}?subject=GyanVaniAi%20Consultation%20%E2%80%94%20Follow-up%20for%20${encodeURIComponent(lead.company || lead.name)}" style="color: #ffffff; font-size: 13px; font-weight: 700; text-decoration: none; display: inline-block;">
                        ✉️ Email Prospect
                      </a>
                    </td>
                    ${lead.phone ? `
                    <td style="padding-left: 12px;">
                      <a href="https://wa.me/${lead.phone.replace(/[^0-9]/g, '')}?text=Hello%20${encodeURIComponent(lead.name)}%2C%20thank%20you%20for%20contacting%20GyanVaniAi%20Technologies." style="background-color: #0369a1; color: #ffffff; font-size: 13px; font-weight: 600; text-decoration: none; padding: 10px 18px; border-radius: 6px; display: inline-block;">
                        💬 WhatsApp Prospect
                      </a>
                    </td>` : ''}
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color: #090d16; border-top: 1px solid #1e293b; padding: 18px 30px; text-align: center; font-size: 11px; color: #64748b;">
                GyanVaniAi Technologies &bull; Enterprise Revenue Operations &bull; Automated Lead Notification
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;

  return { fromName, subject, html };
}

/**
 * 3. User Confirmation — PORTFOLIO Channel
 * Broadsheet Editorial / Dark Obsidian / Warm Cream aesthetic
 */
export function buildPortfolioConfirmationEmail({ lead, siteUrl, whatsappUrl }) {
  const fromName = 'Himanshu Bharti — Systems & AI Engineer';
  const replyTo = 'hkbharti77@gmail.com';
  const hasNda = Boolean(lead.ndaRequired);
  const subject = `Dispatch Received: ${lead.subject || 'Technical Consultation'} — Himanshu Bharti`;
  const canonicalPortfolioUrl = siteUrl || 'https://hkbharti77.website';

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
    body { margin: 0; padding: 0; background-color: #0d0e0b; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; padding: 8px !important; }
      .hero-title { font-size: 22px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #0d0e0b; color: #f2f0e6;">
  <center>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #0d0e0b;">
      <tr>
        <td align="center" style="padding: 10px;">
          <!-- Main Broadsheet Container -->
          <table border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="max-width: 600px; width: 100%; background-color: #131411; border: 1px solid #2d3027; border-radius: 12px; overflow: hidden; box-shadow: 0 20px 48px rgba(0,0,0,0.6);">
            
            <!-- Broadsheet Editorial Header -->
            <tr>
              <td style="background-color: #181a15; border-bottom: 2px solid #8a8f70; padding: 36px 32px 30px 32px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td>
                      <div style="display: inline-block; background-color: #262920; border: 1px solid #454a3a; padding: 5px 12px; border-radius: 4px; font-size: 10px; font-weight: 700; color: #c9a96e; text-transform: uppercase; letter-spacing: 1.8px; margin-bottom: 12px;">
                        Engineering Monograph &bull; Dispatch Receipt
                      </div>
                      <h1 class="hero-title" style="margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 26px; font-weight: 700; color: #f2f0e6; letter-spacing: -0.5px;">
                        Himanshu Bharti
                      </h1>
                      <p style="margin: 8px 0 0 0; font-size: 13px; color: #a4a899; line-height: 1.5;">
                        Senior Systems &amp; AI Engineer &bull; Sub-millisecond Voice &amp; Deterministic State-Graphs
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Personal Letter Body -->
            <tr>
              <td style="padding: 32px 32px 20px 32px;">
                <h2 style="margin: 0 0 14px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 19px; font-weight: 600; color: #f2f0e6;">
                  Hello ${lead.name || 'there'},
                </h2>
                <p style="margin: 0 0 16px 0; font-size: 14px; color: #a4a899; line-height: 1.7;">
                  Thank you for reaching out through my systems engineering portal. I have received your message regarding <strong style="color: #f2f0e6;">${lead.subject || 'your technical inquiry'}</strong>.
                </p>
                <p style="margin: 0 0 20px 0; font-size: 14px; color: #a4a899; line-height: 1.7;">
                  I personally review every inquiry, technical brief, and architectural proposal. You can expect a direct response with technical considerations and next steps within <strong style="color: #c9a96e;">24 hours</strong>.
                </p>

                <!-- Mutual NDA Notice Box (if requested) -->
                ${hasNda ? `
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #241b0b; border: 1px solid #b45309; border-radius: 8px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 14px 18px;">
                      <div style="font-size: 13px; font-weight: 700; color: #fde68a; margin-bottom: 4px;">
                        ⚖️ Bilateral NDA Protocol Active
                      </div>
                      <div style="font-size: 12px; color: #fef3c7; line-height: 1.5;">
                        You marked the Mutual Non-Disclosure Agreement option. A bilateral NDA will be executed prior to any proprietary codebase, schema, or system inspection.
                      </div>
                    </td>
                  </tr>
                </table>
                ` : ''}

                <!-- Submission Summary Card -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #171914; border: 1px solid #282b22; border-radius: 8px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 18px 20px;">
                      <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #8a8f70; margin-bottom: 12px;">
                        📋 Transmitted Inquest Details
                      </div>
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
                        <tr>
                          <td style="padding: 5px 0; color: #787c6e; width: 100px; font-weight: 600;">Inquirer:</td>
                          <td style="padding: 5px 0; color: #f2f0e6; font-weight: 600;">${lead.name}</td>
                        </tr>
                        <tr>
                          <td style="padding: 5px 0; color: #787c6e; font-weight: 600;">Email:</td>
                          <td style="padding: 5px 0; color: #c9a96e; font-family: monospace;">${lead.email}</td>
                        </tr>
                        ${lead.phone ? `
                        <tr>
                          <td style="padding: 5px 0; color: #787c6e; font-weight: 600;">Phone:</td>
                          <td style="padding: 5px 0; color: #f2f0e6; font-family: monospace;">${lead.phone}</td>
                        </tr>` : ''}
                        ${lead.company ? `
                        <tr>
                          <td style="padding: 5px 0; color: #787c6e; font-weight: 600;">Organization:</td>
                          <td style="padding: 5px 0; color: #f2f0e6; font-weight: 600;">${lead.company}</td>
                        </tr>` : ''}
                        <tr>
                          <td style="padding: 8px 0 0 0; color: #787c6e; vertical-align: top; font-weight: 600;">Inquest:</td>
                          <td style="padding: 8px 0 0 0; color: #d5d8cc; line-height: 1.6; font-style: italic;">&ldquo;${lead.message}&rdquo;</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Core Architectural Disciplines -->
            <tr>
              <td style="padding: 0 32px 10px 32px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-top: 1px solid #282b22; padding-top: 24px;">
                  <tr>
                    <td>
                      <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.8px; color: #c9a96e; margin-bottom: 8px;">
                        Engineering Invariants
                      </div>
                      <h3 style="margin: 0 0 16px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 18px; font-weight: 600; color: #f2f0e6;">
                        Core Systems &amp; AI Focus Areas
                      </h3>

                      <!-- Discipline 1 -->
                      <div style="background-color: #171914; border: 1px solid #282b22; border-left: 3px solid #8a8f70; padding: 12px 16px; border-radius: 6px; margin-bottom: 10px;">
                        <div style="font-size: 13px; font-weight: 700; color: #f2f0e6; margin-bottom: 4px;">
                          1. Sub-400ms Voice Orchestration &amp; WebRTC
                        </div>
                        <div style="font-size: 12px; color: #a4a899; line-height: 1.5;">
                          Sliding 30ms Silero VAD frame slicing, Deepgram Nova-2 interim tokens, Claude 3.5 speculative token yield, and ElevenLabs Turbo circular ring buffer playback with drift compensation.
                        </div>
                      </div>

                      <!-- Discipline 2 -->
                      <div style="background-color: #171914; border: 1px solid #282b22; border-left: 3px solid #8a8f70; padding: 12px 16px; border-radius: 6px; margin-bottom: 10px;">
                        <div style="font-size: 13px; font-weight: 700; color: #f2f0e6; margin-bottom: 4px;">
                          2. Deterministic State Graphs &amp; Multi-Agent Swarms
                        </div>
                        <div style="font-size: 12px; color: #a4a899; line-height: 1.5;">
                          LangGraph directed acyclic state graphs with Redis checkpoint persistence, tool idempotency locks, and zero-overhead asynchronous human-in-the-loop pause states.
                        </div>
                      </div>

                      <!-- Discipline 3 -->
                      <div style="background-color: #171914; border: 1px solid #282b22; border-left: 3px solid #8a8f70; padding: 12px 16px; border-radius: 6px; margin-bottom: 16px;">
                        <div style="font-size: 13px; font-weight: 700; color: #f2f0e6; margin-bottom: 4px;">
                          3. Hybrid Dense-Sparse Vector Retrieval (pgvector + BM25)
                        </div>
                        <div style="font-size: 12px; color: #a4a899; line-height: 1.5;">
                          Dual-stage retrieval mesh combining dense semantic vectors with BM25 inverted lexical indexing, merged via Reciprocal Rank Fusion (RRF) and scored via Cohere Rerank v3 cross-encoders.
                        </div>
                      </div>

                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Engagement Tiers Overview -->
            <tr>
              <td style="padding: 0 32px 24px 32px;">
                <div style="background-color: #171914; border: 1px solid #2d3027; border-radius: 8px; padding: 16px 20px;">
                  <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #c9a96e; margin-bottom: 8px;">
                    Partnership Engagement Tiers
                  </div>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 12px;">
                    <tr>
                      <td style="padding: 4px 0; color: #f2f0e6; font-weight: 700;">Tier 01: Architectural Advisory</td>
                      <td align="right" style="padding: 4px 0; color: #c9a96e; font-weight: 700;">$3,500 / 5 days</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #f2f0e6; font-weight: 700;">Tier 02: Production Sprint Delivery</td>
                      <td align="right" style="padding: 4px 0; color: #c9a96e; font-weight: 700;">$8,500 / 2-week sprint</td>
                    </tr>
                    <tr>
                      <td style="padding: 4px 0; color: #f2f0e6; font-weight: 700;">Tier 03: Full-Cycle Enterprise Build</td>
                      <td align="right" style="padding: 4px 0; color: #c9a96e; font-weight: 700;">$18,500+ / 4–8 weeks</td>
                    </tr>
                  </table>
                </div>
              </td>
            </tr>

            <!-- Direct Channels CTA -->
            <tr>
              <td style="background-color: #171914; padding: 24px 32px; border-top: 1px solid #282b22; text-align: center;">
                <p style="margin: 0 0 14px 0; font-size: 13px; color: #a4a899;">
                  Need immediate discussion or architectural consultation?
                </p>
                <table border="0" cellpadding="0" cellspacing="0" align="center">
                  <tr>
                    <td align="center" style="border-radius: 6px; background-color: #8a8f70; padding: 10px 22px;">
                      <a href="${whatsappUrl}" target="_blank" style="font-size: 13px; font-weight: 700; color: #131411; text-decoration: none; display: inline-block;">
                        💬 Connect via WhatsApp (+91 87006 20913) &rarr;
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 16px 0 0 0; font-size: 12px; color: #787c6e;">
                  <a href="${canonicalPortfolioUrl}" target="_blank" style="color: #c9a96e; text-decoration: none; margin: 0 8px;">Portfolio Website</a> &bull;
                  <a href="https://github.com/hkbharti77" target="_blank" style="color: #c9a96e; text-decoration: none; margin: 0 8px;">GitHub</a> &bull;
                  <a href="https://www.linkedin.com/in/himanshu-bharti-81a5a618a" target="_blank" style="color: #c9a96e; text-decoration: none; margin: 0 8px;">LinkedIn</a>
                </p>
              </td>
            </tr>

            <!-- Footer Compliance -->
            <tr>
              <td style="background-color: #0b0c09; padding: 22px 32px; border-top: 1px solid #24271f; text-align: center;">
                <p style="margin: 0 0 6px 0; font-size: 12px; color: #616556;">
                  &copy; 2026 Himanshu Bharti. All rights reserved.
                </p>
                <p style="margin: 0 0 8px 0; font-size: 11px; color: #4b4e42;">
                  Himanshu Bharti &bull; Systems &amp; AI Engineer &bull; Simri Bakhtiarpur, Bihar, India &bull; Direct: <a href="mailto:hkbharti77@gmail.com" style="color: #8a8f70; text-decoration: none;">hkbharti77@gmail.com</a>
                </p>
                <p style="margin: 0; font-size: 10px; color: #36392f;">
                  Processed under India's Digital Personal Data Protection (DPDP) Act, 2023. Explicit consent recorded at dispatch.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;

  const text = `
Hello ${lead.name || 'there'},

Thank you for reaching out through my systems engineering portal! I have received your dispatch regarding: ${lead.subject || 'your technical inquiry'}.

I personally review all technical briefs and consultation proposals. I will get back to you with architectural considerations within 24 hours.

${hasNda ? '[BILATERAL MUTUAL NDA ACTIVE]: You marked the Mutual Non-Disclosure Agreement option. Bilateral agreement will be executed prior to repository access.\n' : ''}
--- TRANSMITTED INQUEST DETAILS ---
Inquirer: ${lead.name}
Email: ${lead.email}
${lead.phone ? `Phone: ${lead.phone}\n` : ''}${lead.company ? `Organization: ${lead.company}\n` : ''}Inquest Statement: ${lead.message}

--- CORE SYSTEMS & AI FOCUS AREAS ---
1. Sub-400ms Voice Orchestration (WebRTC 48kHz, Silero VAD, Deepgram Nova-2, Claude 3.5, ElevenLabs Turbo circular audio ring buffers)
2. Deterministic State Graphs in Multi-Agent Swarms (LangGraph DAGs with Redis checkpointing and idempotency locks)
3. Hybrid Dense-Sparse Vector Retrieval (pgvector + BM25 full-text GIN merged via Reciprocal Rank Fusion & Cohere Rerank v3)

--- PARTNERSHIP TIERS ---
- Tier 01: Architectural Advisory ($3,500 / 5 days)
- Tier 02: Production Sprint Delivery ($8,500 / 2-week dedicated sprint)
- Tier 03: Full-Cycle Enterprise System Build ($18,500+ / 4–8 weeks)

--- DIRECT CONNECT ---
WhatsApp: +91 87006 20913 (${whatsappUrl})
Portfolio: ${canonicalPortfolioUrl}
GitHub: https://github.com/hkbharti77
LinkedIn: https://www.linkedin.com/in/himanshu-bharti-81a5a618a
Direct Email: hkbharti77@gmail.com

© 2026 Himanshu Bharti. All rights reserved.
Processed under India's Digital Personal Data Protection (DPDP) Act, 2023.
`.trim();

  return { fromName, replyTo, subject, html, text };
}

/**
 * 4. User Confirmation — CRM Channel
 * Enterprise Deep Space Navy / Emerald & Cyan theme
 */
export function buildCrmConfirmationEmail({ lead, siteUrl, whatsappUrl }) {
  const fromName = process.env.SMTP_FROM_NAME || 'GyanVaniAi Technologies';
  const replyTo = process.env.SMTP_FROM_EMAIL || 'contact@gyanvaniai.com';
  const subject = `Inbound Consultation Received — GyanVaniAi Technologies`;
  const canonicalCrmUrl = siteUrl || 'https://www.gyanvaniai.com';

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
    body { margin: 0; padding: 0; background-color: #070d1d; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media only screen and (max-width: 620px) {
      .container { width: 100% !important; padding: 10px !important; }
      .hero-title { font-size: 22px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 24px 0; background-color: #070d1d; color: #f8fafc;">
  <center>
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #070d1d;">
      <tr>
        <td align="center" style="padding: 10px;">
          <!-- Main Container -->
          <table border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="max-width: 600px; width: 100%; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 14px; overflow: hidden; box-shadow: 0 20px 48px rgba(0,0,0,0.6);">
            
            <!-- Enterprise Cyan/Emerald Gradient Header Banner -->
            <tr>
              <td align="center" style="background: linear-gradient(135deg, #064e3b 0%, #0f766e 50%, #0284c7 100%); padding: 36px 30px; border-bottom: 1px solid rgba(255,255,255,0.1);">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="center">
                      <div style="display: inline-block; background: rgba(255,255,255,0.15); padding: 5px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px;">
                        Next-Gen AI &bull; Autonomous Revenue Operations
                      </div>
                      <h1 class="hero-title" style="margin: 0; font-size: 26px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                        GyanVaniAi Technologies
                      </h1>
                      <p style="margin: 8px 0 0 0; font-size: 14px; color: #ccfbf1; line-height: 1.5;">
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
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 10px; margin-bottom: 24px;">
                  <tr>
                    <td style="padding: 16px 20px;">
                      <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #38bdf8; margin-bottom: 10px;">
                        📋 Request Summary
                      </div>
                      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px;">
                        <tr>
                          <td style="padding: 5px 0; color: #94a3b8; width: 100px;">Prospect:</td>
                          <td style="padding: 5px 0; color: #f1f5f9; font-weight: 600;">${lead.name}</td>
                        </tr>
                        <tr>
                          <td style="padding: 5px 0; color: #94a3b8;">Work Email:</td>
                          <td style="padding: 5px 0; color: #38bdf8; font-family: monospace;">${lead.email}</td>
                        </tr>
                        ${lead.company ? `<tr>
                          <td style="padding: 5px 0; color: #94a3b8;">Company:</td>
                          <td style="padding: 5px 0; color: #f1f5f9; font-weight: 600;">${lead.company}</td>
                        </tr>` : ''}
                        ${lead.phone ? `<tr>
                          <td style="padding: 5px 0; color: #94a3b8;">Phone:</td>
                          <td style="padding: 5px 0; color: #10b981; font-family: monospace;">${lead.phone}</td>
                        </tr>` : ''}
                        <tr>
                          <td style="padding: 6px 0 0 0; color: #94a3b8; vertical-align: top;">Message:</td>
                          <td style="padding: 6px 0 0 0; color: #cbd5e1; line-height: 1.5; font-style: italic;">&ldquo;${lead.message}&rdquo;</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Core Solutions Grid -->
            <tr>
              <td style="padding: 0 30px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                  <tr>
                    <td align="center" style="border-top: 1px solid #1e293b; padding-top: 24px; padding-bottom: 16px;">
                      <span style="background-color: #064e3b; color: #6ee7b7; padding: 4px 14px; border-radius: 9999px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
                        Core Enterprise Solutions
                      </span>
                      <h3 style="margin: 12px 0 6px 0; font-size: 18px; font-weight: 700; color: #ffffff;">
                        How GyanVaniAi Accelerates Revenue
                      </h3>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Solutions Cards -->
            <tr>
              <td style="padding: 10px 30px 24px 30px;">
                
                <!-- Solution 1 -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 10px; margin-bottom: 12px;">
                  <tr>
                    <td style="padding: 16px 20px;">
                      <h4 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #ffffff;">
                        💬 WhatsApp Business Coexistence CRM
                      </h4>
                      <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                        Official Meta Tech Provider architecture: keep your native WhatsApp mobile app while AI auto-captures, qualifies, and logs leads into your central CRM in real time.
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Solution 2 -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 10px; margin-bottom: 12px;">
                  <tr>
                    <td style="padding: 16px 20px;">
                      <h4 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #ffffff;">
                        🎙️ Autonomous Voice AI Calling Agents
                      </h4>
                      <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                        Sub-500ms conversational turn turnaround for inbound customer support and outbound qualification calls with seamless live agent transfer.
                      </p>
                    </td>
                  </tr>
                </table>

                <!-- Solution 3 -->
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #1e293b; border: 1px solid #334155; border-radius: 10px; margin-bottom: 12px;">
                  <tr>
                    <td style="padding: 16px 20px;">
                      <h4 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #ffffff;">
                        ⚡ Omnichannel Workflow Automation
                      </h4>
                      <p style="margin: 0; font-size: 13px; color: #94a3b8; line-height: 1.5;">
                        Automated lead enrichment, skill-based assignment, follow-up sequences, and instant integration into your existing tech stack.
                      </p>
                    </td>
                  </tr>
                </table>

              </td>
            </tr>

            <!-- CTA Section -->
            <tr>
              <td style="background-color: #111c38; padding: 26px 30px; border-top: 1px solid #1e293b; text-align: center;">
                <p style="margin: 0 0 14px 0; font-size: 13px; color: #94a3b8;">
                  Need an immediate demo or want to speak with our solutions architect?
                </p>
                <table border="0" cellpadding="0" cellspacing="0" align="center">
                  <tr>
                    <td align="center" style="border-radius: 8px; background-color: #10b981; padding: 12px 24px; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
                      <a href="${whatsappUrl}" target="_blank" style="font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; display: inline-block;">
                        💬 Chat on WhatsApp (+91 87006 20913) &rarr;
                      </a>
                    </td>
                  </tr>
                </table>
                <p style="margin: 16px 0 0 0; font-size: 12px; color: #64748b;">
                  Visit: <a href="${canonicalCrmUrl}" target="_blank" style="color: #38bdf8; text-decoration: underline;">gyanvaniai.com</a> &bull; Support: <a href="mailto:contact@gyanvaniai.com" style="color: #38bdf8; text-decoration: underline;">contact@gyanvaniai.com</a>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color: #070d1d; padding: 24px 30px; border-top: 1px solid #1e293b; text-align: center;">
                <p style="margin: 0 0 6px 0; font-size: 12px; color: #64748b;">
                  &copy; 2026 GyanVaniAi Technologies. All rights reserved.
                </p>
                <p style="margin: 0; font-size: 10px; color: #475569;">
                  Processed under India's Digital Personal Data Protection (DPDP) Act, 2023 &amp; GDPR Art. 6.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </center>
</body>
</html>`;

  const text = `
Hello ${lead.name || 'there'},

Thank you for reaching out to GyanVaniAi Technologies! We have successfully received your consultation request regarding: ${lead.subject || 'AI CRM Solutions'}.

Our solutions engineering team is reviewing your requirements. A senior architect will follow up within 24 hours.

--- REQUEST SUMMARY ---
Prospect: ${lead.name}
Work Email: ${lead.email}
${lead.company ? `Company: ${lead.company}\n` : ''}${lead.phone ? `Phone: ${lead.phone}\n` : ''}Message: ${lead.message}

--- CORE ENTERPRISE SOLUTIONS ---
1. WhatsApp Business Coexistence CRM (Official Meta Tech Provider, dual mobile app sync)
2. Autonomous Voice AI Calling Agents (Sub-500ms conversational voice bots)
3. Omnichannel Workflow Automation (Enrichment, smart routing, zero lead dropoff)
4. Enterprise Private Knowledge RAG (Secure multi-document cognitive intelligence)

--- IMMEDIATE DEMO ---
Chat with our team on WhatsApp: +91 87006 20913 (${whatsappUrl})
Website: ${canonicalCrmUrl}
Email: contact@gyanvaniai.com

© 2026 GyanVaniAi Technologies. All rights reserved.
Processed under India's Digital Personal Data Protection (DPDP) Act, 2023.
`.trim();

  return { fromName, replyTo, subject, html, text };
}
