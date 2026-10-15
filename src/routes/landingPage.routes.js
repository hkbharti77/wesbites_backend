import { Router } from 'express';
import {
  getDraftLandingPage,
  updateDraftLandingPage,
  publishLandingPage,
  getLandingPageRevisions,
  rollbackLandingPageRevision,
  getLandingPagePreview,
} from '../controllers/landingPage.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

// All administrative landing page routes require authenticated admin sessions
router.use(authenticateAdmin);

// Draft endpoints
router.get('/draft', requirePermission('landing_page.read'), getDraftLandingPage);
router.put('/draft', requirePermission('landing_page.update'), updateDraftLandingPage);

// Publication & rollbacks
router.post('/publish', requirePermission('landing_page.publish'), publishLandingPage);
router.get('/revisions', requirePermission('landing_page.read'), getLandingPageRevisions);
router.post('/revisions/:version/rollback', requirePermission('landing_page.publish'), rollbackLandingPageRevision);

// Live preview
router.get('/preview', requirePermission('landing_page.read'), getLandingPagePreview);

export default router;
