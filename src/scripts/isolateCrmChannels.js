import { connectDB, getDb } from '../db/connection.js';

async function main() {
  console.log('Connecting to DB to isolate CRM channels...');
  await connectDB();
  const db = getDb();
  const postsCol = db.collection('cms_posts');

  // Update existing GyanVani CRM posts from 'all' to 'crm'
  const res = await postsCol.updateMany(
    { channel: 'all' },
    { $set: { channel: 'crm' } }
  );

  console.log(`Updated ${res.modifiedCount} posts from channel 'all' -> 'crm'.`);

  const totalAll = await postsCol.countDocuments({ channel: 'all' });
  const totalPortfolio = await postsCol.countDocuments({ channel: 'portfolio' });
  const totalCrm = await postsCol.countDocuments({ channel: 'crm' });
  console.log(`Isolation complete! Channels breakdown: all=${totalAll}, portfolio=${totalPortfolio}, crm=${totalCrm}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
