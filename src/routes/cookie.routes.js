import { Router } from 'express';
import {
  recordConsent,
  getConsents,
  getConsentAnalytics,
  deleteConsent,
} from '../controllers/cookie.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

// ── Public endpoint — no auth needed (called by browser on consent click) ──
router.post('/record', recordConsent);

// ── Admin endpoints ─────────────────────────────────────────────────────────
router.use(authenticateAdmin);
router.get('/',           requirePermission('cookies.read'),   getConsents);
router.get('/analytics',  requirePermission('cookies.read'),   getConsentAnalytics);
router.delete('/:id',     requirePermission('cookies.manage'), deleteConsent);

export default router;
