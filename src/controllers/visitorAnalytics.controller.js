/**
 * Privacy-First Visitor & Traffic Analytics Controller
 * Fully compliant with India DPDP Act 2023 and EU GDPR (Recital 26 / Art. 5).
 * 
 * Features:
 * - Cookieless, zero PII storage (IPs are never written to database)
 * - Daily one-way HMAC hashing for unique visitor deduplication
 * - Granular Timeframe Filters: 1 hr, 6 hrs, 12 hrs, 24 hrs, 7 days (1 week), 30 days (1 month), Custom Date Range
 * - Country Demographics (Cloudflare cf-ipcountry & geo resolution)
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
    await col.createIndex({ createdAt: -1, channel: 1 });
    await col.createIndex({ date: 1, channel: 1 });
    await col.createIndex({ countryCode: 1, createdAt: -1 });
    await col.createIndex({ visitorHash: 1, date: 1 });
    // Automatic 90-day retention purge under GDPR Art. 5(1)(e) & DPDP Act 2023 §8(7)
    await col.createIndex({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
    indexesEnsured = true;
  } catch (err) {
    console.warn('[VisitorAnalytics] Failed to ensure indexes:', err.message);
  }
}

const ISO_COUNTRY_NAMES = {
  IN: 'India',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  AU: 'Australia',
  DE: 'Germany',
  FR: 'France',
  NL: 'Netherlands',
  AE: 'United Arab Emirates',
  SA: 'Saudi Arabia',
  SG: 'Singapore',
  JP: 'Japan',
  KR: 'South Korea',
  BR: 'Brazil',
  MX: 'Mexico',
  IT: 'Italy',
  ES: 'Spain',
  SE: 'Sweden',
  CH: 'Switzerland',
  ID: 'Indonesia',
  MY: 'Malaysia',
  PH: 'Philippines',
  ZA: 'South Africa',
  NZ: 'New Zealand',
  IE: 'Ireland',
  AT: 'Austria',
  BE: 'Belgium',
  DK: 'Denmark',
  FI: 'Finland',
  NO: 'Norway',
  PL: 'Poland',
  PT: 'Portugal',
  TR: 'Turkey',
  IL: 'Israel',
  PK: 'Pakistan',
  BD: 'Bangladesh',
  LK: 'Sri Lanka',
  NP: 'Nepal',
  RU: 'Russia',
  CN: 'China',
  HK: 'Hong Kong',
  TW: 'Taiwan',
  TH: 'Thailand',
  VN: 'Vietnam',
};

function resolveCountry(req, body = {}) {
  const codeRaw = (
    req.headers['cf-ipcountry'] ||
    req.headers['x-country-code'] ||
    req.headers['x-vercel-ip-country'] ||
    req.headers['cloudfront-viewer-country'] ||
    req.headers['x-appengine-country'] ||
    body.countryCode ||
    body.country ||
    ''
  ).toString().trim().toUpperCase();

  const code = (codeRaw && codeRaw !== 'XX' && codeRaw !== 'T1' && codeRaw.length === 2) ? codeRaw : 'Unknown';
  const name = ISO_COUNTRY_NAMES[code] || (body.countryName && body.countryName !== 'Unknown' && body.countryName !== 'Global' ? String(body.countryName).slice(0, 50) : (code === 'Unknown' ? 'Unknown' : code));
  return { countryCode: code, country: name };
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
  return clean
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[redacted]')
    .replace(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g, '[id]')
    .slice(0, 150) || '/';
}

function sanitizeReferrer(raw) {
  if (!raw || typeof raw !== 'string') return 'Direct / None';
  try {
    const u = new URL(raw);
    if (u.hostname.includes('gyanvaniai') || u.hostname.includes('localhost') || u.hostname.includes('hkbharti77')) {
      return 'Direct / Internal';
    }
    return u.hostname.replace(/^www\./, '').slice(0, 80);
  } catch {
    return raw.slice(0, 80);
  }
}

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
      countryCode: clientCountryCode,
      countryName: clientCountryName,
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

    const { countryCode, country } = resolveCountry(req, {
      countryCode: clientCountryCode,
      countryName: clientCountryName,
    });

    const hitDoc = {
      path: sanitizePath(reqPath),
      title: typeof title === 'string' ? title.slice(0, 120) : null,
      referrer: sanitizeReferrer(referrer),
      device: ['mobile', 'tablet', 'desktop'].includes(clientDevice) ? clientDevice : detectDevice(ua),
      browser: detectBrowser(ua),
      channel: resolvedChannel,
      countryCode,
      country,
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

    const {
      channel = 'all',
      timeframe = '7d', // '1h' | '6h' | '12h' | '24h' | 'today' | 'yesterday' | '7d' | '30d' | 'custom'
      startDate,
      endDate,
      country = 'all',
    } = req.query;

    const now = new Date();
    const todayStr = getLocalDateString(now);

    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayStr = getLocalDateString(yesterday);

    // 1. Calculate time filter boundary
    let timeRangeFilter = {};
    let isHourly = false;
    let timeframeLabel = 'Last 7 Days';

    switch (timeframe) {
      case '1h':
        isHourly = true;
        timeframeLabel = 'Last 1 Hour';
        timeRangeFilter = { createdAt: { $gte: new Date(now.getTime() - 60 * 60 * 1000) } };
        break;
      case '6h':
        isHourly = true;
        timeframeLabel = 'Last 6 Hours';
        timeRangeFilter = { createdAt: { $gte: new Date(now.getTime() - 6 * 60 * 60 * 1000) } };
        break;
      case '12h':
        isHourly = true;
        timeframeLabel = 'Last 12 Hours';
        timeRangeFilter = { createdAt: { $gte: new Date(now.getTime() - 12 * 60 * 60 * 1000) } };
        break;
      case '24h':
        isHourly = true;
        timeframeLabel = 'Last 24 Hours';
        timeRangeFilter = { createdAt: { $gte: new Date(now.getTime() - 24 * 60 * 60 * 1000) } };
        break;
      case 'today':
        timeframeLabel = 'Today';
        timeRangeFilter = { date: todayStr };
        break;
      case 'yesterday':
        timeframeLabel = 'Yesterday';
        timeRangeFilter = { date: yesterdayStr };
        break;
      case '30d':
      case '1m':
        timeframeLabel = 'Last 30 Days (1 Month)';
        timeRangeFilter = { createdAt: { $gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) } };
        break;
      case 'custom':
        timeframeLabel = 'Custom Range';
        if (startDate && endDate) {
          const s = new Date(startDate);
          const e = new Date(endDate);
          e.setHours(23, 59, 59, 999);
          timeRangeFilter = { createdAt: { $gte: s, $lte: e } };
          timeframeLabel = `${startDate} to ${endDate}`;
        } else {
          timeRangeFilter = { createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } };
        }
        break;
      case '7d':
      case '1w':
      default:
        timeframeLabel = 'Last 7 Days (1 Week)';
        timeRangeFilter = { createdAt: { $gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } };
        break;
    }

    // Channel filter
    const baseFilter = {};
    if (channel !== 'all') {
      baseFilter.channel = channel.toLowerCase();
    }

    // Country filter (if specified)
    if (country !== 'all') {
      baseFilter.countryCode = country.toUpperCase();
    }

    const currentFilter = { ...baseFilter, ...timeRangeFilter };

    // 2. Fetch Active Timeframe Stats + Today/Yesterday Baseline in parallel
    const [
      activePageviews,
      activeUniqueVisitors,
      todayPageviews,
      todayUniqueVisitors,
      yesterdayPageviews,
      yesterdayUniqueVisitors,
      totalAllTimePageviews,
    ] = await Promise.all([
      col.countDocuments(currentFilter),
      col.distinct('visitorHash', currentFilter),
      col.countDocuments({ ...baseFilter, date: todayStr }),
      col.distinct('visitorHash', { ...baseFilter, date: todayStr }),
      col.countDocuments({ ...baseFilter, date: yesterdayStr }),
      col.distinct('visitorHash', { ...baseFilter, date: yesterdayStr }),
      col.countDocuments(baseFilter),
    ]);

    const activeVisitorsCount = activeUniqueVisitors.length;
    const todayVisitorsCount = todayUniqueVisitors.length;
    const yesterdayVisitorsCount = yesterdayUniqueVisitors.length;

    const calcGrowth = (current, previous) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Number((((current - previous) / previous) * 100).toFixed(1));
    };

    const visitorGrowthPercent = calcGrowth(todayVisitorsCount, yesterdayVisitorsCount);
    const pageviewGrowthPercent = calcGrowth(todayPageviews, yesterdayPageviews);

    // 3. Build Trend Chart (Hourly vs Daily depending on timeframe)
    let trend = [];

    if (isHourly) {
      // Group by hour buckets
      const hourlyAggregation = await col.aggregate([
        { $match: currentFilter },
        {
          $project: {
            visitorHash: 1,
            hour: { $dateToString: { format: '%H:00', date: '$createdAt', timezone: 'Asia/Kolkata' } },
          },
        },
        {
          $group: {
            _id: { hour: '$hour', visitor: '$visitorHash' },
            hits: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: '$_id.hour',
            uniqueVisitors: { $sum: 1 },
            pageviews: { $sum: '$hits' },
          },
        },
        { $sort: { _id: 1 } },
      ]).toArray();

      trend = hourlyAggregation.map((row) => ({
        label: row._id,
        visitors: row.uniqueVisitors || 0,
        pageviews: row.pageviews || 0,
      }));
    } else {
      // Group by date buckets
      const dailyAggregation = await col.aggregate([
        { $match: currentFilter },
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
        { $sort: { _id: 1 } },
      ]).toArray();

      trend = dailyAggregation.map((row) => {
        const parts = String(row._id || '').split('-');
        let label = row._id;
        if (parts.length === 3) {
          label = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });
        }
        return {
          date: row._id,
          label,
          visitors: row.uniqueVisitors || 0,
          pageviews: row.pageviews || 0,
        };
      });
    }

    // 4. Country Breakdown (within current timeframe filter)
    const countryAggregation = await col.aggregate([
      { $match: currentFilter },
      {
        $group: {
          _id: { code: '$countryCode', name: '$country' },
          views: { $sum: 1 },
          uniqueVisitors: { $addToSet: '$visitorHash' },
        },
      },
      {
        $project: {
          countryCode: '$_id.code',
          country: '$_id.name',
          views: 1,
          visitors: { $size: '$uniqueVisitors' },
          _id: 0,
        },
      },
      { $sort: { visitors: -1, views: -1 } },
      { $limit: 15 },
    ]).toArray();

    const topCountries = countryAggregation.map((c) => ({
      countryCode: c.countryCode || 'Unknown',
      country: c.country || 'Unknown',
      visitors: c.visitors || 0,
      views: c.views || 0,
      percentage: activePageviews > 0 ? Number(((c.views / activePageviews) * 100).toFixed(1)) : 0,
    }));

    // 5. Top Visited Pages (within current timeframe filter)
    const topPages = await col.aggregate([
      { $match: currentFilter },
      { $group: { _id: '$path', views: { $sum: 1 }, uniqueVisitors: { $addToSet: '$visitorHash' } } },
      { $project: { path: '$_id', views: 1, visitors: { $size: '$uniqueVisitors' }, _id: 0 } },
      { $sort: { views: -1 } },
      { $limit: 12 },
    ]).toArray();

    // 6. Top Referrers (within current timeframe filter)
    const topReferrers = await col.aggregate([
      { $match: currentFilter },
      { $group: { _id: '$referrer', count: { $sum: 1 } } },
      { $project: { referrer: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]).toArray();

    // 7. Device Breakdown
    const deviceBreakdown = await col.aggregate([
      { $match: currentFilter },
      { $group: { _id: '$device', count: { $sum: 1 } } },
      { $project: { device: '$_id', count: 1, _id: 0 } },
      { $sort: { count: -1 } },
    ]).toArray();

    // 8. Consent Rate
    const consentCounts = await col.aggregate([
      { $match: currentFilter },
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
      timeframe: {
        key: timeframe,
        label: timeframeLabel,
        isHourly,
      },
      summary: {
        active: {
          visitors: activeVisitorsCount,
          pageviews: activePageviews,
        },
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
      trend,
      topCountries,
      topPages,
      topReferrers,
      deviceBreakdown,
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
