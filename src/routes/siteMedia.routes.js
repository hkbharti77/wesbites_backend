import { Router } from 'express';
import {
  getPublicSiteMedia,
  downloadResume,
  viewResume,
  getAdminSiteMedia,
  updateSiteMedia,
  uploadResume,
  uploadVideo,
} from '../controllers/siteMedia.controller.js';
import { authenticateAdmin } from '../middleware/auth.js';

export const publicSiteMediaRoutes = Router();

// Public media retrieval & direct document delivery
publicSiteMediaRoutes.get('/portfolio', getPublicSiteMedia);
publicSiteMediaRoutes.get('/site-media', getPublicSiteMedia);
publicSiteMediaRoutes.get('/resume/download', downloadResume);
publicSiteMediaRoutes.get('/resume/view', viewResume);

export const adminSiteMediaRoutes = Router();

// Protected admin operations
adminSiteMediaRoutes.use(authenticateAdmin);

adminSiteMediaRoutes.get('/', getAdminSiteMedia);
adminSiteMediaRoutes.put('/', updateSiteMedia);
adminSiteMediaRoutes.post('/upload-resume', uploadResume);
adminSiteMediaRoutes.post('/upload-video', uploadVideo);

export default {
  public: publicSiteMediaRoutes,
  admin: adminSiteMediaRoutes,
};
