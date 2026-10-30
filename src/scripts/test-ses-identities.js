import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function check(fromEmail, toEmail) {
  const host = process.env.SMTP_HOST || 'email-smtp.ap-southeast-2.amazonaws.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    tls: { rejectUnauthorized: true },
  });

  console.log(`\nTesting From: ${fromEmail} -> To: ${toEmail}...`);
  try {
    const info = await transporter.sendMail({
      from: `"Himanshu Bharti" <${fromEmail}>`,
      to: toEmail,
      replyTo: 'hkbharti77@gmail.com',
      subject: `Test Dispatch from ${fromEmail}`,
      text: `Test email verifying SES sender identity for ${fromEmail}`,
    });
    console.log(`✅ Success for ${fromEmail}! MessageId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.log(`❌ Failed for ${fromEmail}:`, err.message);
    return false;
  }
}

async function run() {
  await check('contact@gyanvaniai.com', 'hkbharti77@gmail.com');
  await check('no-reply@hkbharti77.website', 'hkbharti77@gmail.com');
  await check('hkbharti77@gmail.com', 'hkbharti77@gmail.com');
}

run();

