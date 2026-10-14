/**
 * Cookie Consent Controller
 * Stores GDPR/DPDP/CCPA consent records, serves analytics, and handles erasure.
 * All timestamps stored as UTC. Visitor PII stored only if analytics consent given.
 */

import { getDb } from '../db/connection.js';

const COL = 'cookie_consents';

/* ── POST /api/public/cookie-consent ─────────────────────────────────────── */
export async function recordConsent(req, res) {
  try {
    const {
      status,           // 'all' | 'essential' | 'rejected' | 'custom'
      preferences = {}, // { necessary, functional, analytics, marketing }
      userAgent,
      language,
      referrer,
      pageUrl,
      city,
      region,
      country,
      countryCode,
      consentVersion = '1.0',
    } = req.body || {};

    const validStatuses = ['all', 'essential', 'rejected', 'custom'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid consent status.', code: 'INVALID_STATUS' });
    }

    const db = getDb();
    const col = db.collection(COL);

    const doc = {
      status,
      preferences: {
        necessary: true,
        functional: Boolean(preferences.functional),
        analytics: Boolean(preferences.analytics),
        marketing: Boolean(preferences.marketing),
      },
      // Visitor context — stored for legal audit trail
      userAgent: typeof userAgent === 'string' ? userAgent.slice(0, 512) : null,
      language: typeof language === 'string' ? language.slice(0, 20) : null,
      referrer: typeof referrer === 'string' ? referrer.slice(0, 512) : null,
      pageUrl: typeof pageUrl === 'string' ? pageUrl.slice(0, 1024) : null,
      // Geo data — only stored if analytics consent given
      city: preferences.analytics ? (typeof city === 'string' ? city : null) : null,
      region: preferences.analytics ? (typeof region === 'string' ? region : null) : null,
      country: preferences.analytics ? (typeof country === 'string' ? country : null) : null,
      countryCode: preferences.analytics ? (typeof countryCode === 'string' ? countryCode : null) : null,
      // Compliance metadata
      consentVersion,
      legalBasis: 'GDPR Art.7 / DPDP Act 2023 S.6 / CCPA 1798.120',
      createdAt: new Date(),
    };

    const result = await col.insertOne(doc);

    return res.status(201).json({
      message: 'Consent recorded.',
      id: result.insertedId.toString(),
    });
  } catch (err) {
    console.error('Record Consent Error:', err);
    return res.status(500).json({ error: 'Failed to record consent.', code: 'SERVER_ERROR' });
  }
}

/* ── GET /api/admin/cookies ──────────────────────────────────────────────── */
export async function getConsents(req, res) {
  try {
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip  = (page - 1) * limit;
    const { status, country, search } = req.query;

    const db  = getDb();
    const col = db.collection(COL);

    const filter = {};
    if (status && status !== 'all_status') filter.status = status;
    if (country && country !== 'all_countries') filter.countryCode = country;
    if (search && search.trim()) {
      filter.$or = [
        { country:   { $regex: search, $options: 'i' } },
        { pageUrl:   { $regex: search, $options: 'i' } },
        { userAgent: { $regex: search, $options: 'i' } },
      ];
    }

    const [records, total] = await Promise.all([
      col.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      col.countDocuments(filter),
    ]);

    return res.status(200).json({
      records: records.map(r => ({
        id: r._id.toString(),
        status: r.status,
        preferences: r.preferences,
        country: r.country,
        countryCode: r.countryCode,
        city: r.city,
        region: r.region,
        language: r.language,
        pageUrl: r.pageUrl,
        userAgent: r.userAgent,
        consentVersion: r.consentVersion,
        legalBasis: r.legalBasis,
        createdAt: r.createdAt,
      })),
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error('Get Consents Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve consent records.', code: 'SERVER_ERROR' });
  }
}

/* ── GET /api/admin/cookies/analytics ───────────────────────────────────── */
export async function getConsentAnalytics(req, res) {
  try {
    const db  = getDb();
    const col = db.collection(COL);

    const now          = new Date();
    const last30       = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last7        = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);

    const [
      totalAll,
      totalRecent30,
      totalRecent7,
      statusBreakdown,
      countryBreakdown,
      categoryBreakdown,
      dailyTrend,
    ] = await Promise.all([
      col.countDocuments({}),
      col.countDocuments({ createdAt: { $gte: last30 } }),
      col.countDocuments({ createdAt: { $gte: last7  } }),

      // Status breakdown
      col.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
      ]).toArray(),

      // Top countries (last 30 days)
      col.aggregate([
        { $match: { createdAt: { $gte: last30 }, country: { $ne: null } } },
        { $group: { _id: '$country', count: { $sum: 1 } } },
        { $sort:  { count: -1 } },
        { $limit: 8 },
      ]).toArray(),

      // Cookie category acceptance rates
      col.aggregate([
        { $group: {
          _id: null,
          functional: { $sum: { $cond: ['$preferences.functional', 1, 0] } },
          analytics:  { $sum: { $cond: ['$preferences.analytics',  1, 0] } },
          marketing:  { $sum: { $cond: ['$preferences.marketing',  1, 0] } },
          total:      { $sum: 1 },
        }},
      ]).toArray(),

      // Daily consent trend (last 30 days)
      col.aggregate([
        { $match: { createdAt: { $gte: last30 } } },
        { $group: {
          _id:   { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          accepted: { $sum: { $cond: [{ $eq: ['$status', 'all'] },      1, 0] } },
          rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
        }},
        { $sort: { _id: 1 } },
      ]).toArray(),
    ]);

    const cats = categoryBreakdown[0] || { functional: 0, analytics: 0, marketing: 0, total: 1 };
    const pct  = (n) => cats.total > 0 ? Math.round((n / cats.total) * 100) : 0;

    const statusMap = {};
    statusBreakdown.forEach(s => { statusMap[s._id] = s.count; });
    const acceptRate = totalAll > 0
      ? Math.round(((statusMap.all || 0) / totalAll) * 100)
      : 0;
    const rejectRate = totalAll > 0
      ? Math.round(((statusMap.rejected || 0) / totalAll) * 100)
      : 0;

    return res.status(200).json({
      overview: {
        total: totalAll,
        last30: totalRecent30,
        last7:  totalRecent7,
        acceptRate,
        rejectRate,
      },
      statusBreakdown: statusBreakdown.map(s => ({ status: s._id, count: s.count })),
      categoryAcceptance: {
        functional: { count: cats.functional, pct: pct(cats.functional) },
        analytics:  { count: cats.analytics,  pct: pct(cats.analytics)  },
        marketing:  { count: cats.marketing,  pct: pct(cats.marketing)  },
        total: cats.total,
      },
      topCountries: countryBreakdown.map(c => ({ country: c._id, count: c.count })),
      dailyTrend: dailyTrend.map(d => ({
        date: d._id, count: d.count,
        accepted: d.accepted, rejected: d.rejected,
      })),
    });
  } catch (err) {
    console.error('Get Consent Analytics Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve analytics.', code: 'SERVER_ERROR' });
  }
}

/* ── DELETE /api/admin/cookies/:id  (GDPR Art.17 Erasure) ───────────────── */
export async function deleteConsent(req, res) {
  try {
    const { ObjectId } = await import('mongodb');
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid ID.', code: 'INVALID_ID' });
    }

    const db  = getDb();
    const col = db.collection(COL);
    const result = await col.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Record not found.', code: 'NOT_FOUND' });
    }

    return res.status(200).json({ message: 'Consent record erased (GDPR Art.17).' });
  } catch (err) {
    console.error('Delete Consent Error:', err);
    return res.status(500).json({ error: 'Failed to erase record.', code: 'SERVER_ERROR' });
  }
}
