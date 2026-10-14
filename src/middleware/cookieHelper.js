import cookie from 'cookie';

const SESSION_COOKIE_NAME = 'gyanvani_admin_session';
const CSRF_COOKIE_NAME = 'gyanvani_csrf_token';

export function parseCookies(req) {
  const header = req.headers.cookie;
  if (!header) return {};
  try {
    return cookie.parse(header);
  } catch {
    return {};
  }
}

export function setSessionCookie(res, rawToken, maxAgeMs = 24 * 60 * 60 * 1000) {
  const isSecure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  const cookieStr = cookie.serialize(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(maxAgeMs / 1000),
  });

  appendHeader(res, 'Set-Cookie', cookieStr);
}

export function clearSessionCookie(res) {
  const isSecure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  const cookieStr = cookie.serialize(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  appendHeader(res, 'Set-Cookie', cookieStr);
}

export function setCsrfCookie(res, csrfToken) {
  const isSecure = process.env.COOKIE_SECURE === 'true' || process.env.NODE_ENV === 'production';
  const cookieStr = cookie.serialize(CSRF_COOKIE_NAME, csrfToken, {
    httpOnly: false, // Must be readable by client JS to send in X-CSRF-Token header
    secure: isSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60,
  });

  appendHeader(res, 'Set-Cookie', cookieStr);
}

function appendHeader(res, name, value) {
  const prev = res.getHeader(name);
  if (!prev) {
    res.setHeader(name, value);
  } else if (Array.isArray(prev)) {
    res.setHeader(name, [...prev, value]);
  } else {
    res.setHeader(name, [prev, value]);
  }
}

export { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME };
