/**
 * Localhost Inbound Email Simulator
 * 
 * Simulates a client replying to an email so you can test the conversation stream
 * on http://localhost:5173 without needing a public domain or tunnel!
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, getDb, closeDB } from '../db/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function simulateReply() {
  await connectDB();
  const db = getDb();
  
  // Find the most recent lead
  const lead = await db.collection('contact_leads').findOne({}, { sort: { createdAt: -1 } });
  
  if (!lead) {
    console.error('❌ No leads found in database to simulate reply. Please submit a contact inquiry first.');
    await closeDB();
    process.exit(1);
  }

  console.log(`\nSimulating client reply for Lead: "${lead.name}" (${lead.email})...`);

  const port = process.env.PORT || 5000;
  const webhookUrl = `http://localhost:${port}/api/webhooks/inbound-email`;

  const payload = {
    from: `${lead.name} <${lead.email}>`,
    to: 'contact@gyanvaniai.com',
    subject: `Re: Discussion regarding ${lead.subject || 'Project Requirements'}`,
    text: `Hi GyanVani team,\n\nThank you for the quick outreach! We are interested in scheduling a 20-minute discovery call this Thursday at 3:00 PM IST.\n\nPlease share the Google Meet link.\n\nBest regards,\n${lead.name}`,
    messageId: `<client.simulated.${Date.now()}@${lead.email.split('@')[1] || 'client.com'}>`,
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log('\n============================================================');
    console.log('✅ Inbound Email Webhook Response:');
    console.log(data);
    console.log('============================================================');
    console.log(`\n🎉 Success! Now open http://localhost:5173/admin/leads in your browser:`);
    console.log(`- Lead "${lead.name}" will show status "💬 Client Replied"`);
    console.log(`- Click on the lead to see the new message in the Two-Way Conversation Stream!\n`);
  } catch (err) {
    console.error('❌ Failed to call webhook on localhost:', err.message);
    console.error(`Ensure your backend is running on http://localhost:${port} (npm run dev)`);
  } finally {
    await closeDB();
  }
}

simulateReply().catch(console.error);

