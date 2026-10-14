import { Router } from 'express';
import { getSettings, updateSettings, getThemeSettings, updateThemeSettings } from '../controllers/settings.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateAdmin);

router.get('/',       requirePermission('settings.read'),   getSettings);
router.patch('/',     requirePermission('settings.update'), updateSettings);
router.get('/theme',  requirePermission('settings.read'),   getThemeSettings);
router.put('/theme',  requirePermission('settings.update'), updateThemeSettings);

export default router;
