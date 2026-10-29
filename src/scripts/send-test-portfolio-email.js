import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { verifySmtpConnection, sendLeadConfirmationToUser, sendLeadNotificationToAdmin } from '../services/email.service.js';

async function run() {
  const targetRecipient = 'himanshukumar02001@gmail.com';

  console.log('--- Portfolio Channel Email Dispatch Test ---');
  console.log(`SMTP Endpoint: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
  console.log(`Sending Identity (From): ${process.env.PORTFOLIO_FROM_EMAIL || 'contact@gyanvaniai.com'}`);
  console.log(`Reply-To Address: hkbharti77@gmail.com`);
  console.log(`Target Test Inquirer: ${targetRecipient}`);

  console.log('\n[Step 1] Verifying AWS SES SMTP Connection...');
  const verifyResult = await verifySmtpConnection();
  console.log('Result:', verifyResult);

  if (!verifyResult.ok) {
    console.error('SMTP connection failed.');
    process.exit(1);
  }

  const sampleLead = {
    _id: 'test_' + Date.now(),
    name: 'Himanshu Kumar',
    email: targetRecipient,
    phone: '+91 8700620913',
    company: 'Systems & AI Architecture Studio',
    subject: 'AI Orchestration & Low-Latency Voice Inquest',
    message: 'Testing portfolio inquest confirmation dispatch. Verification of broadsheet aesthetic, sender headers, and mutual NDA alert banner.',
    channel: 'portfolio',
    source: 'portfolio_contact_form',
    ndaRequired: true,
    createdAt: new Date(),
  };

  console.log(`\n[Step 2] Sending User Confirmation Receipt to ${targetRecipient}...`);
  const userResult = await sendLeadConfirmationToUser({ lead: sampleLead });
  console.log('User Dispatch Result:', userResult);

  console.log(`\n[Step 3] Sending Admin Inquest Alert for ${targetRecipient}...`);
  const originalAdminEmail = process.env.PORTFOLIO_ADMIN_EMAIL;
  process.env.PORTFOLIO_ADMIN_EMAIL = targetRecipient;
  const adminResult = await sendLeadNotificationToAdmin({ lead: sampleLead });
  process.env.PORTFOLIO_ADMIN_EMAIL = originalAdminEmail;
  console.log('Admin Dispatch Result:', adminResult);

  console.log('\n=== All test dispatches completed successfully! ===');
}

run().catch((err) => {
  console.error('Unhandled error during test dispatch:', err);
  process.exit(1);
});
