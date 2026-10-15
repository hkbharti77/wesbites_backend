import { Router } from 'express';
import { getPublicLandingPage } from '../controllers/landingPage.controller.js';

const router = Router();

// Public Read-Only Endpoint (Zero authentication required, public caching enabled)
router.get('/', getPublicLandingPage);

export default router;
