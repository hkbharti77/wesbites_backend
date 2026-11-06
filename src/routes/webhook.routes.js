import { Router } from 'express';
import { handleInboundEmailWebhook } from '../controllers/inboundEmail.controller.js';

const router = Router();

/**
 * Inbound Email Webhook
 * Receives incoming email payloads from Cloudflare Email Routing workers, AWS SES SNS, SendGrid, etc.
 * Authenticated via secret token or signature in headers/query params.
 */
router.post('/inbound-email', handleInboundEmailWebhook);

export default router;

