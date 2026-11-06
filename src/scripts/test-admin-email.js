import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { verifySmtpConnection, sendLeadNotificationToAdmin } from '../services/email.service.js';

async function main() {
  console.log('=== Testing Portfolio Admin Email Dispatch ===');
  console.log('Environment Settings:');
  console.log(`  PORTFOLIO_FROM_EMAIL: ${process.env.PORTFOLIO_FROM_EMAIL}`);
  console.log(`  PORTFOLIO_ADMIN_EMAIL: ${process.env.PORTFOLIO_ADMIN_EMAIL}`);
  console.log(`  SMTP_HOST: ${process.env.SMTP_HOST}`);
  console.log(`  SMTP_PORT: ${process.env.SMTP_PORT}`);
  console.log(`  SMTP_USER: ${process.env.SMTP_USER}`);

  console.log('\n[1] Verifying SMTP Connection...');
  const verifyResult = await verifySmtpConnection();
  console.log('  SMTP Verify:', verifyResult);

  if (!verifyResult.ok) {
    console.error('SMTP verification failed:', verifyResult.error);
    process.exit(1);
  }

  const sampleLead = {
    _id: 'test_admin_' + Date.now(),
    name: 'Himanshu Bharti (Test Inquirer)',
    email: 'test.inquirer@example.com',
    phone: '+91 8700620913',
    company: 'Systems & AI Architecture Studio',
    subject: 'AI Orchestration & High-Scale Systems Inquiry',
    message: 'This is a test notification verifying that Portfolio admin emails are dispatched correctly from no-reply@hkbharti77.website to hkbharti77@gmail.com.',
    channel: 'portfolio',
    source: 'portfolio_contact_form',
    ndaRequired: true,
    createdAt: new Date(),
  };

  console.log('\n[2] Dispatching Admin Email to:', process.env.PORTFOLIO_ADMIN_EMAIL);
  const sendResult = await sendLeadNotificationToAdmin({ lead: sampleLead });
  console.log('  Admin Send Result:', sendResult);

  if (sendResult.ok && !sendResult.mocked) {
    console.log('\nSUCCESS: Admin notification email sent successfully!');
  } else {
    console.error('\nFAILED: Could not send email or mocked.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

