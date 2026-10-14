/**
 * cms-lifecycle.test.js
 * Comprehensive automated verification for Phase 4:
 * 1. Draft creation & revision tracking (v1)
 * 2. RBAC publication guard (unauthorized user cannot publish)
 * 3. Public visibility boundary (draft is hidden from public API)
 * 4. HMAC preview token access
 * 5. Publishing lifecycle (v2) and immediate public visibility
 * 6. Content editing and version increment (v3)
 * 7. Revision rollback capability (restoring v2 state -> v4)
 * 8. Unpublish workflow (v5) and public 404 verification
 * 9. Image upload validation (MIME & size)
 * 10. Category management & duplicate slug protection
 */

import assert from 'assert';
import { connectDB, closeDB, getDb } from '../src/db/connection.js';
import { ObjectId } from 'mongodb';
import { hashPassword } from '../src/utils/crypto.js';
import { generatePreviewToken, verifyPreviewToken } from '../src/utils/slugify.js';

// Import controllers directly for unit/integration testing
import * as cmsPostCtrl from '../src/controllers/cmsPost.controller.js';
import * as publicPostCtrl from '../src/controllers/publicPost.controller.js';
import * as categoryCtrl from '../src/controllers/category.controller.js';
import * as mediaCtrl from '../src/controllers/media.controller.js';

console.log('\n======================================================================');
console.log('🧪 GYANVANIAI CMS INTEGRATION & CONTENT LIFECYCLE TEST SUITE');
console.log('======================================================================\n');

let passed = 0;
let failed = 0;

function runTest(name, fn) {
  return Promise.resolve()
    .then(() => fn())
    .then(() => {
      passed++;
      console.log(`  ✅ [PASS] ${name}`);
    })
    .catch((err) => {
      failed++;
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}`);
    });
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.data = body;
      return this;
    },
  };
  return res;
}

async function runAllCmsTests() {
  await connectDB();
  const db = getDb();

  const postsCol = db.collection('cms_posts');
  const revisionsCol = db.collection('cms_revisions');
  const categoriesCol = db.collection('cms_categories');
  const mediaCol = db.collection('cms_media');

  // Test identities
  const superAdminUser = {
    id: new ObjectId().toString(),
    name: 'Super Admin Test',
    email: 'superadmin.test@gyanvaniai.com',
    isSuperAdmin: true,
    permissions: ['*'],
  };

  const restrictedWriter = {
    id: new ObjectId().toString(),
    name: 'Restricted Writer',
    email: 'writer.test@gyanvaniai.com',
    isSuperAdmin: false,
    permissions: ['posts.read', 'posts.create', 'posts.update'], // Lacks posts.publish and posts.delete
  };

  let testPostId = null;
  const testSlug = 'e2e-test-enterprise-ai-voice-' + Date.now();

  try {
    // ─── 1. Draft Creation & Initial Revision ─────────────────────────────
    console.log('▶ Stage 1: Post Draft Creation & Revision Snapshots');

    await runTest('Creates a post draft with status "draft" and initial v1 revision', async () => {
      const req = {
        user: restrictedWriter,
        body: {
          title: 'Enterprise AI Voice Infrastructure in Banking',
          slug: testSlug,
          excerpt: 'Analysis of sub-300ms latency telephony for enterprise banking conversational agents.',
          content: '<h2>Introduction</h2><p>Real-time conversational voice agents requires WebRTC and SIP bridges.</p>',
          category: 'Enterprise Automation',
          tags: ['Voice AI', 'Banking', 'SIP'],
          status: 'draft',
        },
      };
      const res = mockRes();
      await cmsPostCtrl.createPost(req, res);

      assert.strictEqual(res.statusCode, 201);
      assert.strictEqual(res.data.post.status, 'draft');
      assert.strictEqual(res.data.post.version, 1);
      assert.strictEqual(res.data.post.slug, testSlug);
      testPostId = res.data.post.id;

      // Verify DB revision was created
      const rev = await revisionsCol.findOne({ postId: new ObjectId(testPostId), version: 1 });
      assert.ok(rev, 'Revision v1 must exist in cms_revisions');
      assert.strictEqual(rev.snapshot.title, 'Enterprise AI Voice Infrastructure in Banking');
    });

    // ─── 2. RBAC Publication Guard ─────────────────────────────────────────
    console.log('\n▶ Stage 2: RBAC Authorization & Direct Publication Guard');

    await runTest('Restricted writer cannot directly create a published post', async () => {
      const req = {
        user: restrictedWriter,
        body: {
          title: 'Unauthorized Published Article',
          excerpt: 'This should not be allowed without posts.publish.',
          content: '<p>Content</p>',
          status: 'published',
        },
      };
      const res = mockRes();
      await cmsPostCtrl.createPost(req, res);

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.data.code, 'FORBIDDEN');
    });

    await runTest('Restricted writer cannot publish an existing draft', async () => {
      const req = {
        user: restrictedWriter,
        params: { id: testPostId },
        body: { status: 'published' },
      };
      const res = mockRes();
      await cmsPostCtrl.updatePost(req, res);

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.data.code, 'FORBIDDEN');
    });

    // ─── 3. Public API Isolation (Draft Security) ─────────────────────────
    console.log('\n▶ Stage 3: Public API Isolation (Unpublished Draft Security)');

    await runTest('Draft is completely hidden from public posts listing', async () => {
      const req = { query: {} };
      const res = mockRes();
      await publicPostCtrl.getPublicPosts(req, res);

      assert.strictEqual(res.statusCode, 200);
      const found = res.data.posts.find(p => p.slug === testSlug || p.id === testPostId);
      assert.strictEqual(found, undefined, 'Draft article must NOT appear in public listing');
    });

    await runTest('Public request to draft article by slug returns 404', async () => {
      const req = { params: { slugOrId: testSlug }, query: {} };
      const res = mockRes();
      await publicPostCtrl.getPublicPostBySlug(req, res);

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.data.code, 'ARTICLE_NOT_PUBLISHED');
    });

    // ─── 4. Secure HMAC Preview Token Access ───────────────────────────────
    console.log('\n▶ Stage 4: Signed HMAC Preview Token Access');

    let previewToken = null;
    await runTest('Generates signed HMAC preview token for authorized editor', async () => {
      const req = { user: restrictedWriter, params: { id: testPostId } };
      const res = mockRes();
      await cmsPostCtrl.getPreviewToken(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.data.previewToken, 'Preview token must be generated');
      previewToken = res.data.previewToken;
    });

    await runTest('Public endpoint with valid preview token allows reading draft content', async () => {
      const req = { params: { slugOrId: testSlug }, query: { preview: previewToken } };
      const res = mockRes();
      await publicPostCtrl.getPublicPostBySlug(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.post.title, 'Enterprise AI Voice Infrastructure in Banking');
      assert.strictEqual(res.data.post.status, 'draft');
    });

    await runTest('Public endpoint with forged or invalid preview token returns 404', async () => {
      const req = { params: { slugOrId: testSlug }, query: { preview: 'fake.signature123' } };
      const res = mockRes();
      await publicPostCtrl.getPublicPostBySlug(req, res);

      assert.strictEqual(res.statusCode, 404);
    });

    // ─── 5. Publishing Lifecycle & Live Public Verification ────────────────
    console.log('\n▶ Stage 5: Publishing Lifecycle & Live Public Verification');

    await runTest('Super Admin publishes post, increments version to 2', async () => {
      const req = { user: superAdminUser, params: { id: testPostId } };
      const res = mockRes();
      await cmsPostCtrl.publishPost(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.status, 'published');
      assert.strictEqual(res.data.version, 2);

      const postInDb = await postsCol.findOne({ _id: new ObjectId(testPostId) });
      assert.strictEqual(postInDb.status, 'published');
      assert.ok(postInDb.publishedAt instanceof Date);
    });

    await runTest('Published post now immediately appears in public feed', async () => {
      const req = { query: {} };
      const res = mockRes();
      await publicPostCtrl.getPublicPosts(req, res);

      assert.strictEqual(res.statusCode, 200);
      const found = res.data.posts.find(p => p.slug === testSlug);
      assert.ok(found, 'Newly published article must appear in public feed');
    });

    await runTest('Public request to published article by slug returns 200 without token', async () => {
      const req = { params: { slugOrId: testSlug }, query: {} };
      const res = mockRes();
      await publicPostCtrl.getPublicPostBySlug(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.post.title, 'Enterprise AI Voice Infrastructure in Banking');
    });

    // ─── 6. Content Editing & Version 3 ────────────────────────────────────
    console.log('\n▶ Stage 6: Content Update & Revision Tracking');

    await runTest('Updates content and SEO metadata, increments version to 3', async () => {
      const req = {
        user: restrictedWriter,
        params: { id: testPostId },
        body: {
          title: 'Enterprise AI Voice Infrastructure in Banking (Updated Edition)',
          content: '<h2>Updated Architecture</h2><p>Enhanced sub-200ms latency pipelines.</p>',
          changeSummary: 'Updated latency benchmark figures',
        },
      };
      const res = mockRes();
      await cmsPostCtrl.updatePost(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.post.version, 3);
      assert.strictEqual(res.data.post.title, 'Enterprise AI Voice Infrastructure in Banking (Updated Edition)');

      // Verify revisions count
      const revisions = await revisionsCol.find({ postId: new ObjectId(testPostId) }).toArray();
      assert.strictEqual(revisions.length, 3, 'Post must now have 3 revision snapshots');
    });

    // ─── 7. Revision Rollback Capability ──────────────────────────────────
    console.log('\n▶ Stage 7: Revision Rollback & State Restoration');

    await runTest('Rolls back to version 2 snapshot, creating version 4', async () => {
      const req = {
        user: restrictedWriter,
        params: { id: testPostId, version: 2 },
      };
      const res = mockRes();
      await cmsPostCtrl.rollbackRevision(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.post.version, 4);
      assert.strictEqual(res.data.post.title, 'Enterprise AI Voice Infrastructure in Banking');

      const currentDb = await postsCol.findOne({ _id: new ObjectId(testPostId) });
      assert.strictEqual(currentDb.title, 'Enterprise AI Voice Infrastructure in Banking');
    });

    // ─── 8. Unpublish & Public 404 Verification ───────────────────────────
    console.log('\n▶ Stage 8: Unpublish & Immediate Public Revocation');

    await runTest('Super Admin unpublishes post back to draft (version 5)', async () => {
      const req = { user: superAdminUser, params: { id: testPostId } };
      const res = mockRes();
      await cmsPostCtrl.unpublishPost(req, res);

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.status, 'draft');
      assert.strictEqual(res.data.version, 5);
    });

    await runTest('Unpublished post immediately disappears from public feed', async () => {
      const req = { query: {} };
      const res = mockRes();
      await publicPostCtrl.getPublicPosts(req, res);

      const found = res.data.posts.find(p => p.slug === testSlug);
      assert.strictEqual(found, undefined, 'Unpublished post must not appear in public feed');
    });

    await runTest('Public request to unpublished post returns 404', async () => {
      const req = { params: { slugOrId: testSlug }, query: {} };
      const res = mockRes();
      await publicPostCtrl.getPublicPostBySlug(req, res);

      assert.strictEqual(res.statusCode, 404);
      assert.strictEqual(res.data.code, 'ARTICLE_NOT_PUBLISHED');
    });

    // ─── 9. Media Library Safe Upload Validation ──────────────────────────
    console.log('\n▶ Stage 9: Media Upload Validation & Safe Storage');

    await runTest('Rejects non-image MIME types (e.g. text/html, application/x-sh)', async () => {
      const req = {
        user: superAdminUser,
        body: {
          fileData: 'data:text/html;base64,PGgxPkhhY2tlZDwvaDE+',
          originalName: 'exploit.html',
        },
      };
      const res = mockRes();
      await mediaCtrl.uploadMedia(req, res);

      assert.strictEqual(res.statusCode, 400);
      assert.strictEqual(res.data.code, 'UNSUPPORTED_MIME_TYPE');
    });

    let uploadedMediaId = null;
    await runTest('Accepts valid WebP image upload and generates safe URL', async () => {
      // 1x1 transparent PNG in base64
      const png1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const req = {
        user: superAdminUser,
        body: {
          fileData: png1x1,
          originalName: 'banner.png',
          altText: 'Enterprise Telephony Banner',
        },
      };
      const res = mockRes();
      await mediaCtrl.uploadMedia(req, res);

      assert.strictEqual(res.statusCode, 201);
      assert.ok(res.data.media.url.startsWith('/uploads/cms/banner_'));
      uploadedMediaId = res.data.media.id;
    });

    if (uploadedMediaId) {
      await runTest('Deletes uploaded media file and database record', async () => {
        const req = { user: superAdminUser, params: { id: uploadedMediaId } };
        const res = mockRes();
        await mediaCtrl.deleteMedia(req, res);

        assert.strictEqual(res.statusCode, 200);
        const check = await mediaCol.findOne({ _id: new ObjectId(uploadedMediaId) });
        assert.strictEqual(check, null);
      });
    }

    // ─── 10. Category Management & Duplicate Slug Protection ───────────────
    console.log('\n▶ Stage 10: Category Management & Slug Conflict Protection');

    let testCatId = null;
    const testCatSlug = 'ai-infrastructure-' + Date.now();

    await runTest('Creates a new content category', async () => {
      const req = {
        user: superAdminUser,
        body: {
          name: 'AI Infrastructure ' + Date.now(),
          slug: testCatSlug,
          description: 'Hardware, GPU clusters, and SIP gateways.',
          color: '#8b5cf6',
        },
      };
      const res = mockRes();
      await categoryCtrl.createCategory(req, res);

      assert.strictEqual(res.statusCode, 201);
      testCatId = res.data.category.id;
    });

    await runTest('Rejects duplicate category slug with HTTP 409', async () => {
      const req = {
        user: superAdminUser,
        body: {
          name: 'Duplicate Category',
          slug: testCatSlug,
        },
      };
      const res = mockRes();
      await categoryCtrl.createCategory(req, res);

      assert.strictEqual(res.statusCode, 409);
      assert.strictEqual(res.data.code, 'CATEGORY_ALREADY_EXISTS');
    });

    if (testCatId) {
      await runTest('Deletes unused category', async () => {
        const req = { user: superAdminUser, params: { id: testCatId } };
        const res = mockRes();
        await categoryCtrl.deleteCategory(req, res);

        assert.strictEqual(res.statusCode, 200);
      });
    }

  } finally {
    // Clean up test post and revisions
    if (testPostId) {
      await postsCol.deleteOne({ _id: new ObjectId(testPostId) });
      await revisionsCol.deleteMany({ postId: new ObjectId(testPostId) });
    }
    await closeDB();
  }

  console.log('\n======================================================================');
  console.log(`🎉 TEST SUMMARY: ${passed} PASSED, ${failed} FAILED (TOTAL: ${passed + failed})`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllCmsTests().catch((err) => {
  console.error('Fatal Test Execution Error:', err);
  process.exit(1);
});
