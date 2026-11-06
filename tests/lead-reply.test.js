import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import assert from 'assert';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { connectDB, closeDB, getDb } from '../src/db/connection.js';
import { ObjectId } from 'mongodb';
import { buildLeadOutreachEmail } from '../src/services/leadEmailTemplates.js';
import { sendLeadOutreachReplyEmail } from '../src/services/email.service.js';

let passed = 0;
let failed = 0;

function report(name, ok, detail = '') {
  if (ok) {
    passed++;
    console.log(`  ✅ PASS: ${name} ${detail}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${name} ${detail}`);
  }
}

async function run() {
  console.log('\n========================================');
  console.log('🧪 Testing Lead Email Outreach & Reply System');
  console.log('========================================\n');

  try {
    // 1. Template Generation Test (CRM Channel)
    const mockCrmLead = {
      _id: new ObjectId(),
      name: 'Priya Sharma',
      email: 'priya@acmecorp.com',
      company: 'Acme Corp',
      message: 'Interested in AI CRM automation and WhatsApp bots for our sales team.',
      channel: 'crm',
      createdAt: new Date(),
    };

    const crmEmail = buildLeadOutreachEmail({
      lead: mockCrmLead,
      subject: 'Regarding your inquiry with GyanVaniAi — Project Discussion',
      message: 'Hi Priya,\n\nWe reviewed your requirements for WhatsApp bots and AI CRM automation.\n\nWe would love to set up a discovery call.',
      authorName: 'Admin Solutions Architect',
      authorEmail: 'contact@gyanvaniai.com',
    });

    report('CRM Email Template Subject & Name', crmEmail.fromName.includes('Admin Solutions Architect'));
    report('CRM Email HTML Body Formatting', crmEmail.html.includes('Acme Corp') || crmEmail.html.includes('Priya'));
    report('CRM Email Contains Client Inquiry Quote', crmEmail.html.includes('Interested in AI CRM automation'));

    // 2. Template Generation Test (Portfolio Channel)
    const mockPortfolioLead = {
      _id: new ObjectId(),
      name: 'David Miller',
      email: 'david@techstart.io',
      company: 'TechStart',
      message: 'Need a senior systems engineer to build our distributed backend and cloud microservices.',
      channel: 'portfolio',
      createdAt: new Date(),
    };

    const portfolioEmail = buildLeadOutreachEmail({
      lead: mockPortfolioLead,
      subject: 'Re: Technical Inquest — Systems Studio Consultation',
      message: 'Hi David,\n\nI reviewed your microservices inquest. I can help architect this.\n\nLet me know a good time to connect.',
      authorName: 'Himanshu Bharti',
      authorEmail: 'hkbharti77@gmail.com',
    });

    report('Portfolio Email Template Branding', portfolioEmail.fromName.includes('Systems Studio'));
    report('Portfolio Email Reply-To', portfolioEmail.replyTo === 'hkbharti77@gmail.com');
    report('Portfolio Email Body Contains Lead Message', portfolioEmail.html.includes('Need a senior systems engineer'));

    // 3. Email Dispatcher Function Verification
    console.log('\n2. Testing Email Dispatcher Wrapper...');
    const sendResult = await sendLeadOutreachReplyEmail({
      lead: mockCrmLead,
      to: mockCrmLead.email,
      subject: 'Test Subject',
      message: 'Test outreach message body for verification.',
      authorName: 'Test Admin',
      authorEmail: 'contact@gyanvaniai.com',
    });

    report('Lead Outreach Dispatcher Executes Without Error', sendResult.ok === true);

    console.log('\n========================================');
    console.log(`Results: ${passed} PASSED | ${failed} FAILED`);
    console.log('========================================\n');

    if (failed > 0) {
      process.exit(1);
    }
    process.exit(0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

run();

