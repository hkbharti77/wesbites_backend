import crypto from 'crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encodes a buffer into Base32 string (RFC 4648)
 */
export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodes a Base32 string into a buffer (RFC 4648)
 */
export function base32Decode(base32Str) {
  const cleanStr = base32Str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < cleanStr.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(cleanStr[i]);
    if (idx === -1) continue;

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates a cryptographically secure Base32 secret key (20 bytes = 160 bits)
 */
export function generateTotpSecret(bytes = 20) {
  const buffer = crypto.randomBytes(bytes);
  return base32Encode(buffer);
}

/**
 * Computes the 6-digit TOTP code for a given timestamp and secret (RFC 6238)
 */
export function generateTotpCode(secretBase32, timeStepSeconds = 30, timestampMs = Date.now()) {
  const secretKey = base32Decode(secretBase32);
  const timeStep = Math.floor(timestampMs / 1000 / timeStepSeconds);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(timeStep));

  const hmac = crypto.createHmac('sha1', secretKey);
  hmac.update(counterBuffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0x0f;
  const binaryCode =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const token = (binaryCode % 1000000).toString().padStart(6, '0');
  return token;
}

/**
 * Verifies a user-supplied TOTP code with clock-drift window (+/- 1 time step)
 */
export function verifyTotpCode(secretBase32, token, windowSteps = 1, timeStepSeconds = 30) {
  if (!secretBase32 || !token || typeof token !== 'string') return false;

  const cleanToken = token.trim();
  if (!/^\d{6}$/.test(cleanToken)) return false;

  const nowMs = Date.now();
  for (let errorStep = -windowSteps; errorStep <= windowSteps; errorStep++) {
    const checkTimeMs = nowMs + errorStep * timeStepSeconds * 1000;
    const expected = generateTotpCode(secretBase32, timeStepSeconds, checkTimeMs);
    if (crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(expected))) {
      return true;
    }
  }

  return false;
}

/**
 * Constructs standard otpauth:// URL for authenticator apps (Google Authenticator, Apple, Authy)
 */
export function buildOtpAuthUri({ issuer = 'GyanVaniAi', accountName, secret }) {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

