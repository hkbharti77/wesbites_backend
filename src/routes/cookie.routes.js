import { Router } from 'express';
import {
  recordConsent,
  getConsents,
  getConsentAnalytics,
  deleteConsent,
  bulkDeleteConsents,
} from '../controllers/cookie.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

// ── Public endpoint — no auth needed (called by browser on consent click) ──
router.post('/record', recordConsent);
router.post('/',       recordConsent);

// ── Admin endpoints ─────────────────────────────────────────────────────────
router.use(authenticateAdmin);
router.get('/',           requirePermission('cookies.read'),   getConsents);
router.get('/analytics',  requirePermission('cookies.read'),   getConsentAnalytics);
router.post('/bulk-delete', requirePermission('cookies.manage'), bulkDeleteConsents);
router.delete('/:id',     requirePermission('cookies.manage'), deleteConsent);

export default router;
