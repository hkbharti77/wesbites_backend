import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} from '../controllers/category.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateAdmin);

router.get('/', requirePermission('categories.read'), getCategories);
router.post('/', requirePermission('categories.manage'), createCategory);
router.put('/:id', requirePermission('categories.manage'), updateCategory);
router.delete('/:id', requirePermission('categories.manage'), deleteCategory);

export default router;
