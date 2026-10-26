import dns from 'node:dns';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

// Ensure reliable SRV resolution across environments (e.g. Windows Node.js DNS edge cases)
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore in environments where setServers is restricted
}

let client = null;
let db = null;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gyanvaniai_admin';
const DB_NAME = process.env.MONGODB_DB_NAME || 'gyanvaniai_admin';

export async function connectDB(customUri = null, customDbName = null) {
  if (db && client) {
    return { client, db };
  }

  const uri = customUri || MONGODB_URI;
  const dbName = customDbName || DB_NAME;

  try {
    client = new MongoClient(uri, {
      maxPoolSize: 20,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });

    await client.connect();
    db = client.db(dbName);

    // Initialize required collections and indexes idempotently
    await initIndexes(db);

    return { client, db };
  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    throw err;
  }
}

export function getDb() {
  if (!db) {
    throw new Error('Database not connected. Call connectDB() first.');
  }
  return db;
}

export function getClient() {
  return client;
}

export async function closeDB() {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}

async function initIndexes(database) {
  try {
    // 1. admin_users
    const usersCol = database.collection('admin_users');
    await usersCol.createIndex({ emailNormalized: 1 }, { unique: true });
    await usersCol.createIndex({ roleIds: 1 });
    await usersCol.createIndex({ status: 1 });

    // 2. admin_roles
    const rolesCol = database.collection('admin_roles');
    await rolesCol.createIndex({ key: 1 }, { unique: true });
    await rolesCol.createIndex({ isSystemRole: 1 });

    // 3. admin_permissions
    const permsCol = database.collection('admin_permissions');
    await permsCol.createIndex({ key: 1 }, { unique: true });
    await permsCol.createIndex({ resource: 1 });

    // 4. admin_menus
    const menusCol = database.collection('admin_menus');
    await menusCol.createIndex({ sortOrder: 1 });
    await menusCol.createIndex({ parentId: 1 });
    await menusCol.createIndex({ enabled: 1 });

    // 5. admin_sessions (TTL index automatically cleans up expired sessions)
    const sessionsCol = database.collection('admin_sessions');
    await sessionsCol.createIndex({ sessionTokenHash: 1 }, { unique: true });
    await sessionsCol.createIndex({ userId: 1 });
    await sessionsCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    // 6. admin_password_resets (TTL index automatically cleans up expired reset tokens)
    const resetsCol = database.collection('admin_password_resets');
    await resetsCol.createIndex({ tokenHash: 1 }, { unique: true });
    await resetsCol.createIndex({ userId: 1 });
    await resetsCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    // 7. admin_audit_logs
    const auditCol = database.collection('admin_audit_logs');
    await auditCol.createIndex({ createdAt: -1 });
    await auditCol.createIndex({ actorUserId: 1 });
    await auditCol.createIndex({ action: 1 });
    await auditCol.createIndex({ targetType: 1 });

    // 8. admin_rate_limits (TTL index automatically cleans up expired buckets)
    const rateLimitsCol = database.collection('admin_rate_limits');
    await rateLimitsCol.createIndex({ key: 1 }, { unique: true });
    await rateLimitsCol.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    // 9. cms_posts
    const postsCol = database.collection('cms_posts');
    await postsCol.createIndex({ slug: 1 }, { unique: true });
    await postsCol.createIndex({ channel: 1, status: 1, publishedAt: -1 });
    await postsCol.createIndex({ status: 1, publishedAt: -1 });
    await postsCol.createIndex({ category: 1, status: 1 });
    await postsCol.createIndex({ tags: 1, status: 1 });
    await postsCol.createIndex({ isFeatured: 1, status: 1 });

    // 10. cms_revisions
    const revisionsCol = database.collection('cms_revisions');
    await revisionsCol.createIndex({ postId: 1, version: -1 });

    // 11. cms_categories
    const categoriesCol = database.collection('cms_categories');
    await categoriesCol.createIndex({ slug: 1 }, { unique: true });
    await categoriesCol.createIndex({ name: 1 }, { unique: true });

    // 12. cms_media
    const mediaCol = database.collection('cms_media');
    await mediaCol.createIndex({ createdAt: -1 });

    // 13. newsletter_subscribers
    const subscribersCol = database.collection('newsletter_subscribers');
    await subscribersCol.createIndex({ emailNormalized: 1 }, { unique: true });
    await subscribersCol.createIndex({ unsubscribeTokenHash: 1 }, { unique: true, sparse: true });
    await subscribersCol.createIndex({ status: 1, 'consent.recordedAt': -1 });
    await subscribersCol.createIndex({ confirmationTokenHash: 1 }, { sparse: true });

    // 14. contact_leads (enterprise-grade leads & inquiries)
    const leadsCol = database.collection('contact_leads');
    await leadsCol.createIndex({ emailNormalized: 1 });
    await leadsCol.createIndex({ status: 1, createdAt: -1 });
    await leadsCol.createIndex({ priority: 1, createdAt: -1 });
    await leadsCol.createIndex({ channel: 1, createdAt: -1 });
    await leadsCol.createIndex({ dedupeHash: 1 }, { sparse: true });
    await leadsCol.createIndex({ createdAt: -1 });

    // 15. cms_landing_page
    const landingPageCol = database.collection('cms_landing_page');
    await landingPageCol.createIndex({ key: 1 }, { unique: true });

    // 16. cms_landing_page_revisions
    const lpRevisionsCol = database.collection('cms_landing_page_revisions');
    await lpRevisionsCol.createIndex({ version: -1 });
    await lpRevisionsCol.createIndex({ createdAt: -1 });

    // 17. cookie_consents (TTL index: automated 12-month erasure under DPDP Act §8(7) & Rule 8)
    const cookieCol = database.collection('cookie_consents');
    await cookieCol.createIndex({ createdAt: 1 }, { expireAfterSeconds: 31536000 });
    await cookieCol.createIndex({ status: 1, createdAt: -1 });
    await cookieCol.createIndex({ channel: 1, createdAt: -1 });

    // 18. privacy_requests (Data Subject Rights and statutory grievance tracking)
    const privacyCol = database.collection('privacy_requests');
    await privacyCol.createIndex({ ticketId: 1 }, { unique: true });
    await privacyCol.createIndex({ emailNormalized: 1, createdAt: -1 });
    await privacyCol.createIndex({ status: 1, slaResolutionDueAt: 1 });
  } catch (indexErr) {
    // Non-fatal if index already exists
    console.warn('Index initialization notice:', indexErr.message);
  }
}
