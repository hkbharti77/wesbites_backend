import { Router } from 'express';
import {
  subscribe,
  verifyUnsubscribeToken,
  unsubscribe,
  confirmSubscription,
} from '../controllers/newsletter.controller.js';
import {
  newsletterRateLimiter,
  unsubscribeRateLimiter,
  createRateLimiterMiddleware,
} from '../middleware/rateLimiter.js';

const router = Router();
const subscribeLimiter = createRateLimiterMiddleware(newsletterRateLimiter);
const unsubscribeLimiter = createRateLimiterMiddleware(unsubscribeRateLimiter);

// ── Public Endpoints (Zero Session Auth) ───────────────────────────────────────

// Public subscription endpoint (rate limited: 10 req/min per IP)
router.post('/subscribe', subscribeLimiter, subscribe);

// SAFE token verification endpoint: Read-only; email scanners will NEVER unsubscribe
router.get('/unsubscribe/verify', unsubscribeLimiter, verifyUnsubscribeToken);

// Explicit unsubscription endpoint (RFC 8058 One-Click list-unsubscribe POST compliant)
router.post('/unsubscribe', unsubscribeLimiter, unsubscribe);

// Double opt-in confirmation link (GET renders scanner-proof prompt; POST executes state mutation)
router.get('/confirm', confirmSubscription);
router.post('/confirm', confirmSubscription);

export default router;
