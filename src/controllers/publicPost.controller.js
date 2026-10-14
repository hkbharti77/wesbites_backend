import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection.js';
import { verifyPreviewToken } from '../utils/slugify.js';

export async function getPublicPosts(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 12));
    const skip = (page - 1) * limit;

    const { category, tag, search, featured } = req.query;

    // Security Gate: Public visitors strictly see ONLY published posts
    const query = { status: 'published' };

    if (category && category !== 'All' && category !== 'all') {
      query.$or = [{ category }, { 'category.name': category }];
    }

    if (tag) {
      query.tags = tag;
    }

    if (featured === 'true' || featured === true) {
      query.isFeatured = true;
    }

    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { title: { $regex: term, $options: 'i' } },
        { excerpt: { $regex: term, $options: 'i' } },
        { tags: { $regex: term, $options: 'i' } },
      ];
    }

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
        tags: p.tags || [],
        author: typeof p.author === 'string' ? p.author : p.author?.name || 'Gyan VaniAi Product Team',
        date: p.publishedAt ? new Date(p.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Recent',
        createdAt: p.publishedAt || p.createdAt,
        status: p.status,
        isFeatured: Boolean(p.isFeatured),
        imageUrl: p.featuredImage?.url || '/portfolio_crm.webp',
        ogImageUrl: p.seo?.ogImage || p.featuredImage?.url || '/portfolio_crm.webp',
        readingTimeMinutes: p.readingTimeMinutes || 1,
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
    const { preview } = req.query;

    const db = getDb();
    const postsCol = db.collection('cms_posts');

    let post = await postsCol.findOne({ slug: slugOrId });
    if (!post && ObjectId.isValid(slugOrId)) {
      post = await postsCol.findOne({ _id: new ObjectId(slugOrId) });
    }

    if (!post) {
      return res.status(404).json({ error: 'Article not found.', code: 'NOT_FOUND' });
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

    // Calculate adjacent posts (prev & next) for public reader continuity
    const [newerPost, olderPost] = await Promise.all([
      postsCol
        .find({
          status: 'published',
          publishedAt: { $gt: post.publishedAt || post.createdAt },
        })
        .sort({ publishedAt: 1 })
        .limit(1)
        .toArray(),
      postsCol
        .find({
          status: 'published',
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
        tags: post.tags || [],
        author: typeof post.author === 'string' ? post.author : post.author?.name || 'Gyan VaniAi Product Team',
        date: post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Recent',
        createdAt: post.publishedAt || post.createdAt,
        status: post.status,
        isFeatured: Boolean(post.isFeatured),
        imageUrl: post.featuredImage?.url || '/portfolio_crm.webp',
        ogImageUrl: post.seo?.ogImage || post.featuredImage?.url || '/portfolio_crm.webp',
        seo: post.seo || {},
        aeo: post.aeo || {},
        aeoDirectQuestion: post.aeo?.directQuestion || `What is ${post.title}?`,
        aeoDirectAnswer: post.aeo?.directAnswer || post.excerpt,
        aeoKeyTakeaways: post.aeo?.keyTakeaways || [],
        readingTimeMinutes: post.readingTimeMinutes || 1,
        prevPost: olderPost[0] ? { slug: olderPost[0].slug, title: olderPost[0].title } : null,
        nextPost: newerPost[0] ? { slug: newerPost[0].slug, title: newerPost[0].title } : null,
      },
    });
  } catch (err) {
    console.error('Public Get Post By Slug Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve article.', code: 'SERVER_ERROR' });
  }
}

export async function getPublicCategories(req, res) {
  try {
    const db = getDb();
    const postsCol = db.collection('cms_posts');

    // Aggregate active categories from published posts
    const categoryCounts = await postsCol
      .aggregate([
        { $match: { status: 'published' } },
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
    const db = getDb();
    const postsCol = db.collection('cms_posts');

    const tags = await postsCol.distinct('tags', { status: 'published' });
    return res.status(200).json({ tags: tags.filter(Boolean).slice(0, 30) });
  } catch (err) {
    console.error('Public Get Tags Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve tags.', code: 'SERVER_ERROR' });
  }
}
