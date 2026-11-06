import { simpleParser } from 'mailparser';

/**
 * Email Parser & Content Cleaner Utility
 * 
 * Handles RFC email address parsing, MIME email decoding via mailparser,
 * quote stripping (cutting out previous email history and headers),
 * Lead ID extraction, and HTML sanitization for inbound email messages.
 */

/**
 * Extracts display name and raw email address from sender string.
 * e.g. "Priya Sharma <priya@acmecorp.com>" -> { name: "Priya Sharma", email: "priya@acmecorp.com" }
 */
export function parseSenderAddress(raw) {
  if (!raw || typeof raw !== 'string') {
    return { name: '', email: '' };
  }

  const angleMatch = raw.match(/^(?:["']?([^"']*)["']?\s*)?<([^>]+)>/);
  if (angleMatch) {
    return {
      name: (angleMatch[1] || '').trim(),
      email: (angleMatch[2] || '').trim().toLowerCase(),
    };
  }

  // Bare email or simple text
  const clean = raw.trim().replace(/[<>]/g, '');
  return {
    name: '',
    email: clean.toLowerCase(),
  };
}

/**
 * Strips quoted reply history from plain text email body.
 * Strips standard Gmail, Outlook, Apple Mail, and Thunderbird quote markers.
 */
export function stripQuotedEmailText(bodyText) {
  if (!bodyText || typeof bodyText !== 'string') return '';

  let text = bodyText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 1. Cut off at "On <date>, <someone> wrote:"
  const onDateWroteRegex = /\n(?:On\s+[A-Za-z]{3},\s+[A-Za-z0-9\s,:]+wrote:|\s*On\s+.+wrote:)/i;
  const wroteMatch = text.search(onDateWroteRegex);
  if (wroteMatch !== -1) {
    text = text.substring(0, wroteMatch);
  }

  // 2. Cut off at "-----Original Message-----"
  const originalMessageRegex = /\n\s*-+\s*Original Message\s*-+/i;
  const origMatch = text.search(originalMessageRegex);
  if (origMatch !== -1) {
    text = text.substring(0, origMatch);
  }

  // 3. Cut off at Outlook / Thunderbird "From: ... Sent: ... To: ..." block
  const outlookHeaderRegex = /\n\s*From:\s*.+\n\s*(?:Sent|Date):\s*.+\n\s*To:\s*.+/i;
  const outlookMatch = text.search(outlookHeaderRegex);
  if (outlookMatch !== -1) {
    text = text.substring(0, outlookMatch);
  }

  // 4. Remove trailing lines that start with ">" (quoted lines)
  const lines = text.split('\n');
  const cleanLines = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // If we hit a block of quoted lines at the bottom, we can stop or omit
    if (/^\s*>+/.test(line)) {
      continue;
    }
    cleanLines.push(line);
  }

  return cleanLines.join('\n').trim();
}

/**
 * Fallback cleaner to remove any residual raw email headers or MIME markers
 * (Received:, ARC-Seal:, DKIM, boundaries, base64 blobs) if present.
 */
export function removeResidualMimeNoise(text) {
  if (!text || typeof text !== 'string') return '';

  // If text doesn't contain obvious MIME header indicators, return as is
  if (!text.includes('Received:') && !text.includes('ARC-Seal:') && !text.includes('Content-Type:')) {
    return text.trim();
  }

  const lines = text.split('\n');
  const cleanLines = [];
  let inHeaderSection = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check if this line looks like a raw email header (e.g. Received:, ARC-Seal:, b=..., d=..., Content-Type:)
    const isHeaderLine = /^(?:Received|ARC-[A-Za-z]+|DKIM-[A-Za-z]+|Authentication-Results|X-[A-Za-z-]+|Content-[A-Za-z-]+|MIME-Version|Return-Path|Delivered-To|Message-ID|In-Reply-To|References|From|To|Subject|Date):/i.test(trimmed);
    const isBase64Blob = /^[A-Za-z0-9+/=]{40,}$/.test(trimmed) || /^(?:b|s|bh)=[A-Za-z0-9+/=;]+$/i.test(trimmed);
    const isMimeBoundary = /^--+[A-Za-z0-9_-]+(?:--)?$/.test(trimmed);

    if (inHeaderSection) {
      if (isHeaderLine || isBase64Blob || isMimeBoundary || trimmed.startsWith('for <') || trimmed.startsWith('by ') || trimmed === '') {
        continue;
      }
      // First non-header line found
      inHeaderSection = false;
      cleanLines.push(line);
    } else {
      // Once out of headers, omit subsequent boundary lines or base64 attachments
      if (!isMimeBoundary && !isBase64Blob && !isHeaderLine) {
        cleanLines.push(line);
      }
    }
  }

  return cleanLines.join('\n').trim();
}

/**
 * Parses raw input from webhooks.
 * If rawInput is a full RFC 822 MIME message (as Cloudflare message.raw provides),
 * this uses mailparser to extract clean, human-readable text, subject, and headers.
 */
export async function parseInboundEmailContent({ text, html, subject, from, to, headers }) {
  let cleanText = text || '';
  let cleanHtml = html || '';
  let cleanSubject = subject || '';
  let cleanFrom = from || '';
  let cleanTo = to || '';
  let inReplyTo = null;
  let references = [];

  // Detect if text is a raw RFC 822 MIME stream (Cloudflare sends message.raw)
  const isRawMime =
    typeof text === 'string' &&
    (text.includes('Received:') ||
      text.includes('ARC-Seal:') ||
      text.includes('MIME-Version:') ||
      text.includes('Content-Type: multipart/'));

  if (isRawMime) {
    try {
      const parsed = await simpleParser(text);
      if (parsed.text) {
        cleanText = parsed.text;
      }
      if (parsed.html) {
        cleanHtml = parsed.html;
      }
      if (parsed.subject && !cleanSubject) {
        cleanSubject = parsed.subject;
      }
      if (parsed.from?.text && !cleanFrom) {
        cleanFrom = parsed.from.text;
      }
      if (parsed.to?.text && !cleanTo) {
        cleanTo = parsed.to.text;
      }
      if (parsed.inReplyTo) {
        inReplyTo = parsed.inReplyTo;
      }
      if (parsed.references) {
        references = Array.isArray(parsed.references) ? parsed.references : [parsed.references];
      }
    } catch (err) {
      console.warn('[parseInboundEmailContent] mailparser failed, using regex fallback:', err.message);
      cleanText = removeResidualMimeNoise(cleanText);
    }
  }

  // Fallback cleanup: remove any leftover MIME noise and quoted email chain
  cleanText = removeResidualMimeNoise(cleanText);
  cleanText = stripQuotedEmailText(cleanText);

  return {
    cleanText: cleanText.trim(),
    cleanHtml,
    cleanSubject,
    cleanFrom,
    cleanTo,
    inReplyTo,
    references,
  };
}

/**
 * Attempts to extract an explicit MongoDB 24-character hexadecimal Lead ID
 * from email recipient addresses (e.g. reply+672b1234...@...), subjects, or headers.
 */
export function extractLeadIdFromEmail({ to, subject, headers = {} }) {
  const hex24Regex = /[a-f0-9]{24}/i;

  // 1. Check custom headers
  if (headers['x-lead-id'] && hex24Regex.test(headers['x-lead-id'])) {
    return headers['x-lead-id'].trim();
  }
  if (headers['X-Lead-ID'] && hex24Regex.test(headers['X-Lead-ID'])) {
    return headers['X-Lead-ID'].trim();
  }

  // 2. Check To / Recipient address for plus-addressing (e.g. reply+672b...01@gyanvaniai.com)
  if (to && typeof to === 'string') {
    const plusMatch = to.match(/reply\+([a-f0-9]{24})@/i);
    if (plusMatch && plusMatch[1]) {
      return plusMatch[1];
    }
  }

  // 3. Check Subject for explicit tag e.g. [Lead #672b...] or [Ticket #672b...]
  if (subject && typeof subject === 'string') {
    const subjectMatch = subject.match(/\[(?:Lead|Ticket)\s*#?([a-f0-9]{24})\]/i);
    if (subjectMatch && subjectMatch[1]) {
      return subjectMatch[1];
    }
  }

  return null;
}

/**
 * Lightweight XSS sanitizer for inbound HTML bodies.
 * Strips script tags, iframes, objects, forms, and event handlers.
 */
export function sanitizeInboundHtml(html) {
  if (!html || typeof html !== 'string') return '';

  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .replace(/\bon\w+\s*=\s*(?:'[^']*'|"[^"]*"|[^\s>]+)/gi, '') // on* handlers
    .replace(/javascript:/gi, 'blocked:');
}
