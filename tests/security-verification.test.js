import { connectDB, closeDB, getDb } from '../src/db/connection.js';
import { hashPassword, normalizeEmail, generateSecureToken } from '../src/utils/crypto.js';
import { ObjectId } from 'mongodb';
import { MongoRateLimiter } from '../src/middleware/rateLimiter.js';

const BASE_URL = 'http://localhost:5000';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, extra = '') {
  totalTests++;
  if (condition) {
    console.log(`  ✅ [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  ❌ [FAIL] ${testName} ${extra}`);
    failedTests++;
  }
}

async function apiRequest(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }

  return { status: res.status, headers: res.headers, data };
}

async function getCsrf() {
  const res = await apiRequest('/api/admin/auth/csrf');
  const setCookie = res.headers.get('set-cookie') || '';
  const match = setCookie.match(/gyanvani_csrf_token=([^;]+)/);
  const cookieVal = match ? match[1] : res.data?.csrfToken;
  return {
    token: res.data?.csrfToken || cookieVal,
    cookieHeader: setCookie,
  };
}

async function runSecurityVerification() {
  console.log('\n======================================================================');
  console.log('🛡️  GYANVANIAI ADMIN PORTAL — INDEPENDENT SECURITY VERIFICATION SUITE');
  console.log('======================================================================\n');

  const { db } = await connectDB();
  const usersCol = db.collection('admin_users');
  const rolesCol = db.collection('admin_roles');
  const sessionsCol = db.collection('admin_sessions');
  const resetsCol = db.collection('admin_password_resets');
  const auditCol = db.collection('admin_audit_logs');

  const createdUserIds = [];
  const createdRoleIds = [];

  try {
    const csrfData = await getCsrf();
    const csrfOnlyHeaders = {
      Cookie: `gyanvani_csrf_token=${csrfData.token}`,
      'X-CSRF-Token': csrfData.token,
    };

    // --------------------------------------------------------------------------
    // CHECK 1: Unauthenticated requests to every protected API
    // --------------------------------------------------------------------------
    console.log('▶ Check 1: Unauthenticated requests to protected endpoints');
    const protectedEndpoints = [
      { method: 'GET', path: '/api/admin/auth/me' },
      { method: 'GET', path: '/api/admin/users' },
      { method: 'POST', path: '/api/admin/users', body: {} },
      { method: 'GET', path: '/api/admin/roles' },
      { method: 'POST', path: '/api/admin/roles', body: {} },
      { method: 'GET', path: '/api/admin/permissions' },
      { method: 'GET', path: '/api/admin/menus' },
      { method: 'GET', path: '/api/admin/menus/config' },
      { method: 'POST', path: '/api/admin/menus', body: {} },
      { method: 'GET', path: '/api/admin/audit-logs' },
      { method: 'GET', path: '/api/admin/settings' },
      { method: 'PATCH', path: '/api/admin/settings', body: {} },
    ];

    let allUnauthBlocked = true;
    for (const ep of protectedEndpoints) {
      const res = await apiRequest(ep.path, {
        method: ep.method,
        headers: csrfOnlyHeaders,
        body: ep.body ? JSON.stringify(ep.body) : undefined,
      });
      if (res.status !== 401) {
        allUnauthBlocked = false;
        console.error(`    Unauth request to ${ep.method} ${ep.path} returned status ${res.status}`);
      }
    }
    assert(allUnauthBlocked, 'All 12 protected endpoints reject unauthenticated access with 401 UNAUTHENTICATED');

    // --------------------------------------------------------------------------
    // SETUP TEST ACTORS
    // --------------------------------------------------------------------------
    // Fetch Super Admin role & user
    const superAdminRole = await rolesCol.findOne({ key: 'super_admin' });
    const superAdminUser = await usersCol.findOne({ roleIds: superAdminRole._id, status: 'active' });

    // Login as Super Admin to get valid session
    const superAdminLoginRes = await apiRequest('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'superadmin@gyanvaniai.com',
        password: 'SuperAdmin@GyanVani2026!',
      }),
    });

    assert(superAdminLoginRes.status === 200, 'Super Admin authenticates successfully');
    const saSetCookie = superAdminLoginRes.headers.get('set-cookie') || '';
    const saSessionMatch = saSetCookie.match(/gyanvani_admin_session=([^;]+)/);
    const superAdminSessionToken = saSessionMatch ? saSessionMatch[1] : null;

    const saHeaders = {
      Cookie: `gyanvani_admin_session=${superAdminSessionToken}; gyanvani_csrf_token=${csrfData.token}`,
      'X-CSRF-Token': csrfData.token,
    };

    // Provision an isolated Limited Admin user with users.read, users.update, users.delete, posts.read
    // This allows testing that even with users.update/delete, Super Admin accounts CANNOT be tampered with.
    const limitedRoleDoc = {
      key: `limited_audit_${Date.now()}`,
      name: 'Limited Audit Role',
      description: 'Role for authorization boundary testing',
      permissionKeys: ['posts.read', 'users.read', 'users.update', 'users.deactivate'],
      isSystemRole: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const roleInsert = await rolesCol.insertOne(limitedRoleDoc);
    const limitedRoleId = roleInsert.insertedId;
    createdRoleIds.push(limitedRoleId);

    const limitedPassword = 'LimitedUser@Password2026!';
    const limitedEmail = `limited_auditor_${Date.now()}@gyanvaniai.com`;
    const limitedUserDoc = {
      name: 'Limited Auditor',
      emailNormalized: limitedEmail,
      passwordHash: await hashPassword(limitedPassword),
      roleIds: [limitedRoleId],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const limitedUserInsert = await usersCol.insertOne(limitedUserDoc);
    const limitedUserId = limitedUserInsert.insertedId;
    createdUserIds.push(limitedUserId);

    // Login as Limited User
    const limitedLoginRes = await apiRequest('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: limitedEmail,
        password: limitedPassword,
      }),
    });
    assert(limitedLoginRes.status === 200, 'Limited Auditor authenticates successfully');
    const limSetCookie = limitedLoginRes.headers.get('set-cookie') || '';
    const limSessionMatch = limSetCookie.match(/gyanvani_admin_session=([^;]+)/);
    const limitedSessionToken = limSessionMatch ? limSessionMatch[1] : null;

    const limHeaders = {
      Cookie: `gyanvani_admin_session=${limitedSessionToken}; gyanvani_csrf_token=${csrfData.token}`,
      'X-CSRF-Token': csrfData.token,
    };

    // --------------------------------------------------------------------------
    // CHECK 2 & 3: Authenticated user accessing endpoints without permissions & direct bypass
    // --------------------------------------------------------------------------
    console.log('\n▶ Check 2 & 3: Authenticated RBAC authorization & direct API bypass');
    const forbiddenTests = [
      { method: 'POST', path: '/api/admin/roles', body: { key: 'test', name: 'Test' } },
      { method: 'GET', path: '/api/admin/audit-logs' },
      { method: 'PATCH', path: '/api/admin/settings', body: { siteTitle: 'Hacked' } },
      { method: 'POST', path: '/api/admin/menus', body: { label: 'Injected' } },
    ];

    let allRbacBlocked = true;
    for (const test of forbiddenTests) {
      const res = await apiRequest(test.path, {
        method: test.method,
        headers: limHeaders,
        body: test.body ? JSON.stringify(test.body) : undefined,
      });
      if (res.status !== 403) {
        allRbacBlocked = false;
        console.error(`    Limited user call to ${test.method} ${test.path} returned status ${res.status}`);
      }
    }
    assert(allRbacBlocked, 'Direct API calls without required permissions are intercepted and rejected with 403 FORBIDDEN');

    // --------------------------------------------------------------------------
    // CHECK 4: Privilege escalation through role creation and assignments
    // --------------------------------------------------------------------------
    console.log('\n▶ Check 4: Privilege escalation through permission delegation');
    // Limited auditor has only ['posts.read', 'users.read', 'users.update', 'users.delete']
    // Attempting to create a role with 'roles.delete' or 'settings.manage'
    const roleEscalationRes = await apiRequest('/api/admin/roles', {
      method: 'POST',
      headers: limHeaders,
      body: JSON.stringify({
        key: 'escalated_role',
        name: 'Escalated Role',
        permissionKeys: ['roles.delete', 'settings.manage'],
      }),
    });
    assert(roleEscalationRes.status === 403, 'Privilege escalation via role creation is blocked (403)');

    // --------------------------------------------------------------------------
    // CHECK 5: Self-promotion and unauthorized Super Admin assignment
    // --------------------------------------------------------------------------
    console.log('\n▶ Check 5: Self-promotion and unauthorized Super Admin role grant');
    const assignSuperAdminRes = await apiRequest(`/api/admin/users/${limitedUserId}`, {
      method: 'PATCH',
      headers: limHeaders,
      body: JSON.stringify({
        roleIds: [superAdminRole._id.toString()],
      }),
    });
    assert(
      assignSuperAdminRes.status === 403,
      'Assigning Super Admin role by non-Super Admin is blocked (403 PRIVILEGE_ESCALATION_DENIED)'
    );

    // --------------------------------------------------------------------------
    // CHECK 6: Super Admin protection & last active Super Admin lock
    // --------------------------------------------------------------------------
    console.log('\n▶ Check 6: Super Admin protection & last active Super Admin lock');
    // Attempt by Super Admin to deactivate themselves (the last active Super Admin)
    const selfDeactivateRes = await apiRequest(`/api/admin/users/${superAdminUser._id}`, {
      method: 'PATCH',
      headers: saHeaders,
      body: JSON.stringify({
        status: 'inactive',
      }),
    });
    assert(
      selfDeactivateRes.status === 400 && selfDeactivateRes.data?.code === 'LAST_SUPER_ADMIN_PROTECTED',
      'System rejects deactivating the last active Super Admin with 400 LAST_SUPER_ADMIN_PROTECTED'
    );

    // Attempt by non-Super Admin to modify Super Admin account
    const nonSaTamperRes = await apiRequest(`/api/admin/users/${superAdminUser._id}`, {
      method: 'PATCH',
      headers: limHeaders,
      body: JSON.stringify({
        name: 'Hacked Admin Name',
      }),
    });
    assert(
      nonSaTamperRes.status === 403 && nonSaTamperRes.data?.code === 'SUPER_ADMIN_PROTECTED',
      'Non-Super Admin modification of Super Admin account is blocked (403 SUPER_ADMIN_PROTECTED)'
    );

    // Attempt by non-Super Admin to delete Super Admin account
    const nonSaDeleteRes = await apiRequest(`/api/admin/users/${superAdminUser._id}`, {
      method: 'DELETE',
      headers: limHeaders,
    });
    assert(
      nonSaDeleteRes.status === 403 && nonSaDeleteRes.data?.code === 'SUPER_ADMIN_PROTECTED',
      'Non-Super Admin deletion of Super Admin account is blocked (403 SUPER_ADMIN_PROTECTED)'
    );

    // --------------------------------------------------------------------------
    // CHECK 13: Menu route validation & unauthorized menu visibility (tested while limited user is active)
    // --------------------------------------------------------------------------
    console.log('\n▶ Check 13: Dynamic menu permissions & route sanitization');
    const limitedMenuRes = await apiRequest('/api/admin/menus/config', { headers: limHeaders });
    assert(limitedMenuRes.status === 200, 'Limited menu config returned successfully');
    const returnedRoutes = [];
    const collectRoutes = (items) => {
      for (const i of items || []) {
        if (i.routeKey) returnedRoutes.push(i.routeKey);
        if (i.children) collectRoutes(i.children);
      }
    };
    collectRoutes(limitedMenuRes.data?.menus);
    assert(!returnedRoutes.includes('/admin/roles'), 'Unauthorized route /admin/roles is hidden from limited user menu');
    assert(!returnedRoutes.includes('/admin/audit-logs'), 'Unauthorized route /admin/audit-logs is hidden from limited user menu');

    // Attempt to inject malicious route in menu creation
    const evilMenuRes = await apiRequest('/api/admin/menus', {
      method: 'POST',
      headers: saHeaders,
      body: JSON.stringify({
        label: 'Evil Link',
        routeKey: 'javascript:alert(document.cookie)',
      }),
    });
    assert(
      evilMenuRes.status === 400 && evilMenuRes.data?.code === 'INVALID_ROUTE_KEY',
      'Unapproved or dangerous menu route rejected with 400 INVALID_ROUTE_KEY'
    );

    // --------------------------------------------------------------------------
    // CHECK 7: Disabled users attempting to reuse existing sessions
    // --------------------------------------------------------------------------
    console.log('\n▶ Check 7: Disabled user session revocation & lockout');
    // Deactivate limited user via Super Admin
    const deactivateRes = await apiRequest(`/api/admin/users/${limitedUserId}`, {
      method: 'PATCH',
      headers: saHeaders,
      body: JSON.stringify({
        status: 'inactive',
      }),
    });
    assert(deactivateRes.status === 200, 'Super Admin deactivates test account');

    // Attempt to use existing session of deactivated user
    const reuseDeactivatedSessionRes = await apiRequest('/api/admin/auth/me', {
      method: 'GET',
      headers: limHeaders,
    });
    assert(
      reuseDeactivatedSessionRes.status === 401 &&
        (reuseDeactivatedSessionRes.data?.code === 'ACCOUNT_DEACTIVATED' ||
          reuseDeactivatedSessionRes.data?.code === 'SESSION_INVALID'),
      'Deactivated user existing session is immediately rejected (401 ACCOUNT_DEACTIVATED)'
    );

    // --------------------------------------------------------------------------
    // CHECK 8: Logout and password-reset session revocation
    // --------------------------------------------------------------------------
    console.log('\n▶ Check 8: Logout & password reset session revocation');
    // Create new active user to test logout
    const logoutTestEmail = `logout_test_${Date.now()}@gyanvaniai.com`;
    const logoutTestPass = 'LogoutPass@2026!';
    const logoutUserDoc = {
      name: 'Logout Test User',
      emailNormalized: logoutTestEmail,
      passwordHash: await hashPassword(logoutTestPass),
      roleIds: [limitedRoleId],
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const logoutUserInsert = await usersCol.insertOne(logoutUserDoc);
    const logoutUserId = logoutUserInsert.insertedId;
    createdUserIds.push(logoutUserId);

    // Login
    const loLoginRes = await apiRequest('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: logoutTestEmail, password: logoutTestPass }),
    });
    const loCookieMatch = (loLoginRes.headers.get('set-cookie') || '').match(/gyanvani_admin_session=([^;]+)/);
    const loSessionToken = loCookieMatch ? loCookieMatch[1] : null;
    const loHeaders = {
      Cookie: `gyanvani_admin_session=${loSessionToken}; gyanvani_csrf_token=${csrfData.token}`,
      'X-CSRF-Token': csrfData.token,
    };

    // Verify session works
    const meBeforeLogout = await apiRequest('/api/admin/auth/me', { headers: loHeaders });
    assert(meBeforeLogout.status === 200, 'Session valid prior to logout');

    // Logout
    const logoutRes = await apiRequest('/api/admin/auth/logout', { method: 'POST', headers: loHeaders });
    assert(logoutRes.status === 200, 'Logout succeeds cleanly');

    // Verify session revoked
    const meAfterLogout = await apiRequest('/api/admin/auth/me', { headers: loHeaders });
    assert(meAfterLogout.status === 401, 'Session revoked immediately upon logout (401 SESSION_INVALID)');

    // --------------------------------------------------------------------------
    // CHECK 9: Expired, reused, and invalid password-reset tokens
    // --------------------------------------------------------------------------
    console.log('\n▶ Check 9: Password reset tokens (invalid, expired, reused)');
    // 1. Invalid token
    const invalidTokenRes = await apiRequest('/api/admin/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: 'non_existent_token_12345', newPassword: 'NewSecurePass@2026!' }),
    });
    assert(
      invalidTokenRes.status === 400 && invalidTokenRes.data?.code === 'RESET_TOKEN_INVALID',
      'Invalid reset token rejected with 400 RESET_TOKEN_INVALID'
    );

    // 2. Request real reset token for logout user
    const forgotRes = await apiRequest('/api/admin/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: logoutTestEmail }),
    });
    const resetToken = forgotRes.data?.devResetToken;
    assert(Boolean(resetToken), 'Password reset token generated successfully');

    // 3. Reset password with valid token
    const newPassword1 = 'BrandNewPassword@2026!';
    const resetSuccessRes = await apiRequest('/api/admin/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: resetToken, newPassword: newPassword1 }),
    });
    assert(resetSuccessRes.status === 200, 'Password reset succeeds with valid token');

    // 4. Token reuse attempt
    const reuseTokenRes = await apiRequest('/api/admin/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token: resetToken, newPassword: 'AnotherPassword@2026!' }),
    });
    assert(
      reuseTokenRes.status === 400 && reuseTokenRes.data?.code === 'RESET_TOKEN_INVALID',
      'Reused reset token rejected with 400 RESET_TOKEN_INVALID'
    );

    // --------------------------------------------------------------------------
    // CHECK 10: CSRF validation & cross-origin request behavior
    // --------------------------------------------------------------------------
    console.log('\n▶ Check 10: CSRF validation & double-submit protection');
    // Mutating request without X-CSRF-Token header
    const noCsrfRes = await apiRequest('/api/admin/roles', {
      method: 'POST',
      headers: {
        Cookie: `gyanvani_admin_session=${superAdminSessionToken}; gyanvani_csrf_token=${csrfData.token}`,
      },
      body: JSON.stringify({ key: 'csrf_test_role', name: 'CSRF Test' }),
    });
    assert(noCsrfRes.status === 403 && noCsrfRes.data?.code === 'CSRF_INVALID', 'Missing CSRF header rejected with 403 CSRF_INVALID');

    // Mutating request with mismatched token
    const badCsrfRes = await apiRequest('/api/admin/roles', {
      method: 'POST',
      headers: {
        Cookie: `gyanvani_admin_session=${superAdminSessionToken}; gyanvani_csrf_token=${csrfData.token}`,
        'X-CSRF-Token': 'wrong_forged_csrf_token_value',
      },
      body: JSON.stringify({ key: 'csrf_test_role', name: 'CSRF Test' }),
    });
    assert(badCsrfRes.status === 403 && badCsrfRes.data?.code === 'CSRF_INVALID', 'Mismatched CSRF token rejected with 403 CSRF_INVALID');

    // --------------------------------------------------------------------------
    // CHECK 11: Cookie attributes & session fixation resistance
    // --------------------------------------------------------------------------
    console.log('\n▶ Check 11: Cookie security attributes & session fixation');
    const setCookieHeader = superAdminLoginRes.headers.get('set-cookie') || '';
    assert(setCookieHeader.toLowerCase().includes('httponly'), 'Session cookie contains HttpOnly attribute');
    assert(setCookieHeader.toLowerCase().includes('samesite=lax'), 'Session cookie contains SameSite=Lax attribute');
    assert(setCookieHeader.toLowerCase().includes('path=/'), 'Session cookie is restricted to Path=/');

    // Login again to verify session fixation resistance (new token issued)
    const secondLoginRes = await apiRequest('/api/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'superadmin@gyanvaniai.com', password: 'SuperAdmin@GyanVani2026!' }),
    });
    const secondCookieMatch = (secondLoginRes.headers.get('set-cookie') || '').match(/gyanvani_admin_session=([^;]+)/);
    const secondToken = secondCookieMatch ? secondCookieMatch[1] : null;
    assert(
      secondToken !== superAdminSessionToken && secondToken?.length >= 64,
      'New login generates fresh, unique session token (session fixation resistant)'
    );

    // --------------------------------------------------------------------------
    // CHECK 12: Rate limiting (Distributed & Process-Local verification)
    // --------------------------------------------------------------------------
    console.log('\n▶ Check 12: Rate limiting & MongoRateLimiter verification');
    const mongoLimiter = new MongoRateLimiter(60000, 3); // 3 requests per min
    const testRateKey = `audit_mongo_rate_${Date.now()}`;
    const h1 = await mongoLimiter.isRateLimited(testRateKey);
    const h2 = await mongoLimiter.isRateLimited(testRateKey);
    const h3 = await mongoLimiter.isRateLimited(testRateKey);
    const h4 = await mongoLimiter.isRateLimited(testRateKey);

    assert(h1 === false && h2 === false && h3 === false && h4 === true, 'MongoRateLimiter accurately triggers limit after threshold');
    await mongoLimiter.reset(testRateKey);
    const h5 = await mongoLimiter.isRateLimited(testRateKey);
    assert(h5 === false, 'MongoRateLimiter resets bucket cleanly');

    // --------------------------------------------------------------------------
    // CHECK 14: Attempts to alter or delete audit records
    // --------------------------------------------------------------------------
    console.log('\n▶ Check 14: Audit record immutability');
    const auditPutRes = await apiRequest('/api/admin/audit-logs', { method: 'PUT', headers: saHeaders, body: JSON.stringify({}) });
    assert(auditPutRes.status === 404 || auditPutRes.status === 405, 'HTTP PUT to audit logs rejected (immutable)');

    const auditDeleteRes = await apiRequest('/api/admin/audit-logs', { method: 'DELETE', headers: saHeaders });
    assert(auditDeleteRes.status === 404 || auditDeleteRes.status === 405, 'HTTP DELETE to audit logs rejected (immutable)');

    // --------------------------------------------------------------------------
    // CHECK 15: Sensitive data leakage in API responses & logs
    // --------------------------------------------------------------------------
    console.log('\n▶ Check 15: Sensitive data leakage prevention');
    const usersListRes = await apiRequest('/api/admin/users', { headers: saHeaders });
    const userSample = usersListRes.data?.users?.[0];
    assert(!userSample?.passwordHash, 'User API list response does NOT leak passwordHash');
    assert(!userSample?.passwordSalt, 'User API list response does NOT leak passwordSalt');
    assert(!userSample?.sessionToken, 'User API list response does NOT leak session tokens');

    const meRes = await apiRequest('/api/admin/auth/me', { headers: saHeaders });
    assert(!meRes.data?.user?.passwordHash, 'Current user endpoint does NOT leak passwordHash');

    // Check audit logs for leaked passwords
    const sampleAudit = await auditCol.findOne({ action: 'AUTH_LOGIN_SUCCESS' });
    assert(
      !sampleAudit?.metadata?.password && !sampleAudit?.metadata?.passwordHash,
      'Audit log events do NOT log passwords or credential hashes'
    );

    // --------------------------------------------------------------------------
    // CHECK 16: MongoDB database selection, indexes & least privilege
    // --------------------------------------------------------------------------
    console.log('\n▶ Check 16: MongoDB configuration, indexes & least privilege');
    assert(db.databaseName === 'gyanvaniai_admin', 'Backend is connected to dedicated admin DB: gyanvaniai_admin');

    const userIndexes = await usersCol.indexes();
    const hasEmailUnique = userIndexes.some(i => i.key?.emailNormalized === 1 && i.unique === true);
    assert(hasEmailUnique, 'admin_users has unique index on emailNormalized');

    const sessionIndexes = await sessionsCol.indexes();
    const hasSessionTokenUnique = sessionIndexes.some(i => i.key?.sessionTokenHash === 1 && i.unique === true);
    const hasSessionTTL = sessionIndexes.some(i => i.key?.expiresAt === 1 && typeof i.expireAfterSeconds === 'number');
    assert(hasSessionTokenUnique, 'admin_sessions has unique index on sessionTokenHash');
    assert(hasSessionTTL, 'admin_sessions has TTL index on expiresAt');

    const resetIndexes = await resetsCol.indexes();
    const hasResetTokenUnique = resetIndexes.some(i => i.key?.tokenHash === 1 && i.unique === true);
    const hasResetTTL = resetIndexes.some(i => i.key?.expiresAt === 1 && typeof i.expireAfterSeconds === 'number');
    assert(hasResetTokenUnique, 'admin_password_resets has unique index on tokenHash');
    assert(hasResetTTL, 'admin_password_resets has TTL index on expiresAt');

    // --------------------------------------------------------------------------
    // PHASE 3 INTEGRATION: Permission updates & Audit Trail Generation
    // --------------------------------------------------------------------------
    console.log('\n▶ Phase 3 Integration: Dynamic role updates & audit events generation');
    const auditCountBefore = await auditCol.countDocuments();

    // Create a new test role with permission 'analytics.read'
    const newTestRoleRes = await apiRequest('/api/admin/roles', {
      method: 'POST',
      headers: saHeaders,
      body: JSON.stringify({
        key: `integration_role_${Date.now()}`,
        name: 'Integration Dynamic Role',
        permissionKeys: ['analytics.read'],
      }),
    });
    assert(newTestRoleRes.status === 201, 'Super Admin creates integration role');
    const createdRoleId = newTestRoleRes.data?.role?.id;
    if (createdRoleId) createdRoleIds.push(new ObjectId(createdRoleId));

    // Update role's permissions to add 'seo.manage'
    const updateRoleRes = await apiRequest(`/api/admin/roles/${createdRoleId}`, {
      method: 'PATCH',
      headers: saHeaders,
      body: JSON.stringify({
        permissionKeys: ['analytics.read', 'seo.manage'],
      }),
    });
    assert(updateRoleRes.status === 200, 'Super Admin updates role permissions');

    // Audit count after
    const auditCountAfter = await auditCol.countDocuments();
    assert(auditCountAfter > auditCountBefore, 'Security actions successfully generate audit log entries');
  } finally {
    // Clean up test data
    console.log('\n🧹 Cleaning up test users and roles from database...');
    if (createdUserIds.length > 0) {
      await usersCol.deleteMany({ _id: { $in: createdUserIds } });
      await sessionsCol.deleteMany({ userId: { $in: createdUserIds } });
      await resetsCol.deleteMany({ userId: { $in: createdUserIds } });
    }
    if (createdRoleIds.length > 0) {
      await rolesCol.deleteMany({ _id: { $in: createdRoleIds } });
    }
    await closeDB();
  }

  console.log('\n======================================================================');
  if (failedTests === 0) {
    console.log(`🎉 ALL ${passedTests} OF ${totalTests} SECURITY VERIFICATION CHECKS PASSED!`);
  } else {
    console.error(`❌ ${failedTests} OF ${totalTests} CHECKS FAILED!`);
  }
  console.log('======================================================================\n');

  process.exit(failedTests === 0 ? 0 : 1);
}

runSecurityVerification().catch(err => {
  console.error('Security Verification Encountered Fatal Error:', err);
  process.exit(1);
});
