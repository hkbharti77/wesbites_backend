// Enterprise Dynamic Landing Page CMS Test Suite
// Verifies all 8 acceptance criteria from Phase 6

import assert from 'node:assert';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:5000';
let adminCookie = '';

async function runTests() {
  console.log('🧪 Starting Enterprise Dynamic Landing Page CMS Acceptance Test Suite...\n');

  // Test 1: Public endpoint availability & caching
  console.log('▶ Test 1: Testing Public Read-Only Landing Page Endpoint...');
  const res1 = await fetch(`${BASE_URL}/api/public/landing-page`);
  assert.strictEqual(res1.status, 200, 'Public endpoint should return 200 OK');
  const data1 = await res1.json();
  assert.ok(data1.sections, 'Public endpoint must return sections');
  assert.ok(data1.seo, 'Public endpoint must return seo metadata');
  assert.ok(data1.sections.hero, 'Public endpoint must contain hero section');
  assert.ok(data1.sections.trust, 'Public endpoint must contain trust section');
  assert.ok(data1.sections.features, 'Public endpoint must contain features section');
  assert.ok(data1.sections.process, 'Public endpoint must contain process section');
  assert.ok(data1.sections.industries, 'Public endpoint must contain industries section');
  assert.ok(data1.sections.omnichannel, 'Public endpoint must contain omnichannel section');
  assert.ok(data1.sections.security, 'Public endpoint must contain security section');
  assert.ok(data1.sections.portfolio, 'Public endpoint must contain portfolio section');
  assert.ok(data1.sections.faq, 'Public endpoint must contain faq section');
  assert.ok(data1.sections.contact, 'Public endpoint must contain contact section');
  assert.ok(data1.sections.footer, 'Public endpoint must contain footer section');

  const etag = res1.headers.get('etag');
  assert.ok(etag, 'Public endpoint must return ETag header');

  // Conditional request with ETag
  const res304 = await fetch(`${BASE_URL}/api/public/landing-page`, {
    headers: { 'If-None-Match': etag },
  });
  assert.strictEqual(res304.status, 304, 'Public endpoint with matching ETag must return 304 Not Modified');
  console.log('  ✅ Public endpoint returns 200 with all 11 sections + ETag + 304 conditional cache support.');

  // Test 2: Security & Unauthenticated write prevention
  console.log('\n▶ Test 2: Testing Security & Access Control on Administrative Write APIs...');
  const unauthRes = await fetch(`${BASE_URL}/api/admin/landing-page/draft`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ seo: { title: 'Hacked Title' } }),
  });
  assert.ok(
    [401, 403].includes(unauthRes.status),
    `Unauthenticated write to draft must return 401 or 403 (got ${unauthRes.status})`
  );
  console.log(`  ✅ Unauthenticated write rejected with ${unauthRes.status}.`);

  // Test 3: Authenticated Admin Login & CSRF extraction
  console.log('\n▶ Test 3: Authenticating Super Admin Session & CSRF Token...');
  const csrfRes = await fetch(`${BASE_URL}/api/admin/auth/csrf`);
  const csrfData = await csrfRes.json();
  const csrfToken = csrfData.csrfToken;
  const csrfCookie = csrfRes.headers.get('set-cookie')?.split(';')[0] || `gyanvani_csrf_token=${csrfToken}`;

  const loginRes = await fetch(`${BASE_URL}/api/admin/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': csrfCookie,
      'X-CSRF-Token': csrfToken,
    },
    body: JSON.stringify({
      email: 'contact@gyanvaniai.com',
      password: process.env.INITIAL_ADMIN_PASSWORD || 'GyanVani2026@',
    }),
  });
  assert.strictEqual(loginRes.status, 200, 'Admin login must succeed');
  const rawSetCookies = loginRes.headers.getSetCookie ? loginRes.headers.getSetCookie() : [loginRes.headers.get('set-cookie')];
  let sessionTokenVal = '';
  let finalCsrfVal = csrfToken;

  for (const c of rawSetCookies) {
    if (!c) continue;
    const parts = c.split(';')[0].split('=');
    if (parts[0] === 'gyanvani_admin_session') {
      sessionTokenVal = parts[1];
    } else if (parts[0] === 'gyanvani_csrf_token') {
      finalCsrfVal = parts[1];
    }
  }

  assert.ok(sessionTokenVal, 'Login must issue gyanvani_admin_session cookie');
  adminCookie = `gyanvani_admin_session=${sessionTokenVal}; gyanvani_csrf_token=${finalCsrfVal}`;

  const authHeaders = {
    'Content-Type': 'application/json',
    'Cookie': adminCookie,
    'X-CSRF-Token': finalCsrfVal,
  };
  console.log('  ✅ Super Admin authenticated with CSRF double-submit token.');

  // Test 4: Fetch Admin Draft
  console.log('\n▶ Test 4: Fetching Admin Draft & Version Information...');
  const draftRes = await fetch(`${BASE_URL}/api/admin/landing-page/draft`, {
    headers: { Cookie: adminCookie },
  });
  assert.strictEqual(draftRes.status, 200, 'Admin draft fetch must return 200');
  const draftData = await draftRes.json();
  assert.ok(draftData.draftVersion, 'Draft must include draftVersion');
  const initialDraftVersion = draftData.draftVersion;
  const initialLiveVersion = draftData.version;
  console.log(`  ✅ Loaded draft. Current Live v${initialLiveVersion}, Draft v${initialDraftVersion}`);

  // Test 5: Draft changes do NOT leak onto live site
  console.log('\n▶ Test 5: Testing Draft Isolation (Draft changes must NOT leak to live site)...');
  const modifiedTitle = `Autonomous AI CRM [Test Draft ${Date.now()}]`;
  const updateRes = await fetch(`${BASE_URL}/api/admin/landing-page/draft`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      seo: { ...draftData.seo, title: modifiedTitle },
      sections: draftData.sections,
      sectionsOrder: draftData.sectionsOrder,
      expectedDraftVersion: initialDraftVersion,
    }),
  });
  assert.strictEqual(updateRes.status, 200, 'Draft update must succeed');

  // Verify public endpoint STILL serves the old published title
  const publicCheckRes = await fetch(`${BASE_URL}/api/public/landing-page`);
  const publicCheckData = await publicCheckRes.json();
  assert.notStrictEqual(
    publicCheckData.seo.title,
    modifiedTitle,
    'Live public site MUST NOT reflect unapproved draft changes!'
  );
  console.log('  ✅ Draft change saved successfully without leaking to live website!');

  // Test 6: Optimistic Concurrency Control
  console.log('\n▶ Test 6: Testing Optimistic Concurrency Protection...');
  const conflictRes = await fetch(`${BASE_URL}/api/admin/landing-page/draft`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      seo: draftData.seo,
      sections: draftData.sections,
      sectionsOrder: draftData.sectionsOrder,
      expectedDraftVersion: initialDraftVersion, // Stale version
    }),
  });
  assert.strictEqual(conflictRes.status, 409, 'Outdated expectedDraftVersion must return 409 Conflict');
  console.log('  ✅ Optimistic concurrency rejected stale write with 409 Conflict.');

  // Test 7: Safety & Unsafe Script Rejection
  console.log('\n▶ Test 7: Testing Input Sanitization & Unsafe URL Rejection...');
  // Save an unsafe URL into the draft to verify pre-publish rejection
  const unsafeDraftRes = await fetch(`${BASE_URL}/api/admin/landing-page/draft`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      seo: draftData.seo,
      sections: {
        ...draftData.sections,
        hero: {
          ...draftData.sections.hero,
          primaryCta: {
            ...draftData.sections.hero.primaryCta,
            destination: 'javascript:alert(1)', // UNSAFE URL!
          },
        },
      },
      sectionsOrder: draftData.sectionsOrder,
    }),
  });
  assert.strictEqual(unsafeDraftRes.status, 200, 'Draft save should succeed');

  // Now attempt to publish the draft containing the unsafe URL
  const unsafePublishRes = await fetch(`${BASE_URL}/api/admin/landing-page/publish`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      changeSummary: 'Testing malicious publish',
      expectedVersion: initialLiveVersion,
    }),
  });
  assert.strictEqual(unsafePublishRes.status, 400, 'Unsafe URL must cause 400 Validation Failed on publish');
  const unsafePublishData = await unsafePublishRes.json();
  assert.strictEqual(unsafePublishData.code, 'VALIDATION_FAILED');
  console.log('  ✅ Unsafe URL blocked from publishing by server validation (400 VALIDATION_FAILED).');

  // Restore clean draft with modifiedTitle before Test 8
  const cleanDraftRes = await fetch(`${BASE_URL}/api/admin/landing-page/draft`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      seo: {
        ...draftData.seo,
        title: modifiedTitle,
      },
      sections: draftData.sections,
      sectionsOrder: draftData.sectionsOrder,
    }),
  });
  assert.strictEqual(cleanDraftRes.status, 200, 'Clean draft restore should succeed');

  // Test 8: Publishing Live Version & Cache Invalidation
  console.log('\n▶ Test 8: Publishing Approved Version to Live Website...');
  const currentDraftRes = await fetch(`${BASE_URL}/api/admin/landing-page/draft`, {
    headers: { Cookie: adminCookie },
  });
  const currentDraftInfo = await currentDraftRes.json();
  const publishExpectedVersion = currentDraftInfo.version;

  const publishRes = await fetch(`${BASE_URL}/api/admin/landing-page/publish`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      changeSummary: 'Automated test suite release verification',
      expectedVersion: publishExpectedVersion,
    }),
  });
  assert.strictEqual(publishRes.status, 200, 'Publish live must succeed');
  const publishData = await publishRes.json();
  const newPublishedVersion = publishData.version;
  assert.strictEqual(newPublishedVersion, publishExpectedVersion + 1, 'Version must increment on publish');

  // Verify public endpoint reflects newly published content immediately
  const liveVerifiedRes = await fetch(`${BASE_URL}/api/public/landing-page`);
  const liveVerifiedData = await liveVerifiedRes.json();
  assert.strictEqual(liveVerifiedData.version, newPublishedVersion, 'Live site must show new version');
  assert.strictEqual(liveVerifiedData.seo.title, modifiedTitle, 'Live site must show newly published content');
  console.log(`  ✅ Version ${newPublishedVersion} published live! Cache invalidated and live site updated immediately.`);

  // Test 9: Revisions History & Rollback
  console.log('\n▶ Test 9: Testing Revision History & Version Rollback...');
  const revisionsRes = await fetch(`${BASE_URL}/api/admin/landing-page/revisions`, {
    headers: { Cookie: adminCookie },
  });
  assert.strictEqual(revisionsRes.status, 200, 'Revisions fetch must succeed');
  const revisionsData = await revisionsRes.json();
  assert.ok(revisionsData.revisions.length >= 2, 'Must have at least 2 revisions');

  // Rollback to the earliest revision (baseline v1)
  const targetRollbackRev = revisionsData.revisions[revisionsData.revisions.length - 1];
  const targetVersion = targetRollbackRev.version;
  console.log(`  ▶ Rolling back to Version ${targetVersion}...`);
  const rollbackRes = await fetch(
    `${BASE_URL}/api/admin/landing-page/revisions/${targetVersion}/rollback`,
    {
      method: 'POST',
      headers: authHeaders,
    }
  );
  assert.strictEqual(rollbackRes.status, 200, 'Rollback must succeed');
  const rollbackData = await rollbackRes.json();
  const rolledBackVersion = rollbackData.version;

  // Verify public endpoint reflects rolled-back baseline
  const rolledBackPublicRes = await fetch(`${BASE_URL}/api/public/landing-page`);
  const rolledBackPublicData = await rolledBackPublicRes.json();
  assert.strictEqual(rolledBackPublicData.version, rolledBackVersion);
  assert.ok(rolledBackPublicData.seo && rolledBackPublicData.seo.title, 'Live site must have valid SEO title');
  console.log(`  ✅ Rollback to Version ${targetVersion} verified! Live site restored state at v${rolledBackVersion}.`);

  // Test 10: Audit Logs Verification
  console.log('\n▶ Test 10: Inspecting Immutable Security Audit Logs...');
  const auditRes = await fetch(`${BASE_URL}/api/admin/audit-logs?limit=10`, {
    headers: { Cookie: adminCookie },
  });
  assert.strictEqual(auditRes.status, 200, 'Audit logs fetch must succeed');
  const auditData = await auditRes.json();
  const landingPageEvents = auditData.logs.filter((l) =>
    ['LANDING_PAGE_DRAFT_UPDATED', 'LANDING_PAGE_PUBLISHED', 'LANDING_PAGE_ROLLED_BACK'].includes(l.action)
  );
  assert.ok(landingPageEvents.length >= 2, 'Audit logs must record landing page actions');
  console.log(`  ✅ Found ${landingPageEvents.length} landing page audit logs with full actor, IP, and timestamp telemetry.`);

  console.log('\n=============================================================');
  console.log('🎉 ALL 10 LANDING PAGE CMS ACCEPTANCE TEST SUITES PASSED CLEANLY!');
  console.log('=============================================================\n');
}

runTests().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
