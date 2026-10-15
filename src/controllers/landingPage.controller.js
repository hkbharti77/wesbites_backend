import { getDb } from '../db/connection.js';
import { logAuditEvent } from '../services/audit.service.js';
import {
  getDefaultLandingPage,
  sanitizeLandingPageDoc,
  validateForPublish,
} from '../utils/landingPageDefaults.js';

// In-memory cache for high-throughput public read performance
let cachedPublicPayload = null;
let cachedPublicETag = null;

export function invalidateLandingPageCache() {
  cachedPublicPayload = null;
  cachedPublicETag = null;
}

// Helper: Ensure the default landing page document exists in DB
async function getOrCreateLandingPageDoc(db) {
  const collection = db.collection('cms_landing_page');
  let doc = await collection.findOne({ key: 'landing_page_default' });

  if (!doc) {
    const baseline = getDefaultLandingPage();
    await collection.insertOne(baseline);
    doc = await collection.findOne({ key: 'landing_page_default' });

    // Also seed initial revision record
    const revisionsCol = db.collection('cms_landing_page_revisions');
    await revisionsCol.insertOne({
      version: 1,
      snapshot: {
        seo: baseline.seo,
        sectionsOrder: baseline.sectionsOrder,
        sections: baseline.sections,
      },
      changeSummary: 'Initial production system baseline',
      author: {
        name: 'System Admin',
        email: 'system@gyanvaniai.com',
      },
      createdAt: new Date(),
    });
  }

  return doc;
}

/* ─────────────────────────────────────────────────────────────────────────────
   PUBLIC READ-ONLY ENDPOINT (Zero authentication required)
   GET /api/public/landing-page
───────────────────────────────────────────────────────────────────────────── */
export async function getPublicLandingPage(req, res) {
  try {
    const ifNoneMatch = req.headers['if-none-match'];

    // Check in-memory cache
    if (cachedPublicPayload && cachedPublicETag) {
      if (ifNoneMatch && ifNoneMatch === cachedPublicETag) {
        return res.status(304).end();
      }
      res.setHeader('ETag', cachedPublicETag);
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
      return res.status(200).json(cachedPublicPayload);
    }

    const db = getDb();
    const doc = await getOrCreateLandingPageDoc(db);

    // Return the approved published snapshot, or current sections if no separate draft
    const publishedContent = doc.publishedSnapshot || {
      seo: doc.seo,
      sectionsOrder: doc.sectionsOrder,
      sections: doc.sections,
    };

    // Public payload: zero internal credentials or unpublished drafts
    const publicPayload = {
      version: doc.version || 1,
      publishedAt: doc.publishedAt || doc.updatedAt,
      seo: publishedContent.seo || doc.seo,
      sectionsOrder: publishedContent.sectionsOrder || doc.sectionsOrder,
      sections: publishedContent.sections || doc.sections,
    };

    // Compute deterministic ETag
    const timestamp = doc.publishedAt ? new Date(doc.publishedAt).getTime() : Date.now();
    const etag = `W/"lp-v${doc.version || 1}-${timestamp}"`;

    cachedPublicPayload = publicPayload;
    cachedPublicETag = etag;

    if (ifNoneMatch && ifNoneMatch === etag) {
      return res.status(304).end();
    }

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    return res.status(200).json(publicPayload);
  } catch (err) {
    console.error('Get Public Landing Page Error:', err);
    // Graceful fallback to static baseline on database failure
    const fallback = getDefaultLandingPage();
    return res.status(200).json({
      version: fallback.version,
      publishedAt: fallback.publishedAt,
      seo: fallback.seo,
      sectionsOrder: fallback.sectionsOrder,
      sections: fallback.sections,
    });
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   ADMIN: GET DRAFT
   GET /api/admin/landing-page/draft
   Requires: landing_page.read
───────────────────────────────────────────────────────────────────────────── */
export async function getDraftLandingPage(req, res) {
  try {
    const db = getDb();
    const doc = await getOrCreateLandingPageDoc(db);

    return res.status(200).json({
      id: doc._id.toString(),
      version: doc.version || 1,
      draftVersion: doc.draftVersion || doc.version || 1,
      status: doc.status || 'published',
      publishedAt: doc.publishedAt || null,
      publishedBy: doc.publishedBy || null,
      updatedAt: doc.updatedAt || null,
      updatedBy: doc.updatedBy || null,
      seo: doc.seo,
      sectionsOrder: doc.sectionsOrder,
      sections: doc.sections,
      hasUnpublishedChanges: doc.hasUnpublishedChanges || false,
    });
  } catch (err) {
    console.error('Get Draft Landing Page Error:', err);
    return res.status(500).json({ error: 'Failed to load landing page draft.', code: 'SERVER_ERROR' });
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   ADMIN: UPDATE DRAFT
   PUT /api/admin/landing-page/draft
   Requires: landing_page.update
───────────────────────────────────────────────────────────────────────────── */
export async function updateDraftLandingPage(req, res) {
  try {
    const db = getDb();
    const collection = db.collection('cms_landing_page');
    const existing = await getOrCreateLandingPageDoc(db);

    const { seo, sections, sectionsOrder, expectedDraftVersion } = req.body || {};

    // Optimistic concurrency control check
    if (typeof expectedDraftVersion === 'number' && existing.draftVersion && existing.draftVersion !== expectedDraftVersion) {
      return res.status(409).json({
        error: 'Concurrency Conflict: Another administrator has updated the draft since you opened it. Please reload to review their changes.',
        code: 'CONCURRENCY_CONFLICT',
        currentDraftVersion: existing.draftVersion,
      });
    }

    // Sanitize nested inputs to strip unsafe script tags
    const cleanSeo = sanitizeLandingPageDoc(seo || existing.seo);
    const cleanSections = sanitizeLandingPageDoc(sections || existing.sections);
    const cleanOrder = Array.isArray(sectionsOrder) ? sectionsOrder : existing.sectionsOrder;

    const newDraftVersion = (existing.draftVersion || existing.version || 1) + 1;
    const now = new Date();

    const updateFields = {
      seo: cleanSeo,
      sections: cleanSections,
      sectionsOrder: cleanOrder,
      draftVersion: newDraftVersion,
      hasUnpublishedChanges: true,
      updatedAt: now,
      updatedBy: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
      },
    };

    await collection.updateOne({ key: 'landing_page_default' }, { $set: updateFields });

    await logAuditEvent({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'LANDING_PAGE_DRAFT_UPDATED',
      targetType: 'landing_page',
      targetId: existing._id.toString(),
      targetName: 'Enterprise Landing Page Draft',
      outcome: 'SUCCESS',
      metadata: { draftVersion: newDraftVersion },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: 'Draft saved successfully.',
      draftVersion: newDraftVersion,
      updatedAt: now,
    });
  } catch (err) {
    console.error('Update Draft Error:', err);
    return res.status(500).json({ error: 'Failed to save landing page draft.', code: 'SERVER_ERROR' });
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   ADMIN: PUBLISH LIVE
   POST /api/admin/landing-page/publish
   Requires: landing_page.publish
───────────────────────────────────────────────────────────────────────────── */
export async function publishLandingPage(req, res) {
  try {
    const db = getDb();
    const collection = db.collection('cms_landing_page');
    const revisionsCol = db.collection('cms_landing_page_revisions');
    const existing = await getOrCreateLandingPageDoc(db);

    const { changeSummary, expectedVersion } = req.body || {};

    // Optimistic concurrency protection on publish
    if (typeof expectedVersion === 'number' && existing.version !== expectedVersion) {
      return res.status(409).json({
        error: 'Concurrency Conflict: Another administrator published a new version while you were editing. Please refresh before publishing.',
        code: 'CONCURRENCY_CONFLICT',
        currentVersion: existing.version,
      });
    }

    // Full pre-publish validation
    const validationErrors = validateForPublish({
      seo: existing.seo,
      sections: existing.sections,
      sectionsOrder: existing.sectionsOrder,
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed before publication.',
        code: 'VALIDATION_FAILED',
        details: validationErrors,
      });
    }

    const nextVersion = (existing.version || 1) + 1;
    const now = new Date();

    const snapshot = {
      seo: existing.seo,
      sectionsOrder: existing.sectionsOrder,
      sections: existing.sections,
    };

    // Atomic update of published state
    await collection.updateOne(
      { key: 'landing_page_default' },
      {
        $set: {
          version: nextVersion,
          status: 'published',
          publishedSnapshot: snapshot,
          hasUnpublishedChanges: false,
          publishedAt: now,
          publishedBy: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
          },
          updatedAt: now,
          updatedBy: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
          },
        },
      }
    );

    // Save revision history record
    await revisionsCol.insertOne({
      version: nextVersion,
      snapshot,
      changeSummary: changeSummary?.trim() || `Published version ${nextVersion}`,
      author: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
      },
      createdAt: now,
    });

    // Invalidate public cached response
    invalidateLandingPageCache();

    await logAuditEvent({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'LANDING_PAGE_PUBLISHED',
      targetType: 'landing_page',
      targetId: existing._id.toString(),
      targetName: 'Enterprise Landing Page',
      outcome: 'SUCCESS',
      metadata: {
        version: nextVersion,
        changeSummary: changeSummary || 'Published live',
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: `Version ${nextVersion} published live successfully!`,
      version: nextVersion,
      publishedAt: now,
    });
  } catch (err) {
    console.error('Publish Landing Page Error:', err);
    return res.status(500).json({ error: 'Failed to publish landing page.', code: 'SERVER_ERROR' });
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   ADMIN: REVISION HISTORY
   GET /api/admin/landing-page/revisions
   Requires: landing_page.read
───────────────────────────────────────────────────────────────────────────── */
export async function getLandingPageRevisions(req, res) {
  try {
    const db = getDb();
    const revisionsCol = db.collection('cms_landing_page_revisions');

    const revisions = await revisionsCol
      .find({})
      .sort({ version: -1 })
      .limit(50)
      .toArray();

    return res.status(200).json({
      revisions: revisions.map((r) => ({
        id: r._id.toString(),
        version: r.version,
        changeSummary: r.changeSummary || `Version ${r.version}`,
        author: r.author,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error('Get Landing Page Revisions Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve revision history.', code: 'SERVER_ERROR' });
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   ADMIN: ROLLBACK TO REVISION
   POST /api/admin/landing-page/revisions/:version/rollback
   Requires: landing_page.publish
───────────────────────────────────────────────────────────────────────────── */
export async function rollbackLandingPageRevision(req, res) {
  try {
    const targetVersion = parseInt(req.params.version, 10);
    if (isNaN(targetVersion)) {
      return res.status(400).json({ error: 'Invalid version number.', code: 'INVALID_VERSION' });
    }

    const db = getDb();
    const collection = db.collection('cms_landing_page');
    const revisionsCol = db.collection('cms_landing_page_revisions');

    const [existing, targetRevision] = await Promise.all([
      getOrCreateLandingPageDoc(db),
      revisionsCol.findOne({ version: targetVersion }),
    ]);

    if (!targetRevision || !targetRevision.snapshot) {
      return res.status(404).json({ error: `Revision v${targetVersion} not found.`, code: 'REVISION_NOT_FOUND' });
    }

    const nextVersion = (existing.version || 1) + 1;
    const now = new Date();
    const snap = targetRevision.snapshot;

    // Restore snapshot as current draft and published content
    await collection.updateOne(
      { key: 'landing_page_default' },
      {
        $set: {
          version: nextVersion,
          draftVersion: nextVersion,
          status: 'published',
          seo: snap.seo,
          sectionsOrder: snap.sectionsOrder,
          sections: snap.sections,
          publishedSnapshot: snap,
          hasUnpublishedChanges: false,
          publishedAt: now,
          publishedBy: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
          },
          updatedAt: now,
          updatedBy: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
          },
        },
      }
    );

    // Record the rollback event as a new revision
    await revisionsCol.insertOne({
      version: nextVersion,
      snapshot: snap,
      changeSummary: `Rollback to revision v${targetVersion}`,
      author: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
      },
      createdAt: now,
    });

    invalidateLandingPageCache();

    await logAuditEvent({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'LANDING_PAGE_ROLLED_BACK',
      targetType: 'landing_page',
      targetId: existing._id.toString(),
      targetName: 'Enterprise Landing Page',
      outcome: 'SUCCESS',
      metadata: {
        restoredFromVersion: targetVersion,
        newVersion: nextVersion,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return res.status(200).json({
      success: true,
      message: `Successfully restored landing page to version ${targetVersion} (now v${nextVersion}).`,
      version: nextVersion,
      publishedAt: now,
    });
  } catch (err) {
    console.error('Rollback Landing Page Error:', err);
    return res.status(500).json({ error: 'Failed to rollback landing page.', code: 'SERVER_ERROR' });
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   ADMIN: DRAFT PREVIEW DATA
   GET /api/admin/landing-page/preview
   Requires: landing_page.read
───────────────────────────────────────────────────────────────────────────── */
export async function getLandingPagePreview(req, res) {
  try {
    const db = getDb();
    const doc = await getOrCreateLandingPageDoc(db);

    return res.status(200).json({
      version: doc.draftVersion || doc.version || 1,
      isPreview: true,
      seo: doc.seo,
      sectionsOrder: doc.sectionsOrder,
      sections: doc.sections,
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    console.error('Get Preview Error:', err);
    return res.status(500).json({ error: 'Failed to generate preview data.', code: 'SERVER_ERROR' });
  }
}
