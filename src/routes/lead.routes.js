import { Router } from 'express';
import {
  getLeads,
  getLeadStats,
  getLeadById,
  updateLead,
  addLeadNote,
  replyToLead,
  markLeadMessagesRead,
  deleteLead,
  exportLeadsCsv,
} from '../controllers/lead.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

// Administrative Endpoints require active session authentication
router.use(authenticateAdmin);

router.get('/',                    requirePermission('leads.read'),   getLeads);
router.get('/stats',               requirePermission('leads.read'),   getLeadStats);
router.get('/export',              requirePermission('leads.export'), exportLeadsCsv);
router.get('/:id',                 requirePermission('leads.read'),   getLeadById);
router.patch('/:id',               requirePermission('leads.manage'), updateLead);
router.patch('/:id/read-messages', requirePermission('leads.manage'), markLeadMessagesRead);
router.post('/:id/notes',          requirePermission('leads.manage'), addLeadNote);
router.post('/:id/reply',          requirePermission('leads.manage'), replyToLead);
router.delete('/:id',              requirePermission('leads.delete'), deleteLead);

export default router;
