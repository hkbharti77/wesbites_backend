/**
 * Privacy-First Visitor & Traffic Analytics Controller
 * Fully compliant with India DPDP Act 2023 and EU GDPR (Recital 26 / Art. 5).
 * 
 * Features:
 * - Cookieless, zero PII storage (IPs are never written to database)
 * - Daily one-way HMAC hashing for unique visitor deduplication
 * - Real-time "Today vs Yesterday" visitor comparison
 * - Automatic 90-day statutory data retention TTL purge
 */

import crypto from 'crypto';
import { getDb } from '../db/connection.js';

const COL = 'visitor_analytics';
let indexesEnsured = false;

async function ensureAnalyticsIndexes(db) {
  if (indexesEnsured) return;
  try {
    const col = db.collection(COL);
    await col.createIndex({ date: 1, channel: 1 });
    await col.createIndex({ visitorHash: 1, date: 1 });
    // Automatic 90-day retention purge under GDPR Art. 5(1)(e) & DPDP Act 2023 §8(7)
    await col.createIndex({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
    indexesEnsured = true;
  } catch (err) {
    console.warn('[VisitorAnalytics] Failed to ensure indexes:', err.message);
  }
}

/**
 * Returns formatted YYYY-MM-DD string in Asia/Kolkata (IST, UTC+5:30) or UTC
 */
function getLocalDateString(date = new Date(), timeZone = 'Asia/Kolkata') {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/**
 * Sanitize URLs / paths to eliminate sensitive tokens, emails, or personal parameters
 */
function sanitizePath(raw) {
  if (!raw || typeof raw !== 'string') return '/';
  const clean = raw.split('?')[0].split('#')[0].trim();
  // Strip UUIDs, emails, or tokens from path segments
  return clean
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[redacted]')
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '[id]')
    .slice(0, 150) || '/';
}

function sanitizeReferrer(raw) {
  if (!raw || typeof raw !== 'string') return 'Direct / None';
  try {
    const u = new URL(raw);
    // Ignore internal self-referrals
    if (u.hostname.includes('gyanvaniai') || u.hostname.includes('localhost') || u.hostname.includes('hkbharti77')) {
      return 'Direct / Internal';
    }
    return u.hostname.replace(/^www\./, '').slice(0, 80);
  } catch {
    return raw.slice(0, 80);
  }
}

/**
 * Detect client device classification from User-Agent without storing UA
 */
function detectDevice(ua = '') {
  const s = ua.toLowerCase();
  if (/mobile|android|iphone|ipod|blackberry|iemobile|opera mini/i.test(s)) return 'mobile';
  if (/tablet|ipad|playbook|silk/i.test(s)) return 'tablet';
  return 'desktop';
}

function detectBrowser(ua = '') {
  const s = ua.toLowerCase();
  if (s.includes('edg/')) return 'Edge';
  if (s.includes('chrome') && !s.includes('edg')) return 'Chrome';
  if (s.includes('safari') && !s.includes('chrome')) return 'Safari';
  if (s.includes('firefox')) return 'Firefox';
  if (s.includes('opera') || s.includes('opr')) return 'Opera';
  return 'Other';
}

/* ── POST /api/public/analytics/hit ────────────────────────────────────────── */
export async function recordVisitorHit(req, res) {
  try {
    const {
      path: reqPath,
      title,
      referrer,
      device: clientDevice,
      channel,
      consent = false,
    } = req.body || {};

    const db = getDb();
    await ensureAnalyticsIndexes(db);

    const ua = req.headers['user-agent'] || '';
    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    const now = new Date();
    const dateKey = getLocalDateString(now);

    // One-Way Anonymized Daily Hash: Changes every day so cross-day profiling is impossible
    // Satisfies GDPR Recital 26 & DPDP Act 2023 Data Minimization
    const dailySalt = process.env.JWT_SECRET || 'gyanvani-traffic-secret-salt';
    const visitorHash = crypto
      .createHmac('sha256', dailySalt)
      .update(`${ip}:${ua}:${dateKey}`)
      .digest('hex')
      .slice(0, 16);

    const resolvedChannel = (channel && typeof channel === 'string' && channel.toLowerCase().includes('portfolio'))
      ? 'portfolio'
      : 'crm';

    const hitDoc = {
      path: sanitizePath(reqPath),
      title: typeof title === 'string' ? title.slice(0, 120) : null,
      referrer: sanitizeReferrer(referrer),
      device: ['mobile', 'tablet', 'desktop'].includes(clientDevice) ? clientDevice : detectDevice(ua),
      browser: detectBrowser(ua),
      channel: resolvedChannel,
      consent: Boolean(consent),
      visitorHash,
      date: dateKey,
      createdAt: now,
    };

    // Fast non-blocking fire-and-forget insert
    db.collection(COL).insertOne(hitDoc).catch((err) => {
      console.warn('[VisitorAnalytics] Hit insert error:', err.message);
    });

    return res.status(201).json({ success: true });
  } catch (err) {
    console.error('Visitor Hit Ingestion Error:', err);
    return res.status(500).json({ error: 'Failed to record visitor hit.' });
  }
}

/* ── GET /api/admin/analytics/overview ─────────────────────────────────────── */
export async function getVisitorAnalyticsOverview(req, res) {
  try {
    const db = getDb();
    await ensureAnalyticsIndexes(db);
    const col = db.collection(COL);

    const { channel = 'all', days = '7' } = req.query;
    const dayRange = Math.min(90, Math.max(2, parseInt(days, 10) || 7));

    // Base channel filter
    const baseFilter = {};
    if (channel !== 'all') {
      baseFilter.channel = channel.toLowerCase();
    }

    const now = new Date();
    const todayStr = getLocalDateString(now);

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = getLocalDateString(yesterday);

    // 1. Fetch Today and Yesterday metrics in parallel
    const [
      todayPageviews,
      todayUniqueVisitors,
      yesterdayPageviews,
      yesterdayUniqueVisitors,
      totalAllTimePageviews,
    ] = await Promise.all([
      col.countDocuments({ ...baseFilter, date: todayStr }),
      col.distinct('visitorHash', { ...baseFilter, date: todayStr }),
      col.countDocuments({ ...baseFilter, date: yesterdayStr }),
      col.distinct('visitorHash', { ...baseFilter, date: yesterdayStr }),
      col.countDocuments(baseFilter),
    ]);

    const todayVisitorsCount = todayUniqueVisitors.length;
    const yesterdayVisitorsCount = yesterdayUniqueVisitors.length;

    // Growth Calculation: % difference between today and yesterday
    const calcGrowth = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    const visitorGrowthPercent = calcGrowth(todayVisitorsCount, yesterdayVisitorsCount);
    const pageviewGrowthPercent = calcGrowth(todayPageviews, yesterdayPageviews);

    // 2. Build Daily Trend for requested range (e.g. 7, 14, or 30 days)
    const trendDates = [];
    for (let i = dayRange - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      trendDates.push(getLocalDateString(d));
    }

    const trendAggregation = await col.aggregate([
      {
        $match: {
          ...baseFilter,
          date: { $in: trendDates },
        },
      },
      {
        $group: {
          _id: { date: '$date', visitor: '$visitorHash' },
          hits: { $sum: 1 },
        },
      },
      {
        $group: {
          _id: '$_id.date',
          uniqueVisitors: { $sum: 1 },
          pageviews: { $sum: '$hits' },
        },
      },
    ]).toArray();

    const trendMap = new Map();
    trendAggregation.forEach((row) => {
      trendMap.set(row._id, {
        visitors: row.uniqueVisitors || 0,
        pageviews: row.pageviews || 0,
      });
    });

    const dailyTrend = trendDates.map((dt) => {
      const data = trendMap.get(dt) || { visitors: 0, pageviews: 0 };
      // Format readable label e.g. "Nov 17"
      const parts = dt.split('-');
      const label = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      return {
        date: dt,
        label,
        visitors: data.visitors,
        pageviews: data.pageviews,
      };
    });

    // 3. Top Visited Pages (Last 30 days)
    const thirtyDaysAgoDate = getLocalDateString(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
    const recentFilter = { ...baseFilter, date: { $gte: thirtyDaysAgoDate } };

    const topPages = await col.aggregate([
      { $match: recentFilter },
      { $group: { _id: '$path', views: { $sum: 1 }, uniqueVisitors: { $addToSet: '$visitorHash' } } },
      { $project: { path: '$_id', views: 1, visitors: { $size: '$uniqueVisitors' }, _id: 0 } },
      { $sort: { views: -1 } },
      { $limit: 8 },
    ]).toArray();

    // 4. Top Referrers
    const topReferrers = await col.aggregate([
      { $match: recentFilter },
      { $group: { _id: '$referrer', count: { $sum: 1 } } },
      { $project: { referrer: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]).toArray();

    // 5. Device Breakdown
    const deviceBreakdown = await col.aggregate([
      { $match: recentFilter },
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $project: { device: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } },
    ]).toArray();

    // 6. Channel Breakdown
    const channelBreakdown = await col.aggregate([
      { $match: { date: { $gte: thirtyDaysAgoDate } } },
      { $group: { _id: '$channel', count: { $sum: 1 } } },
      { $project: { channel: '$_id', count: 1, _id: 0 } },
    ]).toArray();

    // 7. Consent Rate
    const consentCounts = await col.aggregate([
      { $match: recentFilter },
      { $group: { _id: '$consent', count: { $sum: 1 } } },
    ]).toArray();

    let acceptedConsentCount = 0;
    let totalConsentResponses = 0;
    consentCounts.forEach((c) => {
      totalConsentResponses += c.count;
      if (c._id === true) acceptedConsentCount += c.count;
    });

    const consentRate = totalConsentResponses > 0
      ? Number(((acceptedConsentCount / totalConsentResponses) * 100).toFixed(1))
      : 100;

    return res.status(200).json({
      summary: {
        today: {
          date: todayStr,
          visitors: todayVisitorsCount,
          pageviews: todayPageviews,
        },
        yesterday: {
          date: yesterdayStr,
          visitors: yesterdayVisitorsCount,
          pageviews: yesterdayPageviews,
        },
        growth: {
          visitorsPercent: visitorGrowthPercent,
          pageviewsPercent: pageviewGrowthPercent,
          isVisitorPositive: visitorGrowthPercent >= 0,
          isPageviewPositive: pageviewGrowthPercent >= 0,
        },
        totalAllTimePageviews,
        consentRate,
      },
      dailyTrend,
      topPages,
      topReferrers,
      deviceBreakdown,
      channelBreakdown,
      // External Analytics Properties & Dashboard Launch URLs
      externalTools: {
        ga4: {
          name: 'Google Analytics 4',
          tagId: 'G-RN6FQWDQ6M',
          status: 'Active',
          dashboardUrl: 'https://analytics.google.com/analytics/web/',
        },
        cloudflare: {
          name: 'Cloudflare Web Analytics',
          token: 'e68d0475ffde4e0ba1f1c7e1250d9e69',
          status: 'Active (Cookieless Beacon)',
          dashboardUrl: 'https://dash.cloudflare.com/',
        },
        vercel: {
          name: 'Vercel Web Analytics',
          package: '@vercel/analytics',
          status: 'Active',
          dashboardUrl: 'https://vercel.com/dashboard',
        },
      },
      compliance: {
        law: 'India DPDP Act 2023 §6 / EU GDPR Recital 26',
        storageType: 'Cookieless Aggregate Telemetry',
        piiStored: false,
        retentionDays: 90,
      },
    });
  } catch (err) {
    console.error('Get Visitor Analytics Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve visitor analytics.' });
  }
}
