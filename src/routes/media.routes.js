import { Router } from 'express';
import {
  getMedia,
  uploadMedia,
  deleteMedia,
} from '../controllers/media.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateAdmin);

router.get('/', requirePermission('media.read'), getMedia);
router.post('/upload', requirePermission('media.upload'), uploadMedia);
router.delete('/:id', requirePermission('media.delete'), deleteMedia);

export default router;
