import { Router } from 'express';
import {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} from '../controllers/user.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateAdmin);

router.get('/', requirePermission('users.read'), getUsers);
router.get('/:id', requirePermission('users.read'), getUserById);
router.post('/', requirePermission('users.create'), createUser);
router.patch('/:id', requirePermission('users.update'), updateUser);
router.delete('/:id', requirePermission('users.deactivate'), deleteUser);

export default router;
