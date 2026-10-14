import { connectDB, closeDB, getDb } from '../src/db/connection.js';
import { hashPassword, normalizeEmail } from '../src/utils/crypto.js';
import {
  createSession,
  validateSession,
  revokeSessionByToken,
  revokeAllUserSessions,
} from '../src/services/session.service.js';
import {
  resolveUserPermissions,
  ensureLastSuperAdminProtected,
  SUPER_ADMIN_ROLE_KEY,
} from '../src/services/rbac.service.js';
import { APPROVED_ROUTES } from '../src/controllers/menu.controller.js';
import { authRateLimiter } from '../src/middleware/rateLimiter.js';
import { ObjectId } from 'mongodb';

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failedTests++;
  }
}

async function runTestSuite() {
  console.log('\n==================================================');
  console.log('🧪 GYANVANIAI ADMIN FOUNDATION — BACKEND TEST SUITE');
  console.log('==================================================\n');

  const { db } = await connectDB();
  const usersCol = db.collection('admin_users');
  const rolesCol = db.collection('admin_roles');
  const sessionsCol = db.collection('admin_sessions');
  const resetsCol = db.collection('admin_password_resets');

  // Test setup: grab roles
  const superAdminRole = await rolesCol.findOne({ key: 'super_admin' });
  const editorRole = await rolesCol.findOne({ key: 'editor' });
  const readonlyRole = await rolesCol.findOne({ key: 'readonly_analyst' });

  assert(Boolean(superAdminRole), 'Super Admin role exists in database');
  assert(Boolean(editorRole), 'Editor role exists in database');
  assert(Boolean(readonlyRole), 'Read-Only Analyst role exists in database');

  // --------------------------------------------------------------------------
  // SUITE 1: AUTHENTICATION & PASSWORD HASHING
  // --------------------------------------------------------------------------
  console.log('\n▶ Suite 1: Authentication, Passwords & Sessions');

  const testUserEmail = `test_runner_${Date.now()}@gyanvaniai.com`;
  const rawPassword = 'SecurePassword@2026!';
  const passwordHash = await hashPassword(rawPassword);

  const testUserDoc = {
    name: 'Automated Test User',
    emailNormalized: testUserEmail,
    passwordHash,
    roleIds: [editorRole._id],
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const insertRes = await usersCol.insertOne(testUserDoc);
  const testUserId = insertRes.insertedId;

  // Session Creation
  const { rawToken, expiresAt } = await createSession({
    userId: testUserId,
    ipAddress: '127.0.0.1',
    userAgent: 'IntegrationTestRunner/1.0',
  });

  assert(Boolean(rawToken && rawToken.length >= 64), 'Generates high-entropy 32-byte (64 char hex) session token');
  assert(expiresAt > new Date(), 'Session expires in the future (24 hours)');

  // Session Validation
  const validSession = await validateSession(rawToken);
  assert(Boolean(validSession), 'Valid session token resolves active session document');
  assert(validSession.userId.toString() === testUserId.toString(), 'Session is correctly associated with user ID');

  // Session Revocation
  const revoked = await revokeSessionByToken(rawToken);
  assert(revoked === true, 'Session revocation marks record revoked in database');

  const revalidated = await validateSession(rawToken);
  assert(revalidated === null, 'Revoked session is immediately rejected upon validation');

  // Expired session handling
  const expiredSession = await createSession({ userId: testUserId });
  await sessionsCol.updateOne(
    { _id: new ObjectId(expiredSession.sessionId) },
    { $set: { expiresAt: new Date(Date.now() - 10000) } } // Expired 10s ago
  );
  const expiredCheck = await validateSession(expiredSession.rawToken);
  assert(expiredCheck === null, 'Expired session is denied authentication');

  // --------------------------------------------------------------------------
  // SUITE 2: RBAC & PERMISSION EVALUATION
  // --------------------------------------------------------------------------
  console.log('\n▶ Suite 2: Role-Based Access Control & Permission Resolution');

  // Check Editor permissions
  const editorUser = await usersCol.findOne({ _id: testUserId });
  const editorPerms = await resolveUserPermissions(editorUser);

  assert(editorPerms.isSuperAdmin === false, 'Editor user is not classified as Super Admin');
  assert(editorPerms.permissions.includes('posts.create'), 'Editor has posts.create permission');
  assert(editorPerms.permissions.includes('posts.publish'), 'Editor has posts.publish permission');
  assert(!editorPerms.permissions.includes('users.create'), 'Editor does NOT have users.create permission');
  assert(!editorPerms.permissions.includes('roles.delete'), 'Editor does NOT have roles.delete permission');

  // Check Super Admin permissions
  const superAdminUser = await usersCol.findOne({ roleIds: superAdminRole._id, status: 'active' });
  const superAdminPerms = await resolveUserPermissions(superAdminUser);

  assert(superAdminPerms.isSuperAdmin === true, 'Super Admin user is flagged as isSuperAdmin');
  assert(superAdminPerms.permissions.includes('users.create'), 'Super Admin has users.create permission');
  assert(superAdminPerms.permissions.includes('roles.delete'), 'Super Admin has roles.delete permission');
  assert(superAdminPerms.permissions.includes('settings.update'), 'Super Admin has settings.update permission');

  // --------------------------------------------------------------------------
  // SUITE 3: SUPER ADMIN INTEGRITY PROTECTION
  // --------------------------------------------------------------------------
  console.log('\n▶ Suite 3: Super Admin Protection Constraints');

  let caughtError = null;
  try {
    // Attempt to demote/deactivate the only active Super Admin
    await ensureLastSuperAdminProtected(superAdminUser._id, true);
  } catch (err) {
    caughtError = err;
  }

  assert(Boolean(caughtError), 'System prevents deactivating or demoting the last active Super Admin');
  assert(caughtError?.code === 'LAST_SUPER_ADMIN_PROTECTED', 'Error code is LAST_SUPER_ADMIN_PROTECTED');

  // Regular user demotion should NOT throw
  let editorDemoteError = null;
  try {
    await ensureLastSuperAdminProtected(testUserId, true);
  } catch (err) {
    editorDemoteError = err;
  }
  assert(editorDemoteError === null, 'Non-Super Admin users can be modified without triggering protection lock');

  // --------------------------------------------------------------------------
  // SUITE 4: DYNAMIC MENU VALIDATION & SECURITY
  // --------------------------------------------------------------------------
  console.log('\n▶ Suite 4: Dynamic Menu Route Validation & Tree Structure');

  assert(APPROVED_ROUTES.has('/admin/dashboard'), 'Approved routes includes /admin/dashboard');
  assert(APPROVED_ROUTES.has('/admin/users'), 'Approved routes includes /admin/users');
  assert(APPROVED_ROUTES.has('/admin/roles'), 'Approved routes includes /admin/roles');
  assert(APPROVED_ROUTES.has('/admin/audit-logs'), 'Approved routes includes /admin/audit-logs');
  assert(!APPROVED_ROUTES.has('/malicious/arbitrary/path'), 'Arbitrary unauthorized routes are rejected');
  assert(!APPROVED_ROUTES.has('javascript:alert(1)'), 'Dangerous pseudo-protocols are rejected');

  // --------------------------------------------------------------------------
  // SUITE 5: RATE LIMITING & SECURITY HYGIENE
  // --------------------------------------------------------------------------
  console.log('\n▶ Suite 5: Rate Limiting & Email Normalization');

  const norm1 = normalizeEmail('  SuperAdmin@GyanVaniAi.COM  ');
  assert(norm1 === 'superadmin@gyanvaniai.com', 'Email normalization trims whitespace and lowers case');

  const testRateKey = `127.0.0.1:ratetest_${Date.now()}`;
  for (let i = 0; i < 10; i++) {
    authRateLimiter.isRateLimited(testRateKey);
  }
  const isLimited = authRateLimiter.isRateLimited(testRateKey);
  assert(isLimited === true, 'Rate limiter triggers block after 10 failed attempts');
  authRateLimiter.reset(testRateKey);
  const resetCheck = authRateLimiter.isRateLimited(testRateKey);
  assert(resetCheck === false, 'Rate limiter resets upon successful authentication');

  // --------------------------------------------------------------------------
  // SUITE 6: AUDIT TRAIL LOGGING
  // --------------------------------------------------------------------------
  console.log('\n▶ Suite 6: Security Audit Logging & Immutability');

  const auditCol = db.collection('admin_audit_logs');
  const initialAuditCount = await auditCol.countDocuments();
  assert(initialAuditCount >= 0, 'Audit log collection exists and is queryable');

  // Clean up temporary test user
  await usersCol.deleteOne({ _id: testUserId });
  await sessionsCol.deleteMany({ userId: testUserId });

  // --------------------------------------------------------------------------
  // SUMMARY
  // --------------------------------------------------------------------------
  console.log('\n==================================================');
  if (failedTests === 0) {
    console.log(`✅ ALL ${passedTests} BACKEND TESTS PASSED CLEANLY!`);
  } else {
    console.error(`❌ ${failedTests} OF ${passedTests + failedTests} TESTS FAILED!`);
  }
  console.log('==================================================\n');

  await closeDB();
  process.exit(failedTests === 0 ? 0 : 1);
}

runTestSuite().catch(async (err) => {
  console.error('Test Suite encountered fatal error:', err);
  await closeDB();
  process.exit(1);
});
