import { Router } from 'express';
import {
  submitPrivacyRequest,
  getPrivacyRequests,
  updatePrivacyRequest,
} from '../controllers/privacyRequest.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  leadContactRateLimiter,
  createRateLimiterMiddleware,
} from '../middleware/rateLimiter.js';

const publicRouter = Router();
const adminRouter = Router();

// Public endpoint rate limiter (5 requests per 10 minutes per IP)
const submissionLimiter = createRateLimiterMiddleware(leadContactRateLimiter);

// ── Public Routes (Zero Session Auth) ──────────────────────────────────────────
publicRouter.post('/', submissionLimiter, submitPrivacyRequest);

// ── Admin Routes (Protected by RBAC) ───────────────────────────────────────────
adminRouter.use(authenticateAdmin);
adminRouter.get('/', requirePermission('audit.read'), getPrivacyRequests);
adminRouter.patch('/:id', requirePermission('settings.manage'), updatePrivacyRequest);

export { publicRouter as publicPrivacyRequestRoutes, adminRouter as adminPrivacyRequestRoutes };
