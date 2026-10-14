import { Router } from 'express';
import {
  login,
  logout,
  getCurrentUser,
  forgotPassword,
  resetPassword,
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
router.post('/logout', authenticateAdmin, logout);
router.get('/me', authenticateAdmin, getCurrentUser);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

export default router;
