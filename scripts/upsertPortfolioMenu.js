import { connectDB, getDb } from '../src/db/connection.js';

async function main() {
  await connectDB();
  const db = getDb();
  const menusCol = db.collection('admin_menus');

  const existing = await menusCol.findOne({ routeKey: '/admin/portfolio-media' });
  if (!existing) {
    const res = await menusCol.insertOne({
      label: 'Portfolio Assets (Resume & Video)',
      icon: 'Briefcase',
      routeKey: '/admin/portfolio-media',
      parentId: null,
      requiredPermission: 'media.read',
      sortOrder: 15,
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log('Inserted portfolio menu item:', res.insertedId);
  } else {
    await menusCol.updateOne(
      { routeKey: '/admin/portfolio-media' },
      {
        $set: {
          label: 'Portfolio Assets (Resume & Video)',
          icon: 'Briefcase',
          requiredPermission: 'media.read',
          enabled: true,
          updatedAt: new Date(),
        },
      }
    );
    console.log('Updated existing portfolio menu item');
  }

  const all = await menusCol.find({ enabled: true }).toArray();
  console.log('Total enabled menus:', all.length, all.map(m => m.label));
  process.exit(0);
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
