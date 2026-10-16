import { Router } from 'express';
import { fetchAuditLogs, fetchAuditStats, exportAuditLogsController } from '../controllers/audit.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

router.use(authenticateAdmin);

// Analytics and compliance statistics
router.get('/stats', requirePermission('audit.read'), fetchAuditStats);

// Compliance export (CSV / JSON)
router.get('/export', requirePermission('audit.read'), exportAuditLogsController);

// Filtered and paginated audit logs
router.get('/', requirePermission('audit.read'), fetchAuditLogs);

// Immutable Forensic Protection: Reject any mutation attempts with HTTP 405 Method Not Allowed
const rejectAuditMutation = (req, res) => {
  return res.status(405).json({
    error: 'Security audit logs are immutable append-only records. Modifications and deletions are strictly prohibited under compliance standards.',
    code: 'AUDIT_LOG_IMMUTABLE',
  });
};

router.put('/', rejectAuditMutation);
router.delete('/', rejectAuditMutation);
router.patch('/', rejectAuditMutation);
router.post('/', rejectAuditMutation);

router.put('/:id', rejectAuditMutation);
router.delete('/:id', rejectAuditMutation);
router.patch('/:id', rejectAuditMutation);
router.post('/:id', rejectAuditMutation);

export default router;

