import { Router } from 'express';
import {
  getPublicPosts,
  getPublicPostBySlug,
  getPublicCategories,
  getPublicTags,
  getBlogSitemapXmlEndpoint,
  getBlogRssXmlEndpoint,
  getPostSchemaEndpoint,
} from '../controllers/publicPost.controller.js';

const router = Router();

// Public routes require zero session authentication
router.get('/', getPublicPosts);
router.get('/sitemap.xml', getBlogSitemapXmlEndpoint);
router.get('/rss.xml', getBlogRssXmlEndpoint);
router.get('/categories', getPublicCategories);
router.get('/tags', getPublicTags);
router.get('/:slugOrId/schema', getPostSchemaEndpoint);
router.get('/:slugOrId', getPublicPostBySlug);

export default router;
