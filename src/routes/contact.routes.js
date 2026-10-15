import { Router } from 'express';
import { submitPublicLead } from '../controllers/lead.controller.js';
import {
  leadContactRateLimiter,
  createRateLimiterMiddleware,
} from '../middleware/rateLimiter.js';

const router = Router();
const contactLimiter = createRateLimiterMiddleware(leadContactRateLimiter);

// ── Public Contact / Demo Request Endpoint (Zero Session Auth) ────────────────
// Rate limited to 5 requests per 10 minutes per IP with deduplication & spam protection
router.post('/', contactLimiter, submitPublicLead);

export default router;
