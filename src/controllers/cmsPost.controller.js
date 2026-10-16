import { ObjectId } from 'mongodb';
import { getDb } from '../db/connection.js';
import { logAuditEvent } from '../services/audit.service.js';
import { slugify, calculateReadingTime, generatePreviewToken } from '../utils/slugify.js';
import { pingIndexNowUrls } from '../services/seoEngine.service.js';

// Helper: Ensure unique slug
async function generateUniqueSlug(postsCol, baseText, excludeId = null) {
  let initialSlug = slugify(baseText);
  if (!initialSlug) initialSlug = 'article-' + Date.now();

  let candidate = initialSlug;
  let counter = 1;

  while (true) {
    const query = { slug: candidate };
    if (excludeId) {
      query._id = { $ne: new ObjectId(excludeId) };
    }
    const existing = await postsCol.findOne(query);
    if (!existing) {
      return candidate;
    }
    counter++;
    candidate = `${initialSlug}-${counter}`;
  }
}

export async function getPosts(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const { status, category, search, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

    const query = {};
    if (status && status !== 'all') {
      query.status = status;
    }
    if (category && category !== 'all') {
      query.category = category;
    }
    if (search && search.trim()) {
      const term = search.trim();
      query.$or = [
        { title: { $regex: term, $options: 'i' } },
        { excerpt: { $regex: term, $options: 'i' } },
        { slug: { $regex: term, $options: 'i' } },
        { tags: { $regex: term, $options: 'i' } },
      ];
    }

    const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

    const db = getDb();
    const postsCol = db.collection('cms_posts');

    const [posts, total, draftCount, reviewCount, publishedCount, archivedCount] = await Promise.all([
      postsCol.find(query).sort(sort).skip(skip).limit(limit).toArray(),
      postsCol.countDocuments(query),
      postsCol.countDocuments({ status: 'draft' }),
      postsCol.countDocuments({ status: 'review' }),
      postsCol.countDocuments({ status: 'published' }),
      postsCol.countDocuments({ status: 'archived' }),
    ]);

    return res.status(200).json({
      posts: posts.map(p => ({
        id: p._id.toString(),
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        category: p.category,
        tags: p.tags || [],
        author: p.author || { name: 'Admin Team' },
        status: p.status,
        isFeatured: Boolean(p.isFeatured),
        featuredImage: p.featuredImage || null,
        imageUrl: typeof p.featuredImage === 'string' ? p.featuredImage : (p.featuredImage?.url || p.imageUrl || '/portfolio_crm.webp'),
        readingTimeMinutes: p.readingTimeMinutes || 1,
        version: p.version || 1,
        publishedAt: p.publishedAt || null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      counts: {
        total: draftCount + reviewCount + publishedCount + archivedCount,
        draft: draftCount,
        review: reviewCount,
        published: publishedCount,
        archived: archivedCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err) {
    console.error('Get Posts Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve posts.', code: 'SERVER_ERROR' });
  }
}

export async function getPostById(req, res) {
  try {
    const { id } = req.params;
    const db = getDb();
    const postsCol = db.collection('cms_posts');

    let post = null;
    if (ObjectId.isValid(id)) {
      post = await postsCol.findOne({ _id: new ObjectId(id) });
    }
    if (!post) {
      post = await postsCol.findOne({ slug: id });
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found.', code: 'NOT_FOUND' });
    }

    return res.status(200).json({
      post: {
        id: post._id.toString(),
        slug: post.slug,
        title: post.title,
        excerpt: post.excerpt,
        content: post.content,
        category: post.category,
        categoryId: post.categoryId ? post.categoryId.toString() : null,
        tags: post.tags || [],
        author: post.author,
        status: post.status,
        isFeatured: Boolean(post.isFeatured),
        featuredImage: post.featuredImage || null,
        imageUrl: typeof post.featuredImage === 'string' ? post.featuredImage : (post.featuredImage?.url || post.imageUrl || '/portfolio_crm.webp'),
        seo: post.seo || {},
        aeo: post.aeo || {},
        editorialReview: post.editorialReview || {},
        readingTimeMinutes: post.readingTimeMinutes || 1,
        version: post.version || 1,
        publishedAt: post.publishedAt || null,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
        createdBy: post.createdBy,
        updatedBy: post.updatedBy,
      },
    });
  } catch (err) {
    console.error('Get Post By ID Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve post.', code: 'SERVER_ERROR' });
  }
}

export async function createPost(req, res) {
  try {
    const {
      title,
      slug,
      excerpt,
      content,
      category = 'Uncategorized',
      categoryId = null,
      tags = [],
      author = null,
      status = 'draft',
      isFeatured = false,
      featuredImage = null,
      seo = {},
      aeo = {},
      geo = {},
      editorialReview = {},
      changeSummary = 'Initial creation',
    } = req.body || {};

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      return res.status(400).json({
        error: 'Title is required (minimum 3 characters).',
        code: 'VALIDATION_ERROR',
      });
    }

    if (!excerpt || typeof excerpt !== 'string' || excerpt.trim().length < 10) {
      return res.status(400).json({
        error: 'Excerpt is required (minimum 10 characters).',
        code: 'VALIDATION_ERROR',
      });
    }

    if (!content || typeof content !== 'string') {
      return res.status(400).json({
        error: 'Article content is required.',
        code: 'VALIDATION_ERROR',
      });
    }

    const validStatuses = ['draft', 'review', 'published', 'archived'];
    const postStatus = validStatuses.includes(status) ? status : 'draft';

    // RBAC: Only users with posts.publish can directly set status to 'published'
    if (postStatus === 'published' && !req.user.isSuperAdmin && !req.user.permissions.includes('posts.publish')) {
      return res.status(403).json({
        error: 'You do not have permission to publish posts directly. Save as draft or review instead.',
        code: 'FORBIDDEN',
      });
    }

    const db = getDb();
    const postsCol = db.collection('cms_posts');
    const revisionsCol = db.collection('cms_revisions');

    const finalSlug = await generateUniqueSlug(postsCol, slug || title);
    const readingTime = calculateReadingTime(content);

    const authorDoc = author || {
      id: new ObjectId(req.user.id),
      name: req.user.name,
      email: req.user.email,
      role: req.user.roleNames?.[0] || 'Author',
    };

    const newPost = {
      slug: finalSlug,
      title: title.trim(),
      excerpt: excerpt.trim(),
      content: content.trim(),
      category: category.trim(),
      categoryId: categoryId && ObjectId.isValid(categoryId) ? new ObjectId(categoryId) : null,
      tags: Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) : [],
      author: authorDoc,
      status: postStatus,
      isFeatured: Boolean(isFeatured),
      featuredImage: featuredImage || null,
      seo: {
        metaTitle: seo.metaTitle || title.trim(),
        metaDescription: seo.metaDescription || excerpt.trim().slice(0, 160),
        canonicalUrl: seo.canonicalUrl || `https://www.gyanvaniai.com/blog/${finalSlug}`,
        ogImage: seo.ogImage || featuredImage?.url || '/portfolio_crm.webp',
        twitterCard: seo.twitterCard || 'summary_large_image',
        keywords: Array.isArray(seo.keywords) ? seo.keywords : [],
      },
      aeo: {
        directQuestion: aeo.directQuestion || '',
        directAnswer: aeo.directAnswer || '',
        keyTakeaways: Array.isArray(aeo.keyTakeaways)
          ? aeo.keyTakeaways
          : (typeof aeo.keyTakeaways === 'string'
              ? aeo.keyTakeaways.split(',').map(s => s.trim()).filter(Boolean)
              : []),
      },
      geo: {
        targetCountry: geo.targetCountry || 'Global',
        targetCity: geo.targetCity || '',
        language: geo.language || 'en-US',
        latitude: geo.latitude || null,
        longitude: geo.longitude || null,
      },
      editorialReview: {
        status: editorialReview.status || 'none',
        notes: editorialReview.notes || '',
        reviewedBy: editorialReview.reviewedBy || null,
        reviewedAt: editorialReview.reviewedAt || null,
      },
      readingTimeMinutes: readingTime,
      version: 1,
      publishedAt: postStatus === 'published' ? new Date() : null,
      createdBy: {
        id: new ObjectId(req.user.id),
        name: req.user.name,
        email: req.user.email,
      },
      updatedBy: {
        id: new ObjectId(req.user.id),
        name: req.user.name,
        email: req.user.email,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const postResult = await postsCol.insertOne(newPost);
    const postId = postResult.insertedId;

    // Create v1 revision snapshot
    const initialRevision = {
      postId,
      version: 1,
      snapshot: { ...newPost, _id: postId },
      changeSummary: changeSummary.trim(),
      author: {
        id: new ObjectId(req.user.id),
        name: req.user.name,
        email: req.user.email,
      },
      createdAt: new Date(),
    };
    await revisionsCol.insertOne(initialRevision);

    await logAuditEvent({
      req,
      action: 'CMS_POST_CREATED',
      targetType: 'POST',
      targetId: postId.toString(),
      targetName: newPost.title,
      metadata: { slug: newPost.slug, status: newPost.status, version: 1 },
    });

    return res.status(201).json({
      message: 'Post created successfully.',
      post: { id: postId.toString(), ...newPost },
    });
  } catch (err) {
    console.error('Create Post Error:', err);
    return res.status(500).json({ error: 'Failed to create post.', code: 'SERVER_ERROR' });
  }
}

export async function updatePost(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid post ID.', code: 'INVALID_ID' });
    }

    const {
      title,
      slug,
      excerpt,
      content,
      category,
      categoryId,
      tags,
      author,
      status,
      isFeatured,
      featuredImage,
      seo,
      aeo,
      geo,
      editorialReview,
      changeSummary = 'Updated article details',
    } = req.body || {};

    const db = getDb();
    const postsCol = db.collection('cms_posts');
    const revisionsCol = db.collection('cms_revisions');

    const existingPost = await postsCol.findOne({ _id: new ObjectId(id) });
    if (!existingPost) {
      return res.status(404).json({ error: 'Post not found.', code: 'NOT_FOUND' });
    }

    // RBAC: Status change check
    if (status && status !== existingPost.status) {
      if (status === 'published' && !req.user.isSuperAdmin && !req.user.permissions.includes('posts.publish')) {
        return res.status(403).json({
          error: 'You do not have permission to publish posts.',
          code: 'FORBIDDEN',
        });
      }
    }

    const nextVersion = (existingPost.version || 1) + 1;
    let finalSlug = existingPost.slug;

    if (slug && slug !== existingPost.slug) {
      finalSlug = await generateUniqueSlug(postsCol, slug, id);
    } else if (title && !existingPost.slug) {
      finalSlug = await generateUniqueSlug(postsCol, title, id);
    }

    const readingTime = content ? calculateReadingTime(content) : existingPost.readingTimeMinutes;

    const updateDoc = {
      slug: finalSlug,
      title: title ? title.trim() : existingPost.title,
      excerpt: excerpt !== undefined ? excerpt.trim() : existingPost.excerpt,
      content: content !== undefined ? content.trim() : existingPost.content,
      category: category !== undefined ? category.trim() : existingPost.category,
      categoryId: categoryId !== undefined && ObjectId.isValid(categoryId) ? new ObjectId(categoryId) : existingPost.categoryId,
      tags: Array.isArray(tags) ? tags.map(t => t.trim()).filter(Boolean) : existingPost.tags,
      author: author !== undefined ? author : existingPost.author,
      status: status !== undefined ? status : existingPost.status,
      isFeatured: isFeatured !== undefined ? Boolean(isFeatured) : existingPost.isFeatured,
      featuredImage: featuredImage !== undefined ? featuredImage : existingPost.featuredImage,
      imageUrl: (typeof featuredImage === 'string' ? featuredImage : featuredImage?.url) || (typeof existingPost.featuredImage === 'string' ? existingPost.featuredImage : existingPost.featuredImage?.url) || existingPost.imageUrl,
      seo: seo !== undefined ? seo : existingPost.seo,
      aeo: aeo !== undefined ? {
        directQuestion: aeo.directQuestion !== undefined ? aeo.directQuestion : (existingPost.aeo?.directQuestion || ''),
        directAnswer: aeo.directAnswer !== undefined ? aeo.directAnswer : (existingPost.aeo?.directAnswer || ''),
        keyTakeaways: Array.isArray(aeo.keyTakeaways)
          ? aeo.keyTakeaways
          : (typeof aeo.keyTakeaways === 'string'
              ? aeo.keyTakeaways.split(',').map(s => s.trim()).filter(Boolean)
              : (existingPost.aeo?.keyTakeaways || [])),
      } : (existingPost.aeo || {}),
      geo: geo !== undefined ? {
        targetCountry: geo.targetCountry || existingPost.geo?.targetCountry || 'Global',
        targetCity: geo.targetCity !== undefined ? geo.targetCity : (existingPost.geo?.targetCity || ''),
        language: geo.language || existingPost.geo?.language || 'en-US',
        latitude: geo.latitude !== undefined ? geo.latitude : (existingPost.geo?.latitude || null),
        longitude: geo.longitude !== undefined ? geo.longitude : (existingPost.geo?.longitude || null),
      } : (existingPost.geo || {}),
      editorialReview: editorialReview !== undefined ? {
        status: editorialReview.status || existingPost.editorialReview?.status || 'none',
        notes: editorialReview.notes !== undefined ? editorialReview.notes : (existingPost.editorialReview?.notes || ''),
        reviewedBy: editorialReview.reviewedBy !== undefined ? editorialReview.reviewedBy : (existingPost.editorialReview?.reviewedBy || null),
        reviewedAt: editorialReview.reviewedAt !== undefined ? editorialReview.reviewedAt : (existingPost.editorialReview?.reviewedAt || null),
      } : (existingPost.editorialReview || {}),
      readingTimeMinutes: readingTime,
      version: nextVersion,
      updatedBy: {
        id: new ObjectId(req.user.id),
        name: req.user.name,
        email: req.user.email,
      },
      updatedAt: new Date(),
    };

    if (updateDoc.status === 'published' && !existingPost.publishedAt) {
      updateDoc.publishedAt = new Date();
    }

    await postsCol.updateOne({ _id: new ObjectId(id) }, { $set: updateDoc });

    // Server-side IndexNow notification on published articles
    if (updateDoc.status === 'published' && finalSlug) {
      pingIndexNowUrls([
        `https://www.gyanvaniai.com/blog/${finalSlug}`,
        'https://www.gyanvaniai.com/blog',
        'https://www.gyanvaniai.com/rss.xml',
      ]).catch(() => {});
    }

    // Create new revision snapshot
    const revisionRecord = {
      postId: new ObjectId(id),
      version: nextVersion,
      snapshot: { ...existingPost, ...updateDoc },
      changeSummary: changeSummary.trim(),
      author: {
        id: new ObjectId(req.user.id),
        name: req.user.name,
        email: req.user.email,
      },
      createdAt: new Date(),
    };
    await revisionsCol.insertOne(revisionRecord);

    await logAuditEvent({
      req,
      action: 'CMS_POST_UPDATED',
      targetType: 'POST',
      targetId: id,
      targetName: updateDoc.title,
      metadata: { version: nextVersion, changeSummary },
    });

    return res.status(200).json({
      message: 'Post updated successfully.',
      post: { id, ...existingPost, ...updateDoc },
    });
  } catch (err) {
    console.error('Update Post Error:', err);
    return res.status(500).json({ error: 'Failed to update post.', code: 'SERVER_ERROR' });
  }
}

export async function publishPost(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid post ID.', code: 'INVALID_ID' });
    }

    const db = getDb();
    const postsCol = db.collection('cms_posts');
    const revisionsCol = db.collection('cms_revisions');

    const post = await postsCol.findOne({ _id: new ObjectId(id) });
    if (!post) {
      return res.status(404).json({ error: 'Post not found.', code: 'NOT_FOUND' });
    }

    const nextVersion = (post.version || 1) + 1;
    const now = new Date();

    await postsCol.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'published',
          publishedAt: now,
          version: nextVersion,
          updatedAt: now,
          updatedBy: {
            id: new ObjectId(req.user.id),
            name: req.user.name,
            email: req.user.email,
          },
        },
      }
    );

    await revisionsCol.insertOne({
      postId: new ObjectId(id),
      version: nextVersion,
      snapshot: { ...post, status: 'published', publishedAt: now, version: nextVersion },
      changeSummary: 'Published to live website',
      author: {
        id: new ObjectId(req.user.id),
        name: req.user.name,
        email: req.user.email,
      },
      createdAt: now,
    });

    await logAuditEvent({
      req,
      action: 'CMS_POST_PUBLISHED',
      targetType: 'POST',
      targetId: id,
      targetName: post.title,
      metadata: { slug: post.slug, version: nextVersion },
    });

    // Server-side IndexNow ping to Bing, Yandex, Seznam
    if (post.slug) {
      pingIndexNowUrls([
        `https://www.gyanvaniai.com/blog/${post.slug}`,
        'https://www.gyanvaniai.com/blog',
        'https://www.gyanvaniai.com/rss.xml',
      ]).catch(() => {});
    }

    return res.status(200).json({
      message: 'Post published successfully to the live website.',
      status: 'published',
      publishedAt: now,
      version: nextVersion,
    });
  } catch (err) {
    console.error('Publish Post Error:', err);
    return res.status(500).json({ error: 'Failed to publish post.', code: 'SERVER_ERROR' });
  }
}

/**
 * Manual IndexNow Ping for an Article
 */
export async function pingPostIndexNow(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid post ID.', code: 'INVALID_ID' });
    }

    const db = getDb();
    const postsCol = db.collection('cms_posts');
    const post = await postsCol.findOne({ _id: new ObjectId(id) });
    if (!post) {
      return res.status(404).json({ error: 'Post not found.', code: 'NOT_FOUND' });
    }

    const slug = post.slug || '';
    const urls = [
      `https://www.gyanvaniai.com/blog/${slug}`,
      'https://www.gyanvaniai.com/blog',
      'https://www.gyanvaniai.com/rss.xml',
    ];

    const pingResult = await pingIndexNowUrls(urls);
    return res.status(200).json({
      message: 'IndexNow search engines (Bing, Yandex, Seznam) notified successfully!',
      result: pingResult,
    });
  } catch (err) {
    console.error('Manual IndexNow Ping Error:', err);
    return res.status(500).json({ error: 'Failed to send IndexNow ping.', code: 'SERVER_ERROR' });
  }
}

export async function unpublishPost(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid post ID.', code: 'INVALID_ID' });
    }

    const db = getDb();
    const postsCol = db.collection('cms_posts');
    const revisionsCol = db.collection('cms_revisions');

    const post = await postsCol.findOne({ _id: new ObjectId(id) });
    if (!post) {
      return res.status(404).json({ error: 'Post not found.', code: 'NOT_FOUND' });
    }

    const nextVersion = (post.version || 1) + 1;
    const now = new Date();

    await postsCol.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: 'draft',
          version: nextVersion,
          updatedAt: now,
          updatedBy: {
            id: new ObjectId(req.user.id),
            name: req.user.name,
            email: req.user.email,
          },
        },
      }
    );

    await revisionsCol.insertOne({
      postId: new ObjectId(id),
      version: nextVersion,
      snapshot: { ...post, status: 'draft', version: nextVersion },
      changeSummary: 'Unpublished back to draft',
      author: {
        id: new ObjectId(req.user.id),
        name: req.user.name,
        email: req.user.email,
      },
      createdAt: now,
    });

    await logAuditEvent({
      req,
      action: 'CMS_POST_UNPUBLISHED',
      targetType: 'POST',
      targetId: id,
      targetName: post.title,
      metadata: { slug: post.slug, version: nextVersion },
    });

    return res.status(200).json({
      message: 'Post unpublished successfully. Content is no longer accessible to public visitors.',
      status: 'draft',
      version: nextVersion,
    });
  } catch (err) {
    console.error('Unpublish Post Error:', err);
    return res.status(500).json({ error: 'Failed to unpublish post.', code: 'SERVER_ERROR' });
  }
}

export async function deletePost(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid post ID.', code: 'INVALID_ID' });
    }

    const db = getDb();
    const postsCol = db.collection('cms_posts');
    const revisionsCol = db.collection('cms_revisions');

    const post = await postsCol.findOne({ _id: new ObjectId(id) });
    if (!post) {
      return res.status(404).json({ error: 'Post not found.', code: 'NOT_FOUND' });
    }

    // Delete post and its revisions
    await Promise.all([
      postsCol.deleteOne({ _id: new ObjectId(id) }),
      revisionsCol.deleteMany({ postId: new ObjectId(id) }),
    ]);

    await logAuditEvent({
      req,
      action: 'CMS_POST_DELETED',
      targetType: 'POST',
      targetId: id,
      targetName: post.title,
      metadata: { slug: post.slug },
    });

    return res.status(200).json({ message: 'Post and associated revision history deleted successfully.' });
  } catch (err) {
    console.error('Delete Post Error:', err);
    return res.status(500).json({ error: 'Failed to delete post.', code: 'SERVER_ERROR' });
  }
}

export async function getRevisions(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid post ID.', code: 'INVALID_ID' });
    }

    const db = getDb();
    const revisionsCol = db.collection('cms_revisions');

    const revisions = await revisionsCol
      .find({ postId: new ObjectId(id) })
      .sort({ version: -1 })
      .toArray();

    return res.status(200).json({
      revisions: revisions.map(r => ({
        id: r._id.toString(),
        version: r.version,
        changeSummary: r.changeSummary || `Version ${r.version}`,
        author: r.author,
        title: r.snapshot?.title,
        status: r.snapshot?.status,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error('Get Revisions Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve revision history.', code: 'SERVER_ERROR' });
  }
}

export async function rollbackRevision(req, res) {
  try {
    const { id, version } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid post ID.', code: 'INVALID_ID' });
    }

    const targetVersion = parseInt(version, 10);
    if (isNaN(targetVersion)) {
      return res.status(400).json({ error: 'Invalid revision version.', code: 'INVALID_VERSION' });
    }

    const db = getDb();
    const postsCol = db.collection('cms_posts');
    const revisionsCol = db.collection('cms_revisions');

    const [post, targetRevision] = await Promise.all([
      postsCol.findOne({ _id: new ObjectId(id) }),
      revisionsCol.findOne({ postId: new ObjectId(id), version: targetVersion }),
    ]);

    if (!post) {
      return res.status(404).json({ error: 'Post not found.', code: 'NOT_FOUND' });
    }

    if (!targetRevision || !targetRevision.snapshot) {
      return res.status(404).json({ error: `Revision v${targetVersion} not found.`, code: 'REVISION_NOT_FOUND' });
    }

    const nextVersion = (post.version || 1) + 1;
    const snap = targetRevision.snapshot;
    const now = new Date();

    const restoredDoc = {
      title: snap.title,
      slug: snap.slug || post.slug,
      excerpt: snap.excerpt,
      content: snap.content,
      category: snap.category,
      categoryId: snap.categoryId ? new ObjectId(snap.categoryId) : null,
      tags: snap.tags || [],
      author: snap.author || post.author,
      status: snap.status || 'draft',
      isFeatured: Boolean(snap.isFeatured),
      featuredImage: snap.featuredImage || null,
      seo: snap.seo || post.seo,
      readingTimeMinutes: snap.readingTimeMinutes || calculateReadingTime(snap.content),
      version: nextVersion,
      updatedAt: now,
      updatedBy: {
        id: new ObjectId(req.user.id),
        name: req.user.name,
        email: req.user.email,
      },
    };

    await postsCol.updateOne({ _id: new ObjectId(id) }, { $set: restoredDoc });

    // Record the rollback as a new revision
    await revisionsCol.insertOne({
      postId: new ObjectId(id),
      version: nextVersion,
      snapshot: { ...restoredDoc, _id: new ObjectId(id) },
      changeSummary: `Rollback to revision v${targetVersion}`,
      author: {
        id: new ObjectId(req.user.id),
        name: req.user.name,
        email: req.user.email,
      },
      createdAt: now,
    });

    await logAuditEvent({
      req,
      action: 'CMS_POST_ROLLED_BACK',
      targetType: 'POST',
      targetId: id,
      targetName: restoredDoc.title,
      metadata: { restoredFromVersion: targetVersion, newVersion: nextVersion },
    });

    return res.status(200).json({
      message: `Successfully rolled back post to version ${targetVersion}.`,
      post: { id, ...restoredDoc },
    });
  } catch (err) {
    console.error('Rollback Revision Error:', err);
    return res.status(500).json({ error: 'Failed to rollback revision.', code: 'SERVER_ERROR' });
  }
}

export async function getAnalytics(req, res) {
  try {
    const db = getDb();
    const postsCol = db.collection('cms_posts');
    const revisionsCol = db.collection('cms_revisions');

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const [
      totalDraft,
      totalReview,
      totalPublished,
      totalArchived,
      publishedLast30,
      publishedLast7,
      createdLast30,
      totalRevisions,
      featuredCount,
      categoryAgg,
      readingTimeAgg,
      authorAgg,
      publishedByDay,
      recentPosts,
      recentRevisions,
    ] = await Promise.all([
      postsCol.countDocuments({ status: 'draft' }),
      postsCol.countDocuments({ status: 'review' }),
      postsCol.countDocuments({ status: 'published' }),
      postsCol.countDocuments({ status: 'archived' }),
      postsCol.countDocuments({ status: 'published', publishedAt: { $gte: thirtyDaysAgo } }),
      postsCol.countDocuments({ status: 'published', publishedAt: { $gte: sevenDaysAgo } }),
      postsCol.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      revisionsCol.countDocuments({}),
      postsCol.countDocuments({ isFeatured: true }),

      // Category breakdown (published only)
      postsCol.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 }, published: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]).toArray(),

      // Reading time distribution
      postsCol.aggregate([
        { $group: { _id: {
          $switch: {
            branches: [
              { case: { $lte: ['$readingTimeMinutes', 2] }, then: '0–2 min' },
              { case: { $lte: ['$readingTimeMinutes', 5] }, then: '3–5 min' },
              { case: { $lte: ['$readingTimeMinutes', 10] }, then: '6–10 min' },
              { case: { $lte: ['$readingTimeMinutes', 20] }, then: '11–20 min' },
            ],
            default: '20+ min',
          },
        }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]).toArray(),

      // Top authors
      postsCol.aggregate([
        { $group: { _id: '$author.name', count: { $sum: 1 }, published: { $sum: { $cond: [{ $eq: ['$status', 'published'] }, 1, 0] } } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]).toArray(),

      // Published articles by day (last 30 days)
      postsCol.aggregate([
        { $match: { publishedAt: { $gte: thirtyDaysAgo }, status: 'published' } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$publishedAt' } },
          count: { $sum: 1 },
        }},
        { $sort: { _id: 1 } },
      ]).toArray(),

      // 5 most recently published posts
      postsCol.find({ status: 'published' })
        .sort({ publishedAt: -1 })
        .limit(5)
        .project({ title: 1, slug: 1, category: 1, readingTimeMinutes: 1, publishedAt: 1, author: 1, isFeatured: 1 })
        .toArray(),

      // Recent revision activity (last 7 days)
      revisionsCol.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: '$author.name', edits: { $sum: 1 } } },
        { $sort: { edits: -1 } },
        { $limit: 6 },
      ]).toArray(),
    ]);

    const total = totalDraft + totalReview + totalPublished + totalArchived;
    const publishRate = total > 0 ? Math.round((totalPublished / total) * 100) : 0;

    return res.status(200).json({
      overview: {
        total,
        draft: totalDraft,
        review: totalReview,
        published: totalPublished,
        archived: totalArchived,
        featured: featuredCount,
        publishRate,
        publishedLast30,
        publishedLast7,
        createdLast30,
        totalRevisions,
      },
      categories: categoryAgg.map(c => ({
        name: c._id || 'Uncategorized',
        total: c.count,
        published: c.published,
      })),
      readingTimeDistribution: readingTimeAgg.map(r => ({
        range: r._id,
        count: r.count,
      })),
      topAuthors: authorAgg.map(a => ({
        name: a._id || 'Unknown',
        total: a.count,
        published: a.published,
      })),
      publishingVelocity: publishedByDay.map(d => ({
        date: d._id,
        count: d.count,
      })),
      recentlyPublished: recentPosts.map(p => ({
        id: p._id.toString(),
        title: p.title,
        slug: p.slug,
        category: p.category,
        readingTimeMinutes: p.readingTimeMinutes || 1,
        publishedAt: p.publishedAt,
        authorName: p.author?.name || 'Admin',
        isFeatured: Boolean(p.isFeatured),
      })),
      recentEditors: recentRevisions.map(r => ({
        name: r._id || 'Unknown',
        edits: r.edits,
      })),
    });
  } catch (err) {
    console.error('Get Analytics Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve analytics data.', code: 'SERVER_ERROR' });
  }
}

export async function getPreviewToken(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid post ID.', code: 'INVALID_ID' });
    }

    const db = getDb();
    const postsCol = db.collection('cms_posts');
    const post = await postsCol.findOne({ _id: new ObjectId(id) });

    if (!post) {
      return res.status(404).json({ error: 'Post not found.', code: 'NOT_FOUND' });
    }

    const token = generatePreviewToken(id);

    return res.status(200).json({
      previewToken: token,
      previewUrl: `http://localhost:5173/blog/${post.slug}?preview=${token}`,
      expiresIn: '2 hours',
    });
  } catch (err) {
    console.error('Get Preview Token Error:', err);
    return res.status(500).json({ error: 'Failed to generate preview token.', code: 'SERVER_ERROR' });
  }
}
