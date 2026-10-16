import { getDb } from '../db/connection.js';

const HOST = 'www.gyanvaniai.com';
const BASE_URL = `https://${HOST}`;
const INDEXNOW_KEY = process.env.INDEXNOW_KEY || 'e58f9214b74a49c693a19b88c42ef84a';

function escapeXml(unsafe = '') {
  if (typeof unsafe !== 'string') return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate XML Sitemap (Sitemaps.org & Google Image standard)
 */
export async function generateBlogSitemapXml() {
  const db = getDb();
  const postsCol = db.collection('cms_posts');

  const publishedPosts = await postsCol
    .find({ status: 'published' })
    .sort({ publishedAt: -1, updatedAt: -1 })
    .project({ slug: 1, title: 1, updatedAt: 1, publishedAt: 1, featuredImage: 1, imageUrl: 1, seo: 1 })
    .toArray();

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n';
  xml += '        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"\n';
  xml += '        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n';

  // 1. Blog Index Root
  xml += '  <url>\n';
  xml += `    <loc>${BASE_URL}/blog</loc>\n`;
  xml += `    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n`;
  xml += '    <changefreq>daily</changefreq>\n';
  xml += '    <priority>1.0</priority>\n';
  xml += '  </url>\n';

  // 2. Individual Published Blog Posts
  for (const post of publishedPosts) {
    if (!post.slug) continue;
    const postUrl = `${BASE_URL}/blog/${encodeURIComponent(post.slug)}`;
    const lastmod = (post.updatedAt || post.publishedAt || new Date()).toISOString().split('T')[0];
    const imgUrl = (typeof post.featuredImage === 'string' ? post.featuredImage : post.featuredImage?.url) || post.imageUrl || post.seo?.ogImage;

    xml += '  <url>\n';
    xml += `    <loc>${escapeXml(postUrl)}</loc>\n`;
    xml += `    <lastmod>${lastmod}</lastmod>\n`;
    xml += '    <changefreq>weekly</changefreq>\n';
    xml += '    <priority>0.8</priority>\n';

    if (imgUrl && imgUrl.startsWith('http')) {
      xml += '    <image:image>\n';
      xml += `      <image:loc>${escapeXml(imgUrl)}</image:loc>\n`;
      xml += `      <image:title>${escapeXml(post.seo?.metaTitle || post.title || 'Blog Post')}</image:title>\n`;
      xml += '    </image:image>\n';
    }

    xml += '  </url>\n';
  }

  xml += '</urlset>';
  return xml;
}

/**
 * Generate RSS 2.0 Feed for Search Engines & AI Crawlers (PerplexityBot, GPTBot, ClaudeBot)
 */
export async function generateBlogRssXml() {
  const db = getDb();
  const postsCol = db.collection('cms_posts');

  const publishedPosts = await postsCol
    .find({ status: 'published' })
    .sort({ publishedAt: -1 })
    .limit(50)
    .toArray();

  let rss = '<?xml version="1.0" encoding="UTF-8"?>\n';
  rss += '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">\n';
  rss += '  <channel>\n';
  rss += '    <title>Gyan VaniAi | Enterprise AI, CRM & Automation Intelligence</title>\n';
  rss += `    <link>${BASE_URL}/blog</link>\n`;
  rss += '    <description>Latest insights on Enterprise AI systems, WhatsApp automation, CRM architecture, RAG pipelines, and autonomous agent orchestration.</description>\n';
  rss += '    <language>en-us</language>\n';
  rss += `    <atom:link href="${BASE_URL}/api/public/rss.xml" rel="self" type="application/rss+xml" />\n`;
  rss += `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;

  for (const post of publishedPosts) {
    if (!post.slug) continue;
    const itemUrl = `${BASE_URL}/blog/${encodeURIComponent(post.slug)}`;
    const pubDate = (post.publishedAt || post.createdAt || new Date()).toUTCString();
    const title = post.seo?.metaTitle || post.title;
    const desc = post.seo?.metaDescription || post.excerpt || '';
    const imgUrl = (typeof post.featuredImage === 'string' ? post.featuredImage : post.featuredImage?.url) || post.imageUrl;

    rss += '    <item>\n';
    rss += `      <title>${escapeXml(title)}</title>\n`;
    rss += `      <link>${escapeXml(itemUrl)}</link>\n`;
    rss += `      <guid isPermaLink="true">${escapeXml(itemUrl)}</guid>\n`;
    rss += `      <pubDate>${pubDate}</pubDate>\n`;
    rss += `      <description>${escapeXml(desc)}</description>\n`;
    if (post.category) {
      rss += `      <category>${escapeXml(post.category)}</category>\n`;
    }
    if (imgUrl && imgUrl.startsWith('http')) {
      rss += `      <enclosure url="${escapeXml(imgUrl)}" length="0" type="image/webp" />\n`;
    }
    rss += '    </item>\n';
  }

  rss += '  </channel>\n';
  rss += '</rss>';
  return rss;
}

/**
 * Server-Side IndexNow Search Engine Submission
 * Instantly alerts Bing, Yandex, Seznam, and partner engines to crawl updated URLs.
 */
export async function pingIndexNowUrls(urls = []) {
  if (!Array.isArray(urls) || urls.length === 0) return { success: false, message: 'No URLs provided' };

  const validUrls = urls.filter((u) => typeof u === 'string' && u.startsWith('http'));
  if (validUrls.length === 0) return { success: false, message: 'No valid HTTP URLs' };

  const payload = {
    host: HOST,
    key: INDEXNOW_KEY,
    keyLocation: `${BASE_URL}/${INDEXNOW_KEY}.txt`,
    urlList: validUrls,
  };

  try {
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(payload),
    });

    const isOk = response.status >= 200 && response.status < 300;
    return {
      success: isOk,
      status: response.status,
      count: validUrls.length,
      urls: validUrls,
    };
  } catch (err) {
    console.warn('[IndexNow] Notification warning (non-blocking):', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Full AEO & GEO Structured Schema Generator
 * Builds BlogPosting, QAPage, Speakable, and GEO spatial coverage for AI Overviews
 */
export function buildPostCompleteSchema(post) {
  if (!post) return null;

  const slug = post.slug || post._id?.toString() || 'article';
  const postUrl = `${BASE_URL}/blog/${slug}`;
  const title = post.seo?.metaTitle || post.title || 'Article';
  const desc = post.seo?.metaDescription || post.excerpt || '';
  const imgUrl = post.seo?.ogImage || (typeof post.featuredImage === 'string' ? post.featuredImage : post.featuredImage?.url) || post.imageUrl || `${BASE_URL}/hero_dashboard.webp`;

  const pubDate = post.publishedAt ? new Date(post.publishedAt).toISOString() : new Date().toISOString();
  const modDate = post.updatedAt ? new Date(post.updatedAt).toISOString() : pubDate;

  const authorName = typeof post.author === 'string' ? post.author : post.author?.name || 'Gyan VaniAi Product Team';
  const authorRole = post.author?.role || 'Enterprise AI Specialist';

  // 1. Article / BlogPosting Schema (E-E-A-T Compliant)
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${postUrl}#article`,
    headline: title,
    description: desc,
    url: postUrl,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': postUrl,
    },
    image: [imgUrl],
    datePublished: pubDate,
    dateModified: modDate,
    author: {
      '@type': 'Person',
      name: authorName,
      jobTitle: authorRole,
      worksFor: {
        '@type': 'Organization',
        name: 'Gyan VaniAi',
        url: BASE_URL,
      },
    },
    publisher: {
      '@type': 'Organization',
      name: 'Gyan VaniAi',
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/logo.png`,
      },
      sameAs: [
        'https://www.linkedin.com/company/gyanvaniai',
        'https://twitter.com/gyanvaniai',
      ],
    },
    keywords: Array.isArray(post.seo?.keywords) ? post.seo.keywords.join(', ') : (post.tags ? post.tags.join(', ') : ''),
    articleSection: post.category || 'Artificial Intelligence',
    inLanguage: post.geo?.language || 'en-US',
  };

  // 2. AEO QAPage / FAQ Schema for AI Search Engines (Perplexity, ChatGPT, SGE)
  const directQ = post.aeo?.directQuestion || `What is ${title} and how does it work?`;
  const directA = post.aeo?.directAnswer || post.excerpt || desc;

  const aeoSchema = {
    '@context': 'https://schema.org',
    '@type': 'QAPage',
    mainEntity: {
      '@type': 'Question',
      name: directQ,
      text: directQ,
      answerCount: 1,
      acceptedAnswer: {
        '@type': 'Answer',
        text: directA,
        dateCreated: pubDate,
        url: `${postUrl}#direct-answer`,
        upvoteCount: 42,
        author: {
          '@type': 'Organization',
          name: 'Gyan VaniAi Enterprise Intelligence',
        },
      },
    },
  };

  // 3. Speakable Specification Schema (Voice Search / Google Assistant)
  const speakableSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    speakable: {
      '@type': 'SpeakableSpecification',
      cssSelector: ['h1', '.blog-post-content p:first-of-type', '.aeo-direct-answer', '.key-takeaways'],
    },
  };

  // 4. GEO Geographic & Localized Targeting
  if (post.geo?.targetCountry || post.geo?.targetCity) {
    articleSchema.contentLocation = {
      '@type': 'Place',
      name: post.geo.targetCity ? `${post.geo.targetCity}, ${post.geo.targetCountry}` : post.geo.targetCountry,
      address: {
        '@type': 'PostalAddress',
        addressCountry: post.geo.targetCountry,
        addressLocality: post.geo.targetCity || undefined,
      },
    };
    if (post.geo.latitude && post.geo.longitude) {
      articleSchema.contentLocation.geo = {
        '@type': 'GeoCoordinates',
        latitude: post.geo.latitude,
        longitude: post.geo.longitude,
      };
    }
  }

  return {
    articleSchema,
    aeoSchema,
    speakableSchema,
  };
}
