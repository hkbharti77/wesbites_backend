import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './db/connection.js';
import { csrfMiddleware } from './middleware/csrf.js';

import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import roleRoutes from './routes/role.routes.js';
import permissionRoutes from './routes/permission.routes.js';
import menuRoutes from './routes/menu.routes.js';
import auditRoutes from './routes/audit.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import cmsPostRoutes from './routes/cmsPost.routes.js';
import categoryRoutes from './routes/category.routes.js';
import mediaRoutes from './routes/media.routes.js';
import publicPostRoutes from './routes/publicPost.routes.js';
import cookieRoutes from './routes/cookie.routes.js';
import newsletterRoutes from './routes/newsletter.routes.js';
import subscriberRoutes from './routes/subscriber.routes.js';
import contactRoutes from './routes/contact.routes.js';
import leadRoutes from './routes/lead.routes.js';
import landingPageRoutes from './routes/landingPage.routes.js';
import publicLandingPageRoutes from './routes/publicLandingPage.routes.js';
import { getPublicCategories, getPublicTags, getBlogSitemapXmlEndpoint, getBlogRssXmlEndpoint } from './controllers/publicPost.controller.js';
import { getPublicTheme } from './controllers/settings.controller.js';
import { publicSiteMediaRoutes, adminSiteMediaRoutes } from './routes/siteMedia.routes.js';

dotenv.config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

const DEFAULT_ALLOWED_ORIGINS = [
  'https://www.gyanvaniai.com',
  'https://gyanvaniai.com',
  'https://www.gyanvaniai.info',
  'https://gyanvaniai.info',
  'https://admin.gyanvaniai.info',
  'https://admin.gyanvaniai.com',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:8080',
  'https://hkbharti77.github.io',
];

// Dynamic CORS Origins governed by process.env.CORS_ORIGIN with enterprise domain defaults
export function parseAllowedOrigins() {
  const envOrigins = process.env.CORS_ORIGIN;
  const configured = envOrigins
    ? envOrigins.split(',').map((o) => o.trim().replace(/\/+$/, '')).filter(Boolean)
    : [];
  return Array.from(new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]));
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. curl, server-to-server, health check, cron jobs)
    if (!origin) {
      return callback(null, true);
    }

    const allowed = parseAllowedOrigins();
    const normalizedOrigin = origin.trim().replace(/\/+$/, '');

    // Allow wildcard, explicit match, any gyanvaniai domain/subdomain, or Vercel preview deployment
    const isAllowed = 
      allowed.includes('*') ||
      allowed.includes(normalizedOrigin) ||
      /^https?:\/\/(?:[a-zA-Z0-9-]+\.)*gyanvaniai\.(?:com|info)(?::\d+)?$/i.test(normalizedOrigin) ||
      /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/i.test(normalizedOrigin);

    if (isAllowed) {
      return callback(null, true);
    }

    console.warn(`[CORS Blocked] Origin "${origin}" rejected. Allowed origins in CORS_ORIGIN:`, allowed);
    const err = new Error(`Origin "${origin}" is not allowed by CORS_ORIGIN policy.`);
    err.statusCode = 403;
    err.code = 'CORS_NOT_ALLOWED';
    return callback(err);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  exposedHeaders: ['X-CSRF-Token'],
  optionsSuccessStatus: 200,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static file serving for uploads
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// CSRF double-submit protection
app.use(csrfMiddleware);

// Ensure MongoDB database is connected on serverless requests (e.g. Vercel)
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Database connection error in request middleware:', err.message);
    next(err);
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'gyanvaniai-admin-backend',
    timestamp: new Date().toISOString(),
  });
});

// Admin API endpoints
app.use('/api/admin/auth', authRoutes);
app.use('/api/admin/users', userRoutes);
app.use('/api/admin/roles', roleRoutes);
app.use('/api/admin/permissions', permissionRoutes);
app.use('/api/admin/menus', menuRoutes);
app.use('/api/admin/audit-logs', auditRoutes);
app.use('/api/admin/audit', auditRoutes);
app.use('/api/admin/settings', settingsRoutes);

// Admin CMS endpoints
app.use('/api/admin/landing-page', landingPageRoutes);
app.use('/api/admin/posts', cmsPostRoutes);
app.use('/api/admin/categories', categoryRoutes);
app.use('/api/admin/media/portfolio', adminSiteMediaRoutes);
app.use('/api/admin/media', mediaRoutes);

// Cookie Consent (public record + admin management)
app.use('/api/public/cookie-consent', cookieRoutes);
app.use('/api/admin/cookies', cookieRoutes);

// Newsletter & Subscribers (public subscribe/unsubscribe + admin management)
app.use('/api/public/newsletter', newsletterRoutes);
app.use('/api/admin/subscribers', subscriberRoutes);

// Contact & Lead Management (public contact ingestion + admin lead management)
app.use('/api/public/contact', contactRoutes);
app.use('/api/admin/leads', leadRoutes);

// Public XML Sitemaps & RSS Feeds (Dynamic MongoDB-backed for Search & AI Crawlers)
app.get(['/blog-sitemap.xml', '/sitemap.xml'], getBlogSitemapXmlEndpoint);
app.get(['/rss.xml', '/feed.xml'], getBlogRssXmlEndpoint);

// Public Read-Only APIs (zero authentication required)
app.use('/api/public/landing-page', publicLandingPageRoutes);
app.use('/api/public/media', publicSiteMediaRoutes);
app.use('/api/public/posts', publicPostRoutes);
app.get('/api/public/categories', getPublicCategories);
app.get('/api/public/tags', getPublicTags);
app.get('/api/public/site-settings/theme', getPublicTheme);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: `Cannot ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND',
  });
});

// Centralized error handling
app.use((err, req, res, _next) => {
  console.error('Unhandled Application Error:', err);
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'An internal server error occurred.',
    code: err.code || 'INTERNAL_ERROR',
  });
});

// Start server function (exported for testing or programmatic boot)
export async function startServer(customPort = PORT) {
  await connectDB();
  return new Promise((resolve) => {
    const server = app.listen(customPort, () => {
      console.log(`🚀 GyanVaniAi Admin Backend running on port ${customPort}`);
      console.log(`🔒 CORS Origin Policy: Controlled by CORS_ORIGIN -> ${parseAllowedOrigins().join(', ')}`);
      resolve(server);
    });
  });
}

// Auto-boot if executed directly
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export default app;
