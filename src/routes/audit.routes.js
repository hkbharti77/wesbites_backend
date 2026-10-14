import { Router } from 'express';
import { fetchAuditLogs } from '../controllers/audit.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateAdmin);

router.get('/', requirePermission('audit.read'), fetchAuditLogs);

export default router;
