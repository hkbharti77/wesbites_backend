import { Router } from 'express';
import { getPermissions } from '../controllers/role.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateAdmin);

router.get('/', requirePermission('permissions.read'), getPermissions);

export default router;
