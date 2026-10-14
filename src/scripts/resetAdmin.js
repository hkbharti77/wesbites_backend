import 'dotenv/config';
import { connectDB, closeDB } from '../db/connection.js';
import { hashPassword, normalizeEmail } from '../utils/crypto.js';

async function main() {
  const { db } = await connectDB();
  const rolesCol = db.collection('admin_roles');
  const superAdminRole = await rolesCol.findOne({ key: 'super_admin' });

  if (!superAdminRole) {
    console.error('Super admin role not found');
    await closeDB();
    process.exit(1);
  }

  const usersCol = db.collection('admin_users');
  const password = process.env.INITIAL_ADMIN_PASSWORD || 'SuperAdmin@GyanVani2026!';
  const passwordHash = await hashPassword(password);
  const now = new Date();

  const accounts = [
    { email: 'superadmin@gyanvaniai.com', name: 'GyanVani Super Admin' },
    { email: 'contact@gyanvaniai.com', name: 'GyanVani Contact Admin' },
    { email: 'admin@gyanvaniai.com', name: 'GyanVani System Admin' },
  ];

  for (const acc of accounts) {
    const emailNormalized = normalizeEmail(acc.email);
    await usersCol.updateOne(
      { emailNormalized },
      {
        $set: {
          name: acc.name,
          emailNormalized,
          passwordHash,
          roleIds: [superAdminRole._id],
          status: 'active',
          passwordChangedAt: now,
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
          lastLoginAt: null,
        },
      },
      { upsert: true }
    );
    console.log(`✅ Provisioned: ${acc.email} with password: ${password}`);
  }

  await closeDB();
  console.log('🎉 Admin accounts ready!');
}

main().catch(console.error);
