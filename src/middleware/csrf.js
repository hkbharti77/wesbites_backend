import { generateSecureToken } from '../utils/crypto.js';
import { parseCookies, setCsrfCookie, CSRF_COOKIE_NAME } from './cookieHelper.js';

export function csrfMiddleware(req, res, next) {
  // Allow test runners or internal non-browser clients to bypass if explicitly configured
  if (process.env.DISABLE_CSRF === 'true') {
    return next();
  }

  const cookies = parseCookies(req);
  let csrfToken = cookies[CSRF_COOKIE_NAME];

  // If client doesn't have a CSRF cookie yet, generate and attach one
  if (!csrfToken) {
    csrfToken = generateSecureToken(16);
    setCsrfCookie(res, csrfToken);
  }

  // Safe HTTP verbs do not require token validation
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Bearer token requests (used by mobile apps, external API clients, and cross-origin SPAs)
  // are immune to ambient CSRF attacks because browsers do not attach Authorization headers automatically
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return next();
  }

  // Exempt initial unauthenticated authentication requests (login, forgot, reset)
  // and public visitor endpoints (/api/public/) which carry no ambient session
  const isAuthPreFlight =
    req.path === '/login' ||
    req.originalUrl.includes('/auth/login') ||
    req.originalUrl.includes('/auth/forgot-password') ||
    req.originalUrl.includes('/auth/reset-password') ||
    req.originalUrl.includes('/api/public/');

  if (isAuthPreFlight) {
    return next();
  }

  const headerToken = req.headers['x-csrf-token'];

  // Check double-submit CSRF match
  if (!headerToken || headerToken !== csrfToken) {
    return res.status(403).json({
      error: 'CSRF token validation failed. Please refresh the page and try again.',
      code: 'CSRF_INVALID',
    });
  }

  next();
}
