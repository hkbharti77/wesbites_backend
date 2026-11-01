import { Router } from 'express';
import {
  getSettings,
  updateSettings,
  getThemeSettings,
  updateThemeSettings,
  triggerDataRetentionCleanup,
} from '../controllers/settings.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateAdmin);

router.get('/',            requirePermission('settings.read'),   getSettings);
router.patch('/',          requirePermission('settings.update'), updateSettings);
router.get('/theme',       requirePermission('settings.read'),   getThemeSettings);
router.put('/theme',       requirePermission('settings.update'), updateThemeSettings);
router.post('/retention/run', requirePermission('settings.update'), triggerDataRetentionCleanup);

export default router;
