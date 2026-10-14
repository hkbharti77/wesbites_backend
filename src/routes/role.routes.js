import { Router } from 'express';
import {
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  getPermissions,
} from '../controllers/role.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateAdmin);

router.get('/', requirePermission('roles.read'), getRoles);
router.post('/', requirePermission('roles.create'), createRole);
router.patch('/:id', requirePermission('roles.update'), updateRole);
router.delete('/:id', requirePermission('roles.delete'), deleteRole);

router.get('/meta/permissions', requirePermission('permissions.read'), getPermissions);

export default router;
