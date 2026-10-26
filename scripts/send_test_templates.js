import dotenv from 'dotenv';
dotenv.config();

import nodemailer from 'nodemailer';
import {
  buildPortfolioAdminNotificationEmail,
  buildCrmAdminNotificationEmail,
  buildPortfolioConfirmationEmail,
  buildCrmConfirmationEmail,
} from '../src/services/leadEmailTemplates.js';

const targetEmail = 'hkbharti77@gmail.com';

const host = process.env.SMTP_HOST || 'smtp.gmail.com';
const port = parseInt(process.env.SMTP_PORT || '465', 10);
const secure = process.env.SMTP_SECURE === 'true' || port === 465;
const user = process.env.SMTP_USER;
const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
const fromEmail = process.env.SMTP_FROM_EMAIL || user;

if (!user || !pass) {
  console.error('SMTP credentials missing');
  process.exit(1);
}

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: { user, pass },
  tls: { rejectUnauthorized: true },
});

async function main() {
  console.log(`Verifying SMTP transport connection...`);
  await transporter.verify();
  console.log(`SMTP verified successfully!`);

  // Sample Portfolio Lead Data
  const portfolioLead = {
    name: 'Alexander Vance',
    email: targetEmail,
    phone: '+1 (415) 890-2341',
    company: 'Vance Autonomous Systems',
    subject: 'Autonomous LLM Agent Architecture & Multi-Tenant Pipeline',
    message: 'We are architecting a distributed multi-agent swarm for fintech settlement. Need senior systems review, low-latency LLM orchestration benchmarks, and DPDP/GDPR compliant telemetry audit.',
    channel: 'portfolio',
    ndaRequired: true,
  };

  // Sample CRM Lead Data
  const crmLead = {
    name: 'Vikram Malhotra',
    email: targetEmail,
    phone: '+91 98201 54321',
    company: 'Apex Logistics & Retail Ltd',
    subject: 'Omnichannel WhatsApp Coexistence & AI Voice Calling Deployment',
    message: 'Looking to deploy 24/7 AI calling agents and WhatsApp business automation across 12 distribution hubs with Salesforce and Zendesk two-way sync.',
    channel: 'crm',
    ndaRequired: false,
  };

  const sitePortfolioUrl = 'https://hkbharti77.website';
  const siteCrmUrl = 'https://www.gyanvaniai.com';
  const whatsappUrl = 'https://wa.me/918700620913?text=Hi%20Himanshu%2C%20testing%20email%20templates';

  // 1. Portfolio User Confirmation
  console.log('\n1. Sending Portfolio User Confirmation...');
  const portUser = buildPortfolioConfirmationEmail({
    lead: portfolioLead,
    siteUrl: sitePortfolioUrl,
    whatsappUrl,
  });
  await transporter.sendMail({
    from: `"${portUser.fromName}" <${fromEmail}>`,
    to: targetEmail,
    replyTo: portUser.replyTo,
    subject: `[TEST UI - Portfolio Client] ${portUser.subject}`,
    html: portUser.html,
    text: portUser.text,
  });
  console.log('✓ Sent Portfolio User Confirmation Email');

  // 2. Portfolio Admin Alert
  console.log('\n2. Sending Portfolio Admin Notification...');
  const portAdmin = buildPortfolioAdminNotificationEmail({
    lead: portfolioLead,
    adminEmail: targetEmail,
    fromEmail,
  });
  await transporter.sendMail({
    from: `"${portAdmin.fromName}" <${fromEmail}>`,
    to: targetEmail,
    subject: `[TEST UI - Portfolio Admin] ${portAdmin.subject}`,
    html: portAdmin.html,
  });
  console.log('✓ Sent Portfolio Admin Notification Email');

  // 3. CRM User Confirmation
  console.log('\n3. Sending CRM User Confirmation...');
  const crmUser = buildCrmConfirmationEmail({
    lead: crmLead,
    siteUrl: siteCrmUrl,
    whatsappUrl,
  });
  await transporter.sendMail({
    from: `"${crmUser.fromName}" <${fromEmail}>`,
    to: targetEmail,
    replyTo: crmUser.replyTo,
    subject: `[TEST UI - CRM Client] ${crmUser.subject}`,
    html: crmUser.html,
    text: crmUser.text,
  });
  console.log('✓ Sent CRM User Confirmation Email');

  // 4. CRM Admin Alert
  console.log('\n4. Sending CRM Admin Notification...');
  const crmAdmin = buildCrmAdminNotificationEmail({
    lead: crmLead,
    adminEmail: targetEmail,
    fromEmail,
  });
  await transporter.sendMail({
    from: `"${crmAdmin.fromName}" <${fromEmail}>`,
    to: targetEmail,
    subject: `[TEST UI - CRM Admin] ${crmAdmin.subject}`,
    html: crmAdmin.html,
  });
  console.log('✓ Sent CRM Admin Notification Email');

  console.log(`\n🎉 ALL 4 TEST EMAILS SENT SUCCESSFULLY TO ${targetEmail}!`);
}

main().catch(err => {
  console.error('Error sending test emails:', err);
  process.exit(1);
});
