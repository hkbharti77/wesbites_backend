/**
 * Automated Data Retention & Purpose-Exhaustion Purge Script
 * Implements India DPDP Act, 2023 Section 8(7) and DPDP Rules, 2025 Rule 8
 */

import { connectDB, closeDB, getDb } from '../db/connection.js';
import { logAuditEvent } from '../services/audit.service.js';

export async function runDataRetentionCleanup() {
  console.log('── Running DPDP Act Statutory Data Retention Job ───────────');
  await connectDB();
  const db = getDb();

  const now = new Date();
  const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
  const twentyFourMonthsAgo = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // 1. Purge unconfirmed double opt-in newsletter subscribers older than 30 days
  const unconfirmedResult = await db.collection('newsletter_subscribers').deleteMany({
    status: 'pending_confirmation',
    createdAt: { $lt: thirtyDaysAgo },
  });
  console.log(`[Retention] Purged unconfirmed newsletter subscribers: ${unconfirmedResult.deletedCount}`);

  // 2. Purge cookie consent records older than 12 months (matching Privacy Policy commitment)
  const cookieResult = await db.collection('cookie_consents').deleteMany({
    createdAt: { $lt: twelveMonthsAgo },
  });
  console.log(`[Retention] Purged expired cookie consent records: ${cookieResult.deletedCount}`);

  // 3. Anonymize closed/converted leads older than 24 months (Purpose Exhausted)
  const leadsAnonymizeResult = await db.collection('contact_leads').updateMany(
    {
      status: { $in: ['converted', 'closed', 'spam'] },
      createdAt: { $lt: twentyFourMonthsAgo },
      anonymizedAt: { $exists: false },
    },
    {
      $set: {
        name: '[ANONYMIZED_PURSUANT_TO_DPDP_ACT_S8_7]',
        email: '[ANONYMIZED]@privacy.dpdp',
        emailNormalized: '[anonymized]@privacy.dpdp',
        phone: null,
        company: null,
        message: '[PURSUANT TO DPDP ACT 2023 SECTION 8(7) - MESSAGE EXPUNGED UPON PURPOSE EXHAUSTION]',
        notes: [],
        'metadata.ip': '[ANONYMIZED]',
        'metadata.userAgent': '[ANONYMIZED]',
        anonymizedAt: now,
      },
    }
  );
  console.log(`[Retention] Anonymized purpose-exhausted historical leads: ${leadsAnonymizeResult.modifiedCount}`);

  // 4. Log immutable audit entry for compliance defense
  await logAuditEvent({
    action: 'DATA_RETENTION_PURGE_EXECUTED',
    targetType: 'system_compliance',
    outcome: 'SUCCESS',
    metadata: {
      unconfirmedSubscribersPurged: unconfirmedResult.deletedCount,
      expiredCookiesPurged: cookieResult.deletedCount,
      leadsAnonymized: leadsAnonymizeResult.modifiedCount,
      statutoryAuthority: 'DPDP_ACT_2023_SECTION_8_7_RULE_8',
    },
  });

  console.log('✓ Data retention and statutory cleanup completed successfully.');
}

if (process.argv[1] && process.argv[1].endsWith('enforce-data-retention.js')) {
  runDataRetentionCleanup()
    .then(() => closeDB())
    .catch((err) => {
      console.error('Data retention cleanup failed:', err);
      process.exit(1);
    });
}
