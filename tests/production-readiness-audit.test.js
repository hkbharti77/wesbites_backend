import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);
import { MongoClient, ObjectId } from 'mongodb';
import crypto from 'crypto';
import dotenv from 'dotenv';
dotenv.config();

const API_BASE = 'http://127.0.0.1:5000/api';

async function runAudit() {
  console.log('===============================================================');
  console.log('🔬 GYANVANIAI NEWSLETTER ENGINE — PRODUCTION READINESS AUDIT');
  console.log('===============================================================\n');

  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  const db = client.db(process.env.MONGODB_DB_NAME || 'crm_admin_portal');

  const results = {
    indexes: {},
    raceCondition: {},
    tokenHashing: {},
    publicUnsubscribeNoToken: {},
    doubleOptInScanner: {},
    rbac: {},
    honeypot: {},
    formulaInjection: {},
    auditLogs: {},
  };

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 1: MongoDB Indexes Audit
  // ──────────────────────────────────────────────────────────────────────────
  console.log('--- 1. AUDITING MONGODB INDEXES ---');
  const indexes = await db.collection('newsletter_subscribers').indexes();
  console.log('Existing Indexes on newsletter_subscribers:', indexes.map(i => ({ name: i.name, key: i.key, unique: i.unique, sparse: i.sparse })));
  
  const hasEmailUnique = indexes.some(i => i.key.emailNormalized === 1 && i.unique === true);
  const hasTokenHashUnique = indexes.some(i => i.key.unsubscribeTokenHash === 1 && i.unique === true && i.sparse === true);
  const hasStatusCompound = indexes.some(i => i.key.status === 1 && i.key['consent.recordedAt'] === -1);
  
  results.indexes = {
    emailNormalizedUnique: hasEmailUnique,
    unsubscribeTokenHashUniqueSparse: hasTokenHashUnique,
    statusCompoundIndex: hasStatusCompound,
  };
  console.log('Index Results:', results.indexes);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 2: Token Hashing Verification
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 2. AUDITING TOKEN HASHING & DATABASE PERSISTENCE ---');
  const testEmail = `audit_token_${Date.now()}@test.com`;
  const subRes = await fetch(`${API_BASE}/public/newsletter/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, source: 'audit_test' }),
  });
  const subData = await subRes.json();
  const subDoc = await db.collection('newsletter_subscribers').findOne({ emailNormalized: testEmail.toLowerCase() });

  const rawTokenReturned = subData.previewToken;
  const expectedHash = crypto.createHash('sha256').update(rawTokenReturned).digest('hex');
  const hashMatches = subDoc.unsubscribeTokenHash === expectedHash;
  const noRawTokenStored = !subDoc.token && !subDoc.rawToken && !subDoc.previewToken;

  results.tokenHashing = {
    rawTokenLength: rawTokenReturned?.length,
    hashLength: subDoc.unsubscribeTokenHash?.length,
    hashMatchesSha256: hashMatches,
    noRawTokenInMongo: noRawTokenStored,
  };
  console.log('Token Hashing Results:', results.tokenHashing);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 3: Public Unsubscribe Without Token (Requirement 5)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 3. TESTING PUBLIC UNSUBSCRIBE REQUIRING VALID TOKEN (NO EMAIL ALONE) ---');
  // Attempt 3a: Verify with email only (no token)
  // Attempt 3a: Verify with email only (no token) -> MUST BE REJECTED
  const verifyEmailOnlyRes = await fetch(`${API_BASE}/public/newsletter/unsubscribe/verify?email=${encodeURIComponent(testEmail)}`);
  const verifyEmailOnlyData = await verifyEmailOnlyRes.json();
  console.log('Verify with email alone response (status ' + verifyEmailOnlyRes.status + '):', verifyEmailOnlyData);

  // Attempt 3b: Unsubscribe with email only (no token) -> MUST BE REJECTED
  const unsubEmailOnlyRes = await fetch(`${API_BASE}/public/newsletter/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testEmail, reason: 'malicious_test' }),
  });
  const unsubEmailOnlyData = await unsubEmailOnlyRes.json();
  console.log('Unsubscribe with email alone response (status ' + unsubEmailOnlyRes.status + '):', unsubEmailOnlyData);

  const subDocAfterEmailOnly = await db.collection('newsletter_subscribers').findOne({ _id: subDoc._id });
  const remainedSubscribed = subDocAfterEmailOnly.status === 'subscribed';
  console.log('Did target remain subscribed against email-only attack?', remainedSubscribed ? 'YES (PROTECTED)' : 'NO (VULNERABLE)');

  // Attempt 3c: Verify with valid token -> MUST BE ACCEPTED
  const verifyValidTokenRes = await fetch(`${API_BASE}/public/newsletter/unsubscribe/verify?token=${rawTokenReturned}`);
  const verifyValidTokenData = await verifyValidTokenRes.json();

  // Attempt 3d: Unsubscribe with valid token -> MUST BE ACCEPTED
  const unsubValidTokenRes = await fetch(`${API_BASE}/public/newsletter/unsubscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: rawTokenReturned, reason: 'audit_verified' }),
  });
  const subDocAfterValidToken = await db.collection('newsletter_subscribers').findOne({ _id: subDoc._id });

  results.publicUnsubscribeNoToken = {
    verifyRejectsEmailAlone: verifyEmailOnlyRes.status === 400,
    unsubRejectsEmailAlone: unsubEmailOnlyRes.status === 400,
    targetRemainedSubscribed: remainedSubscribed,
    verifyAcceptsValidToken: verifyValidTokenRes.status === 200 && verifyValidTokenData.valid === true,
    unsubAcceptsValidToken: unsubValidTokenRes.status === 200 && subDocAfterValidToken.status === 'unsubscribed',
  };

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 4: Double Opt-In Email Scanner Protection (Requirement 3)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 4. TESTING DOUBLE OPT-IN & SCANNER GET PROBING ---');
  // Create a pending subscriber
  const confirmToken = crypto.randomBytes(32).toString('hex');
  const confirmTokenHash = crypto.createHash('sha256').update(confirmToken).digest('hex');
  const pendingEmail = `pending_scanner_${Date.now()}@test.com`;
  const insertPending = await db.collection('newsletter_subscribers').insertOne({
    email: pendingEmail,
    emailNormalized: pendingEmail.toLowerCase(),
    status: 'pending_confirmation',
    confirmationTokenHash: confirmTokenHash,
    confirmationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    consent: { source: 'double_opt_in_test' },
    createdAt: new Date(),
  });

  // 4a. Probe with GET request (mimicking email scanner crawler)
  const scannerGetRes = await fetch(`${API_BASE}/public/newsletter/confirm?token=${confirmToken}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Proofpoint/Defender Bot Scanner' },
  });
  const docAfterScannerGet = await db.collection('newsletter_subscribers').findOne({ _id: insertPending.insertedId });
  console.log('Scanner GET response status:', scannerGetRes.status);
  console.log('Status after scanner GET probe (must remain pending_confirmation):', docAfterScannerGet.status);

  // 4b. Human confirmation with POST request
  const humanPostRes = await fetch(`${API_BASE}/public/newsletter/confirm?token=${confirmToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  });
  const docAfterHumanPost = await db.collection('newsletter_subscribers').findOne({ _id: insertPending.insertedId });
  console.log('Human POST response status:', humanPostRes.status);
  console.log('Status after human POST confirmation (must be subscribed):', docAfterHumanPost.status);

  results.doubleOptInScanner = {
    scannerGetDidNotActivate: docAfterScannerGet.status === 'pending_confirmation',
    humanPostActivatedSubscription: docAfterHumanPost.status === 'subscribed',
    confirmedAtTimestampSet: Boolean(docAfterHumanPost.confirmedAt),
  };

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 5: Concurrent Duplicate Subscription Race Condition (Requirement 2)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 5. TESTING CONCURRENT DUPLICATE SUBSCRIPTION RACE CONDITION ---');
  const raceEmail = `race_${Date.now()}@example.com`;
  const [res1, res2] = await Promise.all([
    fetch(`${API_BASE}/public/newsletter/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: raceEmail }),
    }),
    fetch(`${API_BASE}/public/newsletter/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: raceEmail }),
    }),
  ]);

  const [data1, data2] = await Promise.all([res1.json(), res2.json()]);
  console.log('Concurrent Request 1 status:', res1.status, data1);
  console.log('Concurrent Request 2 status:', res2.status, data2);
  results.raceCondition = {
    req1Status: res1.status,
    req2Status: res2.status,
    handledWithout500: res1.status === 200 && res2.status === 200,
    noServerError: res1.status !== 500 && res2.status !== 500,
  };

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 6: Independent RBAC Permissions Testing (Requirement 7)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 6. TESTING INDEPENDENT RBAC PERMISSIONS ---');
  // Helper to create a user with exactly ONE permission
  async function createRbacUserWithPermission(permKey) {
    const roleKey = `audit_role_${permKey}_${Date.now()}`;
    const roleInsert = await db.collection('admin_roles').insertOne({
      key: roleKey,
      name: `Role with only ${permKey}`,
      permissionKeys: [permKey],
      isSystemRole: false,
      createdAt: new Date(),
    });

    const userEmail = `user_${permKey}_${Date.now()}@test.com`;
    const userInsert = await db.collection('admin_users').insertOne({
      name: `User ${permKey}`,
      emailNormalized: userEmail.toLowerCase(),
      status: 'active',
      roleIds: [roleInsert.insertedId],
      createdAt: new Date(),
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    const sessionTokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    await db.collection('admin_sessions').insertOne({
      sessionTokenHash,
      userId: userInsert.insertedId,
      revokedAt: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    });

    return { token: rawToken, userId: userInsert.insertedId, roleId: roleInsert.insertedId };
  }

  // Create test dummy subscriber for status/delete actions
  const dummySub = await db.collection('newsletter_subscribers').insertOne({
    email: 'dummy@test.com',
    emailNormalized: 'dummy@test.com',
    status: 'subscribed',
    createdAt: new Date(),
  });
  const dummyId = dummySub.insertedId.toString();

  const csrfHeaders = {
    Cookie: 'gyanvani_csrf_token=audit_test_csrf_token_123',
    'x-csrf-token': 'audit_test_csrf_token_123',
  };

  // Test 6a: User with ONLY `subscribers.read`
  const userRead = await createRbacUserWithPermission('subscribers.read');
  const read_getList = await fetch(`${API_BASE}/admin/subscribers`, { headers: { Authorization: `Bearer ${userRead.token}` } });
  const read_patchStatus = await fetch(`${API_BASE}/admin/subscribers/${dummyId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${userRead.token}`, 'Content-Type': 'application/json', ...csrfHeaders },
    body: JSON.stringify({ status: 'unsubscribed' }),
  });
  const read_export = await fetch(`${API_BASE}/admin/subscribers/export`, { headers: { Authorization: `Bearer ${userRead.token}` } });
  const read_delete = await fetch(`${API_BASE}/admin/subscribers/${dummyId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userRead.token}`, ...csrfHeaders },
  });

  results.rbac.onlyRead = {
    getListAllowed: read_getList.status === 200,
    patchStatusForbidden: read_patchStatus.status === 403,
    exportForbidden: read_export.status === 403,
    deleteForbidden: read_delete.status === 403,
  };
  console.log('subscribers.read only isolation:', results.rbac.onlyRead);

  // Test 6b: User with ONLY `subscribers.manage`
  const userManage = await createRbacUserWithPermission('subscribers.manage');
  const manage_getList = await fetch(`${API_BASE}/admin/subscribers`, { headers: { Authorization: `Bearer ${userManage.token}` } });
  const manage_patchStatus = await fetch(`${API_BASE}/admin/subscribers/${dummyId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${userManage.token}`, 'Content-Type': 'application/json', ...csrfHeaders },
    body: JSON.stringify({ status: 'unsubscribed' }),
  });
  const manage_export = await fetch(`${API_BASE}/admin/subscribers/export`, { headers: { Authorization: `Bearer ${userManage.token}` } });
  const manage_delete = await fetch(`${API_BASE}/admin/subscribers/${dummyId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userManage.token}`, ...csrfHeaders },
  });

  results.rbac.onlyManage = {
    getListForbidden: manage_getList.status === 403,
    patchStatusAllowed: manage_patchStatus.status === 200,
    exportForbidden: manage_export.status === 403,
    deleteForbidden: manage_delete.status === 403,
  };
  console.log('subscribers.manage only isolation:', results.rbac.onlyManage);

  // Test 6c: User with ONLY `subscribers.export`
  const userExport = await createRbacUserWithPermission('subscribers.export');
  const export_getList = await fetch(`${API_BASE}/admin/subscribers`, { headers: { Authorization: `Bearer ${userExport.token}` } });
  const export_patchStatus = await fetch(`${API_BASE}/admin/subscribers/${dummyId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${userExport.token}`, 'Content-Type': 'application/json', ...csrfHeaders },
    body: JSON.stringify({ status: 'unsubscribed' }),
  });
  const export_export = await fetch(`${API_BASE}/admin/subscribers/export`, { headers: { Authorization: `Bearer ${userExport.token}` } });
  const export_delete = await fetch(`${API_BASE}/admin/subscribers/${dummyId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userExport.token}`, ...csrfHeaders },
  });

  results.rbac.onlyExport = {
    getListForbidden: export_getList.status === 403,
    patchStatusForbidden: export_patchStatus.status === 403,
    exportAllowed: export_export.status === 200,
    deleteForbidden: export_delete.status === 403,
  };
  console.log('subscribers.export only isolation:', results.rbac.onlyExport);

  // Test 6d: User with ONLY `subscribers.delete`
  const userDelete = await createRbacUserWithPermission('subscribers.delete');
  const deleteTarget = await db.collection('newsletter_subscribers').insertOne({
    email: 'delete_target@test.com',
    emailNormalized: 'delete_target@test.com',
    status: 'subscribed',
    createdAt: new Date(),
  });
  const deleteTargetId = deleteTarget.insertedId.toString();

  const delete_getList = await fetch(`${API_BASE}/admin/subscribers`, { headers: { Authorization: `Bearer ${userDelete.token}` } });
  const delete_patchStatus = await fetch(`${API_BASE}/admin/subscribers/${deleteTargetId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${userDelete.token}`, 'Content-Type': 'application/json', ...csrfHeaders },
    body: JSON.stringify({ status: 'unsubscribed' }),
  });
  const delete_export = await fetch(`${API_BASE}/admin/subscribers/export`, { headers: { Authorization: `Bearer ${userDelete.token}` } });
  const delete_delete = await fetch(`${API_BASE}/admin/subscribers/${deleteTargetId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userDelete.token}`, ...csrfHeaders },
  });

  results.rbac.onlyDelete = {
    getListForbidden: delete_getList.status === 403,
    patchStatusForbidden: delete_patchStatus.status === 403,
    exportForbidden: delete_export.status === 403,
    deleteAllowed: delete_delete.status === 200,
  };
  console.log('subscribers.delete only isolation:', results.rbac.onlyDelete);

  // ──────────────────────────────────────────────────────────────────────────
  // TEST 7: Audit Logging Inspection (Requirement 8)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('\n--- 7. AUDITING SECURITY AUDIT LOGS ---');
  const recentLogs = await db.collection('admin_audit_logs')
    .find({ action: { $in: ['SUBSCRIBER_STATUS_CHANGED', 'SUBSCRIBER_DELETED', 'SUBSCRIBERS_EXPORTED'] } })
    .sort({ createdAt: -1 })
    .limit(5)
    .toArray();
  console.log('Audit events recorded for subscriber operations:', recentLogs.map(l => ({ action: l.action, actor: l.actorEmail, target: l.targetType, outcome: l.outcome })));
  results.auditLogs = {
    statusChangeLogged: recentLogs.some(l => l.action === 'SUBSCRIBER_STATUS_CHANGED'),
    deletionLogged: recentLogs.some(l => l.action === 'SUBSCRIBER_DELETED'),
    exportLogged: recentLogs.some(l => l.action === 'SUBSCRIBERS_EXPORTED'),
  };

  // Cleanup test users, roles, sessions, dummy subscribers
  await db.collection('admin_users').deleteMany({ emailNormalized: { $regex: /^user_subscribers\./ } });
  await db.collection('admin_roles').deleteMany({ key: { $regex: /^audit_role_/ } });
  await db.collection('admin_sessions').deleteMany({ userId: { $in: [userRead.userId, userManage.userId, userExport.userId, userDelete.userId] } });
  await db.collection('newsletter_subscribers').deleteMany({ emailNormalized: { $regex: /^audit_|^race_|^pending_scanner|dummy@/ } });

  await client.close();

  console.log('\n===============================================================');
  console.log('📊 AUDIT SUMMARY JSON:');
  console.log(JSON.stringify(results, null, 2));
  console.log('===============================================================\n');
}

runAudit().catch(err => {
  console.error('Audit Script Error:', err);
  process.exit(1);
});
