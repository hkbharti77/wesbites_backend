import { connectDB, getDb } from '../src/db/connection.js';

async function migrate() {
  await connectDB();
  const db = getDb();
  const col = db.collection('cookie_consents');

  const res = await col.updateMany(
    { $or: [{ channel: { $exists: false } }, { channel: null }, { channel: '' }] },
    { $set: { channel: 'crm', source: 'crm_cookie_banner' } }
  );

  console.log('Successfully backfilled consent documents with channel=crm:', res.modifiedCount);

  const docs = await col.find({}, { projection: { channel: 1 } }).toArray();
  const channels = {};
  docs.forEach((d) => {
    channels[d.channel] = (channels[d.channel] || 0) + 1;
  });
  console.log('Current channels distribution in DB:', channels);
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
