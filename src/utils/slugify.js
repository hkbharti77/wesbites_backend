import crypto from 'crypto';

/**
 * Converts a text title into a clean URL-friendly slug
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  if (!text) return '';
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // Trim hyphens from ends
}

/**
 * Calculates estimated reading time in minutes based on average 200 wpm
 * @param {string} content
 * @returns {number}
 */
export function calculateReadingTime(content) {
  if (!content) return 1;
  // Strip HTML tags and markdown markers
  const plainText = content.replace(/<[^>]*>/g, ' ').replace(/[#*`_~\[\]]/g, ' ');
  const words = plainText.trim().split(/\s+/).filter(Boolean);
  return Math.max(1, Math.ceil(words.length / 200));
}

/**
 * Generates an HMAC preview token valid for 2 hours for unpublished drafts
 * @param {string} postId
 * @param {string} secret
 * @returns {string} token
 */
export function generatePreviewToken(postId, secret = process.env.SESSION_SECRET || 'preview-secret-key-2026') {
  const expiresAt = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
  const payload = `${postId}:${expiresAt}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${expiresAt}.${signature}`;
}

/**
 * Validates an HMAC preview token
 * @param {string} postId
 * @param {string} token
 * @param {string} secret
 * @returns {boolean}
 */
export function verifyPreviewToken(postId, token, secret = process.env.SESSION_SECRET || 'preview-secret-key-2026') {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  const [expiresAtStr, signature] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) {
    return false; // Expired
  }

  const expectedPayload = `${postId}:${expiresAt}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(expectedPayload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSignature, 'hex'));
}
