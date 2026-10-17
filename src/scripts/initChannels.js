import { connectDB, getDb } from '../db/connection.js';

async function main() {
  console.log('Connecting to DB...');
  await connectDB();
  const db = getDb();
  const postsCol = db.collection('cms_posts');

  const unassigned = await postsCol.countDocuments({ channel: { $exists: false } });
  console.log(`Found ${unassigned} posts without channel property.`);

  const res = await postsCol.updateMany(
    { channel: { $exists: false } },
    { $set: { channel: 'all' } }
  );

  console.log(`Set channel: 'all' for ${res.modifiedCount} posts.`);
  
  const totalAll = await postsCol.countDocuments({ channel: 'all' });
  const totalPortfolio = await postsCol.countDocuments({ channel: 'portfolio' });
  const totalCrm = await postsCol.countDocuments({ channel: 'crm' });
  console.log(`Current channels breakdown: all=${totalAll}, portfolio=${totalPortfolio}, crm=${totalCrm}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
