import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDB, getDb, closeDB } from '../db/connection.js';
import { parseInboundEmailContent } from '../services/emailParser.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function cleanMimeMessages() {
  await connectDB();
  const db = getDb();
  const leadsCol = db.collection('contact_leads');

  const leads = await leadsCol.find({
    $or: [
      { 'messages.bodyText': { $regex: 'Received:|ARC-Seal:', $options: 'i' } },
      { 'notes.emailMessage': { $regex: 'Received:|ARC-Seal:', $options: 'i' } },
    ],
  }).toArray();

  console.log(`Found ${leads.length} leads with raw MIME headers in messages.`);

  for (const lead of leads) {
    let updated = false;
    const cleanMessages = [];

    for (const msg of (lead.messages || [])) {
      if (msg.bodyText && (msg.bodyText.includes('Received:') || msg.bodyText.includes('ARC-Seal:'))) {
        const parsed = await parseInboundEmailContent({ text: msg.bodyText });
        const cleanText = parsed.cleanText || '(No plain text content)';
        cleanMessages.push({
          ...msg,
          bodyText: cleanText,
        });
        updated = true;
      } else {
        cleanMessages.push(msg);
      }
    }

    const cleanNotes = [];
    for (const n of (lead.notes || [])) {
      if (n.emailMessage && (n.emailMessage.includes('Received:') || n.emailMessage.includes('ARC-Seal:'))) {
        const parsed = await parseInboundEmailContent({ text: n.emailMessage });
        const cleanText = parsed.cleanText || '(No plain text content)';
        cleanNotes.push({
          ...n,
          note: `Client replied via email: "${cleanText.slice(0, 100)}"`,
          emailMessage: cleanText,
        });
        updated = true;
      } else {
        cleanNotes.push(n);
      }
    }

    if (updated) {
      await leadsCol.updateOne(
        { _id: lead._id },
        {
          $set: {
            messages: cleanMessages,
            notes: cleanNotes,
            updatedAt: new Date(),
          },
        }
      );
      console.log(`✅ Cleaned up Lead #${lead._id} (${lead.name})`);
    }
  }

  await closeDB();
  console.log('Finished MIME cleanup.');
}

cleanMimeMessages().catch(console.error);
