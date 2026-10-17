import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection.js';
import { verifyPreviewToken } from '../utils/slugify.js';
import {
  generateBlogSitemapXml,
  generateBlogRssXml,
  buildPostCompleteSchema,
} from '../services/seoEngine.service.js';

export async function getPublicPosts(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const skip = (page - 1) * limit;

    const { category, tag, search, featured, channel } = req.query;

    // Security Gate: Public visitors strictly see ONLY published posts
    const andConditions = [{ status: 'published' }];

    // Channel Isolation:
    // If channel is specified (e.g. 'portfolio'), allow that channel and shared 'all' articles.
    // If no channel is specified, default to 'crm' (GyanVani CRM website default)
    const targetChannel = channel || 'crm';
    if (targetChannel && targetChannel !== 'all') {
      andConditions.push({
        $or: [
          { channel: targetChannel },
          { channel: 'all' },
        ],
      });
    }

    if (category && category !== 'All' && category !== 'all') {
      const cleanCat = category.trim();
      const catRegex = new RegExp(`^${cleanCat.replace(/[-_]/g, '[-_\\s]')}$`, 'i');
      andConditions.push({
        $or: [
          { category: cleanCat },
          { category: { $regex: catRegex } },
          { 'category.name': cleanCat },
          { 'category.slug': cleanCat.toLowerCase() },
        ],
      });
    }

    if (tag) {
      andConditions.push({ tags: tag });
    }

    if (featured === 'true' || featured === true) {
      andConditions.push({ isFeatured: true });
    }

    if (search && search.trim()) {
      const term = search.trim();
      andConditions.push({
        $or: [
          { title: { $regex: term, $options: 'i' } },
          { excerpt: { $regex: term, $options: 'i' } },
          { tags: { $regex: term, $options: 'i' } },
        ],
      });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const db = getDb();
    const postsCol = db.collection('cms_posts');

    const [posts, total] = await Promise.all([
      postsCol
        .find(query)
        .sort({ publishedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray(),
      postsCol.countDocuments(query),
    ]);

    return res.status(200).json({
      posts: posts.map(p => ({
        id: p.slug || p._id.toString(),
        slugId: p.slug,
        slug: p.slug,
        title: p.title,
        seoTitle: p.seo?.metaTitle || p.title,
        excerpt: p.excerpt,
        category: p.category,
        channel: p.channel || 'all',
        tags: p.tags || [],
        tag: p.tags?.[0] || p.tag || p.category || '',
        author: typeof p.author === 'string' ? p.author : p.author?.name || 'Gyan VaniAi Product Team',
        date: p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Recent',
        createdAt: p.publishedAt || p.createdAt,
        status: p.status,
        published: p.status === 'published',
        isFeatured: Boolean(p.isFeatured),
        imageUrl: typeof p.featuredImage === 'string' ? p.featuredImage : (p.featuredImage?.url || p.imageUrl || '/portfolio_crm.webp'),
        coverImage: typeof p.featuredImage === 'string' ? p.featuredImage : (p.featuredImage?.url || p.imageUrl || '/portfolio_crm.webp'),
        coverImageAlt: p.featuredImage?.alt || p.title,
        pdfUrl: p.pdf?.url || p.pdfUrl || '',
        pdfName: p.pdf?.name || p.pdfName || '',
        ogImageUrl: p.seo?.ogImage || (typeof p.featuredImage === 'string' ? p.featuredImage : p.featuredImage?.url) || '/portfolio_crm.webp',
        readingTimeMinutes: p.readingTimeMinutes || p.readingTime || 1,
        readTime: `${p.readingTimeMinutes || p.readingTime || 1} min`,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error('Public Get Posts Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve public blog posts.', code: 'SERVER_ERROR' });
  }
}

export async function getPublicPostBySlug(req, res) {
  try {
    const { slugOrId } = req.params;
    const { preview, channel } = req.query;

    const db = getDb();
    const postsCol = db.collection('cms_posts');

    let post = await postsCol.findOne({ slug: slugOrId });
    if (!post && ObjectId.isValid(slugOrId)) {
      post = await postsCol.findOne({ _id: new ObjectId(slugOrId) });
    }

    if (!post) {
      return res.status(404).json({ error: 'Article not found.', code: 'NOT_FOUND' });
    }

    // Channel Security Isolation:
    // If requesting for a specific channel (e.g. portfolio), reject if article belongs to a different channel
    const targetChannel = channel || 'crm';
    if (targetChannel && targetChannel !== 'all') {
      const postChannel = post.channel || 'crm';
      if (postChannel !== 'all' && postChannel !== targetChannel) {
        return res.status(404).json({ error: 'Article not found for this channel.', code: 'NOT_FOUND' });
      }
    }

    // Security Verification: If post is NOT published, verify preview token
    if (post.status !== 'published') {
      const isAuthorizedPreview = preview && verifyPreviewToken(post._id.toString(), preview);
      if (!isAuthorizedPreview) {
        return res.status(404).json({
          error: 'Article not found or not yet published.',
          code: 'ARTICLE_NOT_PUBLISHED',
        });
      }
    }

    // Adjacent posts filtered by the same channel
    const adjacentFilter = { status: 'published' };
    if (targetChannel && targetChannel !== 'all') {
      adjacentFilter.$or = [{ channel: targetChannel }, { channel: 'all' }];
    }

    // Calculate adjacent posts (prev & next) for public reader continuity
    const [newerPost, olderPost] = await Promise.all([
      postsCol
        .find({
          ...adjacentFilter,
          publishedAt: { $gt: post.publishedAt || post.createdAt },
        })
        .sort({ publishedAt: 1 })
        .limit(1)
        .toArray(),
      postsCol
        .find({
          ...adjacentFilter,
          publishedAt: { $lt: post.publishedAt || post.createdAt },
        })
        .sort({ publishedAt: -1 })
        .limit(1)
        .toArray(),
    ]);

    return res.status(200).json({
      post: {
        id: post.slug || post._id.toString(),
        slugId: post.slug,
        slug: post.slug,
        title: post.title,
        seoTitle: post.seo?.metaTitle || post.title,
        excerpt: post.excerpt,
        content: post.content,
        category: post.category,
        channel: post.channel || 'all',
        tags: post.tags || [],
        tag: post.tags?.[0] || post.tag || post.category || '',
        author: typeof post.author === 'string' ? post.author : post.author?.name || 'Himanshu Bharti',
        date: post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : new Date(post.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        createdAt: post.publishedAt || post.createdAt,
        status: post.status,
        published: post.status === 'published',
        isFeatured: Boolean(post.isFeatured),
        imageUrl: typeof post.featuredImage === 'string' ? post.featuredImage : (post.featuredImage?.url || post.imageUrl || '/portfolio_crm.webp'),
        coverImage: typeof post.featuredImage === 'string' ? post.featuredImage : (post.featuredImage?.url || post.imageUrl || '/portfolio_crm.webp'),
        coverImageAlt: post.featuredImage?.alt || post.title,
        pdfUrl: post.pdf?.url || post.pdfUrl || '',
        pdfName: post.pdf?.name || post.pdfName || '',
        ogImageUrl: post.seo?.ogImage || (typeof post.featuredImage === 'string' ? post.featuredImage : post.featuredImage?.url) || '/portfolio_crm.webp',
        ogImage: post.seo?.ogImage || (typeof post.featuredImage === 'string' ? post.featuredImage : post.featuredImage?.url) || '/portfolio_crm.webp',
        seo: post.seo || {},
        seoDescription: post.seo?.metaDescription || post.excerpt,
        seoKeywords: Array.isArray(post.seo?.keywords) ? post.seo.keywords.join(', ') : (post.seo?.keywords || ''),
        canonicalUrl: post.seo?.canonicalUrl || '',
        aeo: post.aeo || {},
        geo: post.geo || {},
        aeoDirectQuestion: post.aeo?.directQuestion || `What is ${post.title}?`,
        aeoDirectAnswer: post.aeo?.directAnswer || post.excerpt,
        aeoKeyTakeaways: post.aeo?.keyTakeaways || [],
        schemas: buildPostCompleteSchema(post),
        readingTimeMinutes: post.readingTimeMinutes || post.readingTime || 1,
        readTime: `${post.readingTimeMinutes || post.readingTime || 1} min`,
        prevPost: olderPost[0] ? { slug: olderPost[0].slug, title: olderPost[0].title } : null,
        nextPost: newerPost[0] ? { slug: newerPost[0].slug, title: newerPost[0].title } : null,
      },
    });
  } catch (err) {
    console.error('Public Get Post By Slug Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve article.', code: 'SERVER_ERROR' });
  }
}

/**
 * Public XML Sitemap Endpoint (Dynamic MongoDB-backed)
 */
export async function getBlogSitemapXmlEndpoint(req, res) {
  try {
    const xml = await generateBlogSitemapXml();
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=7200'); // Cache for 1-2 hours
    return res.status(200).send(xml);
  } catch (err) {
    console.error('Sitemap Generation Error:', err);
    return res.status(500).send('<!-- Failed to generate sitemap -->');
  }
}

/**
 * Public RSS 2.0 Feed Endpoint (for AI engines & feed aggregators)
 */
export async function getBlogRssXmlEndpoint(req, res) {
  try {
    const rss = await generateBlogRssXml();
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=1800, s-maxage=3600');
    return res.status(200).send(rss);
  } catch (err) {
    console.error('RSS Generation Error:', err);
    return res.status(500).send('<!-- Failed to generate RSS feed -->');
  }
}

/**
 * Public Post JSON-LD Schema Endpoint
 */
export async function getPostSchemaEndpoint(req, res) {
  try {
    const { slugOrId } = req.params;
    const db = getDb();
    const postsCol = db.collection('cms_posts');

    const query = {
      status: 'published',
      $or: [{ slug: slugOrId }],
    };
    if (ObjectId.isValid(slugOrId)) {
      query.$or.push({ _id: new ObjectId(slugOrId) });
    }

    const post = await postsCol.findOne(query);
    if (!post) {
      return res.status(404).json({ error: 'Article schema not found' });
    }

    const schemas = buildPostCompleteSchema(post);
    return res.status(200).json(schemas);
  } catch (err) {
    console.error('Schema Endpoint Error:', err);
    return res.status(500).json({ error: 'Failed to generate schema' });
  }
}

export async function getPublicCategories(req, res) {
  try {
    const { channel } = req.query;
    const db = getDb();
    const postsCol = db.collection('cms_posts');

    const targetChannel = channel || 'crm';
    const match = { status: 'published' };
    if (targetChannel && targetChannel !== 'all') {
      match.$or = [{ channel: targetChannel }, { channel: 'all' }];
    }

    // Aggregate active categories from published posts
    const categoryCounts = await postsCol
      .aggregate([
        { $match: match },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    return res.status(200).json({
      categories: categoryCounts.map(c => ({
        name: c._id || 'General',
        count: c.count,
      })),
    });
  } catch (err) {
    console.error('Public Get Categories Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve categories.', code: 'SERVER_ERROR' });
  }
}

export async function getPublicTags(req, res) {
  try {
    const { channel } = req.query;
    const db = getDb();
    const postsCol = db.collection('cms_posts');

    const targetChannel = channel || 'crm';
    const filter = { status: 'published' };
    if (targetChannel && targetChannel !== 'all') {
      filter.$or = [{ channel: targetChannel }, { channel: 'all' }];
    }

    const tags = await postsCol.distinct('tags', filter);
    return res.status(200).json({ tags: tags.filter(Boolean).slice(0, 30) });
  } catch (err) {
    console.error('Public Get Tags Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve tags.', code: 'SERVER_ERROR' });
  }
}
