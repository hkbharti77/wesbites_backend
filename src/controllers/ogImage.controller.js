/**
 * Dynamic OpenGraph (OG) Image Generator
 * Generates standards-compliant 1200x630 vector SVG social share cards dynamically.
 * Zero external heavy canvas/puppeteer binary required.
 */

export function generateOgImage(req, res) {
  const {
    title = 'Gyan VaniAi Enterprise Autonomous CRM & AI Platform',
    category = 'Enterprise AI',
    channel = 'crm',
    readTime = '5 min read',
  } = req.query;

  const isPortfolio = channel === 'portfolio';

  // Theme palettes
  const bgGradientStart = isPortfolio ? '#0d0e0b' : '#070d1d';
  const bgGradientEnd = isPortfolio ? '#191b15' : '#0c1a30';
  const accentColor = isPortfolio ? '#c9a96e' : '#10b981';
  const accentLight = isPortfolio ? '#8a8f70' : '#06b6d4';
  const brandName = isPortfolio ? 'HIMANSHU BHARTI' : 'GYAN VANI AI';
  const brandSub = isPortfolio ? 'SYSTEMS & AI ENGINEER' : 'ENTERPRISE AI ARCHITECTURE';

  // Sanitize title for XML SVG embedding
  const escapeXml = (unsafe) => {
    return String(unsafe || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  const safeTitle = escapeXml(title);
  const safeCategory = escapeXml(category.toUpperCase());
  const safeReadTime = escapeXml(readTime);

  // Split title into two lines if long
  const words = safeTitle.split(' ');
  let line1 = words.slice(0, 7).join(' ');
  let line2 = words.slice(7, 15).join(' ');
  if (words.length > 15) {
    line2 += '...';
  }

  const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${bgGradientStart}"/>
      <stop offset="100%" stop-color="${bgGradientEnd}"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${accentColor}"/>
      <stop offset="100%" stop-color="${accentLight}"/>
    </linearGradient>
    <radialGradient id="glow" cx="80%" cy="20%" r="60%">
      <stop offset="0%" stop-color="${accentColor}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${accentColor}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Background Base -->
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <!-- Border Frame -->
  <rect x="24" y="24" width="1152" height="582" rx="16" fill="none" stroke="${accentColor}" stroke-opacity="0.3" stroke-width="2"/>

  <!-- Top Brand Banner -->
  <g transform="translate(80, 90)">
    <rect x="0" y="0" width="12" height="12" rx="3" fill="${accentColor}"/>
    <text x="24" y="11" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" font-weight="700" letter-spacing="3" fill="${accentColor}">
      ${brandName}
    </text>
    <text x="24" y="28" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" letter-spacing="2" fill="#8892b0">
      ${brandSub}
    </text>
  </g>

  <!-- Category & Read Time Pills -->
  <g transform="translate(80, 180)">
    <rect x="0" y="0" width="180" height="34" rx="6" fill="${accentColor}" fill-opacity="0.15" stroke="${accentColor}" stroke-opacity="0.4" stroke-width="1"/>
    <text x="18" y="22" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" letter-spacing="1.5" fill="${accentColor}">
      ${safeCategory}
    </text>
    <circle cx="210" cy="17" r="3" fill="#64748b"/>
    <text x="230" y="22" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" fill="#94a3b8">
      ${safeReadTime}
    </text>
  </g>

  <!-- Headline Title -->
  <g transform="translate(80, 290)">
    <text x="0" y="0" font-family="Georgia, serif" font-size="52" font-weight="700" fill="#f8fafc" letter-spacing="-0.5">
      ${line1}
    </text>
    ${line2 ? `<text x="0" y="68" font-family="Georgia, serif" font-size="52" font-weight="700" fill="#f8fafc" letter-spacing="-0.5">${line2}</text>` : ''}
  </g>

  <!-- Bottom Details Bar -->
  <g transform="translate(80, 520)">
    <line x1="0" y1="0" x2="1040" y2="0" stroke="#334155" stroke-width="1"/>
    <text x="0" y="32" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="14" fill="#64748b">
      ${isPortfolio ? 'hkbharti77.website' : 'www.gyanvaniai.com'} · Verified Research Monograph
    </text>
    <text x="1040" y="32" text-anchor="end" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="${accentColor}">
      READ TECHNICAL DOSSIER →
    </text>
  </g>
</svg>
`.trim();

  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  return res.status(200).send(svg);
}

