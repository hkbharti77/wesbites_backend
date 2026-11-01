import { Router } from 'express';
import {
  login,
  logout,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  verify2FALogin,
  setup2FA,
  enable2FA,
  disable2FA,
} from '../controllers/auth.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { generateSecureToken } from '../utils/crypto.js';
import { setCsrfCookie } from '../middleware/cookieHelper.js';

const router = Router();

// Handshake endpoint to fetch fresh CSRF token and set cookie
router.get('/csrf', (req, res) => {
  const token = generateSecureToken(16);
  setCsrfCookie(res, token);
  return res.status(200).json({ csrfToken: token });
});

router.post('/login', login);
router.post('/2fa/login', verify2FALogin);
router.post('/2fa/setup', authenticateAdmin, setup2FA);
router.post('/2fa/enable', authenticateAdmin, enable2FA);
router.post('/2fa/disable', authenticateAdmin, disable2FA);
router.post('/logout', authenticateAdmin, logout);
router.get('/me', authenticateAdmin, getCurrentUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
