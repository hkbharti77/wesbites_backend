import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { verifySmtpConnection, sendLeadNotificationToAdmin, sendLeadConfirmationToUser } from '../services/email.service.js';

async function main() {
  console.log('=== Testing End-to-End Portfolio Lead Ingestion & Email Routing ===');
  console.log('Active Configuration:');
  console.log(`  PORTFOLIO_FROM_EMAIL: ${process.env.PORTFOLIO_FROM_EMAIL}`);
  console.log(`  PORTFOLIO_ADMIN_EMAIL: ${process.env.PORTFOLIO_ADMIN_EMAIL}`);
  console.log(`  SMTP_HOST: ${process.env.SMTP_HOST}`);

  console.log('\n[1] Verifying AWS SES SMTP Transport...');
  const verify = await verifySmtpConnection();
  if (!verify.ok) {
    console.error('SMTP verification failed:', verify.error);
    process.exit(1);
  }
  console.log('  SMTP Status: OK');

  const incomingPortfolioLead = {
    _id: 'portfolio_test_' + Date.now(),
    name: 'Sarah Jenkins',
    email: 'sarah.jenkins@techfirm.io',
    phone: '+1 415 555 2671',
    company: 'TechFirm AI Labs',
    subject: 'AI Agent Architecture & LLM Orchestration Inquest',
    message: 'Hello Himanshu, we are reviewing your distributed systems & AI architecture portfolio and would like to consult on an upcoming agentic orchestration pipeline. We have flagged mutual NDA requirements.',
    channel: 'portfolio',
    source: 'portfolio_contact_form',
    ndaRequired: true,
    consentVersion: 'DPDP-2023-v1',
    createdAt: new Date(),
  };

  console.log('\n[2] Dispatching Admin Inquest Alert to PORTFOLIO_ADMIN_EMAIL (hkbharti77@gmail.com)...');
  const adminResult = await sendLeadNotificationToAdmin({ lead: incomingPortfolioLead });
  console.log('  Admin Notification Result:', adminResult);

  if (!adminResult.ok) {
    console.error('Failed to send admin notification email');
    process.exit(1);
  }

  console.log('\n[3] Dispatching Inquirer Confirmation Receipt to test email (hkbharti77@gmail.com)...');
  // For testing user confirmation receipt without sending to fake Sarah Jenkins domain, we route to hkbharti77@gmail.com
  const userTestLead = {
    ...incomingPortfolioLead,
    email: process.env.PORTFOLIO_ADMIN_EMAIL || 'hkbharti77@gmail.com',
  };
  const userResult = await sendLeadConfirmationToUser({ lead: userTestLead });
  console.log('  User Confirmation Result:', userResult);

  if (!userResult.ok) {
    console.error('Failed to send user confirmation email');
    process.exit(1);
  }

  console.log('\n=== Both Portfolio Emails Successfully Dispatched via AWS SES! ===');
  console.log('1. Admin Inquest Email delivered to hkbharti77@gmail.com from no-reply@hkbharti77.website');
  console.log('2. User Inquest Receipt delivered to hkbharti77@gmail.com from no-reply@hkbharti77.website (Reply-To: hkbharti77@gmail.com)');
}

main().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});

