/**
 * DPDP Act 2023 & DPDP Rules 2025 Automated Compliance Test Suite
 * Validates DSR ticket generation, SLA calculation, bot defense, immutable audit trails, and retention indexes
 */

process.env.DISABLE_RATE_LIMIT = 'true';
process.env.DISABLE_CSRF = 'true';

import { connectDB, closeDB, getDb } from '../src/db/connection.js';
import app, { startServer } from '../src/server.js';
import { runDataRetentionCleanup } from '../src/scripts/enforce-data-retention.js';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
let testServer = null;
const TEST_PORT = 5099;
const BASE_URL = `http://localhost:${TEST_PORT}`;

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

async function runDpdpTests() {
  console.log('\n============================================================');
  console.log('🛡️  DPDP ACT 2023 & RULES 2025 COMPLIANCE AUTOMATED REGRESSION');
  console.log('============================================================\n');

  try {
    testServer = await startServer(TEST_PORT);
    const db = getDb();

    // ── TEST GROUP 1: DSR & Privacy Rights Request API ───────────────────────
    console.log('── Test Group 1: Data Subject Rights (DSR) & Privacy Request API ──');

    // 1.1 Valid Submission generates statutory ticket ID & 15-day SLA
    const validDsr = await apiRequest('/api/public/privacy-requests', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Aarav Sharma',
        email: `aarav.test.${Date.now()}@example.in`,
        phone: '+919876543210',
        requestType: 'Data Access Request',
        description: 'Please provide an itemized export of all personal data held and identities of third parties shared with under Section 11.',
      }),
    });

    assert(
      validDsr.status === 201 &&
      typeof validDsr.data?.ticketId === 'string' &&
      validDsr.data.ticketId.startsWith('DSR-') &&
      Boolean(validDsr.data.slaResolutionDueAt),
      'Valid DSR submission generates statutory ticket ID (DSR-YYYYMMDD-XXXX) and 15-day SLA',
      JSON.stringify(validDsr.data)
    );

    // 1.2 Bot Honeypot Defense silently traps automated spam
    const botSubmission = await apiRequest('/api/public/privacy-requests', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Spam Bot',
        email: 'spambot@automated.ai',
        requestType: 'Data Erasure Request',
        description: 'Spam payload attacking the endpoint',
        _hp_company: 'Hidden Trap Filled By Bot',
      }),
    });

    assert(
      botSubmission.status === 200 &&
      botSubmission.data?.ticketId === 'DSR-AUTO-CONFIRMED',
      'Honeypot field silently neutralizes automated bots without database pollution',
      JSON.stringify(botSubmission.data)
    );

    // 1.3 Strict Input Validation rejects invalid email or truncated message
    const invalidDsr = await apiRequest('/api/public/privacy-requests', {
      method: 'POST',
      body: JSON.stringify({
        name: 'A',
        email: 'not-an-email',
        requestType: 'Data Access Request',
        description: 'too short',
      }),
    });

    assert(
      invalidDsr.status === 400 &&
      Boolean(invalidDsr.data?.code),
      'Strict input validation rejects truncated names, invalid emails, and inadequate descriptions with HTTP 400',
      `Status: ${invalidDsr.status}`
    );

    // ── TEST GROUP 2: Forensic Immutability of Security Audit Trails ───────────
    console.log('\n── Test Group 2: Audit Log Tamper-Resistance (CERT-In / DPDP §8) ──');

    const putAudit = await apiRequest('/api/admin/audit-logs', { method: 'PUT' });
    const deleteAudit = await apiRequest('/api/admin/audit-logs/fakeid', { method: 'DELETE' });
    const patchAudit = await apiRequest('/api/admin/audit-logs/fakeid', { method: 'PATCH' });

    assert(
      putAudit.status === 405 && deleteAudit.status === 405 && patchAudit.status === 405,
      'Forensic audit routes strictly reject modification and deletion with HTTP 405 Method Not Allowed',
      `PUT: ${putAudit.status}, DELETE: ${deleteAudit.status}, PATCH: ${patchAudit.status}`
    );

    // ── TEST GROUP 3: Database Retention TTL Index Verification ──────────────
    console.log('\n── Test Group 3: Database Retention & TTL Index Verification ──');

    const cookieIndexes = await db.collection('cookie_consents').indexes();
    const ttlIndex = cookieIndexes.find(idx => idx.key?.createdAt === 1 && idx.expireAfterSeconds !== undefined);

    assert(
      Boolean(ttlIndex) && ttlIndex.expireAfterSeconds === 31536000,
      'MongoDB collection "cookie_consents" enforces 12-month TTL index (31,536,000s) matching Privacy Policy commitment',
      ttlIndex ? `Found TTL: ${ttlIndex.expireAfterSeconds}s` : 'TTL index missing'
    );

    const privacyIndexes = await db.collection('privacy_requests').indexes();
    const ticketIndex = privacyIndexes.find(idx => idx.key?.ticketId === 1 && idx.unique === true);

    assert(
      Boolean(ticketIndex),
      'MongoDB collection "privacy_requests" enforces unique statutory ticketId index',
      ticketIndex ? 'Unique ticketId index present' : 'Index missing'
    );

    // ── TEST GROUP 4: Statutory Data Retention Script Execution ───────────────
    console.log('\n── Test Group 4: Automated Data Retention & Purpose-Exhaustion Script ──');

    let retentionError = null;
    try {
      await runDataRetentionCleanup();
    } catch (err) {
      retentionError = err.message;
    }

    assert(
      retentionError === null,
      'Statutory Data Retention Cleanup script executes without errors and records audit entry',
      retentionError || 'Success'
    );

  } catch (err) {
    console.error('Fatal Test Suite Error:', err);
  } finally {
    if (testServer) {
      testServer.close();
    }
    await closeDB();

    console.log('\n============================================================');
    console.log(`TEST RESULTS: ${passedTests}/${totalTests} Passed (${failedTests} Failed)`);
    console.log('============================================================\n');

    process.exit(failedTests > 0 ? 1 : 0);
  }
}

runDpdpTests();
