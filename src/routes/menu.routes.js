import { Router } from 'express';
import {
  getMenus,
  getMenuConfig,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  reorderMenus,
} from '../controllers/menu.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateAdmin);

// Dynamic menu response for current user navigation
router.get('/config', getMenuConfig);

// Administrative CRUD operations
router.get('/', requirePermission('menus.read'), getMenus);
router.post('/', requirePermission('menus.create'), createMenuItem);
router.patch('/reorder', requirePermission('menus.update'), reorderMenus);
router.patch('/:id', requirePermission('menus.update'), updateMenuItem);
router.delete('/:id', requirePermission('menus.delete'), deleteMenuItem);

export default router;
