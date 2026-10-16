import { Router } from 'express';
import {
  getPosts,
  getPostById,
  createPost,
  updatePost,
  publishPost,
  unpublishPost,
  deletePost,
  getRevisions,
  rollbackRevision,
  getPreviewToken,
  getAnalytics,
  pingPostIndexNow,
} from '../controllers/cmsPost.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';

const router = Router();

// All administrative post routes require valid session authentication
router.use(authenticateAdmin);

router.get('/', requirePermission('posts.read'), getPosts);
router.post('/', requirePermission('posts.create'), createPost);

// Blog Analytics — must be before /:id to avoid wildcard capture
router.get('/analytics/summary', requirePermission('analytics.read'), getAnalytics);

router.get('/:id', requirePermission('posts.read'), getPostById);
router.put('/:id', requirePermission('posts.update'), updatePost);
router.post('/:id/publish', requirePermission('posts.publish'), publishPost);
router.post('/:id/unpublish', requirePermission('posts.publish'), unpublishPost);
router.delete('/:id', requirePermission('posts.delete'), deletePost);

// Revision history & rollback
router.get('/:id/revisions', requirePermission('posts.read'), getRevisions);
router.post('/:id/revisions/:version/rollback', requirePermission('posts.update'), rollbackRevision);

// Preview token generation
router.get('/:id/preview-token', requirePermission('posts.read'), getPreviewToken);

// Instant IndexNow Search Engine Ping
router.post('/:id/ping-indexnow', requirePermission('posts.update'), pingPostIndexNow);

export default router;
