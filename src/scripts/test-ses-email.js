import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const host = process.env.SMTP_HOST || 'email-smtp.ap-southeast-2.amazonaws.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

  const fromEmail = 'no-reply@hkbharti77.website';
  const toEmail = 'hkbharti77@gmail.com';

  console.log('--- Testing SMTP Email Dispatch ---');
  console.log(`SMTP Host: ${host}:${port}`);
  console.log(`SMTP User: ${user}`);
  console.log(`From: ${fromEmail}`);
  console.log(`To: ${toEmail}`);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: {
      rejectUnauthorized: true,
    },
  });

  console.log('\n[1] Verifying SMTP credentials connection...');
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified successfully!');
  } catch (verifyErr) {
    console.error('❌ SMTP verification failed:', verifyErr);
    process.exit(1);
  }

  console.log('\n[2] Attempting to send test email...');
  try {
    const info = await transporter.sendMail({
      from: `"Himanshu Bharti" <${fromEmail}>`,
      to: toEmail,
      replyTo: 'hkbharti77@gmail.com',
      subject: 'Test Email: SES Verification & Backend Delivery Check',
      text: `Hello Himanshu,\n\nThis is a test email sent from ${fromEmail} to ${toEmail} using the SMTP credentials configured in backend/.env.\n\nTimestamp: ${new Date().toISOString()}\nDelivery Channel: AWS SES (${host})\n\nIf you received this email, the domain and sender identity verification are working properly!`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #1e293b; margin-top: 0;">🚀 Backend Email Delivery Test</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            This is a test email confirming that the backend SMTP configuration and identity dispatch are operating smoothly.
          </p>
          <div style="background-color: #f8fafc; border-left: 4px solid #6366f1; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 4px 0; font-size: 14px; color: #334155;"><strong>From:</strong> <code>${fromEmail}</code></p>
            <p style="margin: 4px 0; font-size: 14px; color: #334155;"><strong>To:</strong> <code>${toEmail}</code></p>
            <p style="margin: 4px 0; font-size: 14px; color: #334155;"><strong>SMTP Server:</strong> ${host}:${port}</p>
            <p style="margin: 4px 0; font-size: 14px; color: #334155;"><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          </div>
          <p style="color: #64748b; font-size: 13px;">
            Status: Identity verification confirmed.
          </p>
        </div>
      `,
    });

    console.log('✅ Email sent successfully!');
    console.log('Message ID:', info.messageId);
    console.log('Response:', info.response);
  } catch (sendErr) {
    console.error('❌ Failed to send email:', sendErr);
  }
}

main();

