import { Router } from 'express';
import {
  getSubscribers,
  getSubscriberStats,
  updateSubscriberStatus,
  deleteSubscriber,
  exportSubscribersCsv,
} from '../controllers/newsletter.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

// Administrative Endpoints require active session authentication
router.use(authenticateAdmin);

router.get('/',           requirePermission('subscribers.read'),   getSubscribers);
router.get('/stats',      requirePermission('subscribers.read'),   getSubscriberStats);
router.get('/export',     requirePermission('subscribers.export'), exportSubscribersCsv);
router.patch('/:id/status', requirePermission('subscribers.manage'), updateSubscriberStatus);
router.delete('/:id',     requirePermission('subscribers.delete'), deleteSubscriber);

export default router;
