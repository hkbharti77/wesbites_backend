import { Router } from 'express';
import {
  recordVisitorHit,
  getVisitorAnalyticsOverview,
} from '../controllers/visitorAnalytics.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requireAnyPermission } from '../middleware/rbac.js';

export const publicVisitorAnalyticsRoutes = Router();
export const adminVisitorAnalyticsRoutes = Router();

// ── Public Endpoint: Fast, cookieless hit ingestion ─────────────────────────
publicVisitorAnalyticsRoutes.post('/hit', recordVisitorHit);

// ── Admin Protected Endpoint: Overview of Today vs Yesterday & Trends ──────
adminVisitorAnalyticsRoutes.use(authenticateAdmin);
adminVisitorAnalyticsRoutes.get(
  '/overview',
  requireAnyPermission(['analytics.read', 'dashboard.read']),
  getVisitorAnalyticsOverview
);
