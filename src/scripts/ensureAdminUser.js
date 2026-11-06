import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDB, closeDB } from '../db/connection.js';
import { hashPassword, normalizeEmail } from '../utils/crypto.js';
import { seedDatabase } from './seed.js';

async function main() {
  console.log('Connecting to database...');
  const { db } = await connectDB();
  console.log(`Connected to database: ${db.databaseName}`);

  const rolesCol = db.collection('admin_roles');
  let superAdminRole = await rolesCol.findOne({ key: 'super_admin' });

  if (!superAdminRole) {
    console.log('🌱 Super Admin role not found. Running seedDatabase()...');
    await seedDatabase();
    superAdminRole = await rolesCol.findOne({ key: 'super_admin' });
  }

  const usersCol = db.collection('admin_users');
  const targetEmail = normalizeEmail(process.env.INITIAL_ADMIN_EMAIL || 'contact@gyanvaniai.com');
  const targetPassword = process.env.INITIAL_ADMIN_PASSWORD || 'GyanVani2026@';
  const targetName = process.env.INITIAL_ADMIN_NAME || 'GyanVani Super Admin';

  const existingUser = await usersCol.findOne({ emailNormalized: targetEmail });

  const passwordHash = await hashPassword(targetPassword);
  const now = new Date();

  await usersCol.updateOne(
    { emailNormalized: targetEmail },
    {
      $set: {
        name: targetName,
        emailNormalized: targetEmail,
        passwordHash,
        roleIds: [superAdminRole._id],
        status: 'active',
        failedLoginAttempts: 0,
        lockedUntil: null,
        updatedAt: now,
        passwordChangedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
        lastLoginAt: null,
      },
    },
    { upsert: true }
  );

  console.log(`✅ Admin user verified & updated:`);
  console.log(`   Email: ${targetEmail}`);
  console.log(`   Password: ${targetPassword}`);
  console.log(`   Status: active`);
  console.log(`   Lockout: cleared`);

  await closeDB();
  process.exit(0);
}

main().catch(async (err) => {
  console.error('Error ensuring admin user:', err);
  await closeDB().catch(() => {});
  process.exit(1);
});

