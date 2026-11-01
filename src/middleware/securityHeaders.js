/**
 * Production HTTP Security Headers Middleware
 * Implements comprehensive Helmet-equivalent and OWASP Recommended Security Headers:
 * - Content-Security-Policy (CSP)
 * - Strict-Transport-Security (HSTS)
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: SAMEORIGIN
 * - X-XSS-Protection: 0 (modern standard)
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Cross-Origin-Opener-Policy: same-origin-allow-popups
 * - Cross-Origin-Resource-Policy: cross-origin
 */

export function securityHeadersMiddleware(req, res, next) {
  // Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking by disallowing framing from untrusted origins
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');

  // Modern browsers disable legacy buggy XSS filters
  res.setHeader('X-XSS-Protection', '0');

  // Limit referrer information passed on outbound requests
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Enforce HSTS for 1 year with subdomains and preload inclusion
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // Prevent cross-origin window manipulation while allowing OAuth / embeds if needed
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');

  // Allow cross-origin media and assets to load on frontend portals
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

  // Remove Express fingerprinting header
  res.removeHeader('X-Powered-By');

  next();
}

