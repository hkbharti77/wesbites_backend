import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { getDb } from '../db/connection.js';
import { logAuditEvent } from '../services/audit.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads/media');

const DEFAULT_PORTFOLIO_MEDIA = {
  key: 'portfolio_assets',
  channel: 'portfolio',
  resume: {
    url: 'https://res.cloudinary.com/vnwxervq/image/upload/v1786893340/tnp13v5ins7v33n0j4sn.pdf',
    fileName: 'Himanshu_Bharti_Resume.pdf',
    fileSize: 125000,
    mimeType: 'application/pdf',
    updatedAt: new Date('2026-08-16T15:35:00.000Z'),
    storage: 'cloudinary',
  },
  video: {
    url: '/intro.mp4',
    posterUrl: '/portfolio_crm.webp',
    title: 'Himanshu Bharti - AI & Full Stack Engineer Introduction',
    durationSeconds: 45,
    mimeType: 'video/mp4',
    updatedAt: new Date('2026-08-16T15:35:00.000Z'),
    storage: 'local',
  },
  history: [],
  updatedAt: new Date('2026-08-16T15:35:00.000Z'),
};

// Cloudinary client initialization
function getCloudinary() {
  const cldUrl = process.env.CLOUDINARY_URL;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cldUrl && cldUrl.startsWith('cloudinary://')) {
    try {
      cloudinary.config(cldUrl);
      return { ready: true };
    } catch (_) {}
  }

  if (cloudName && apiKey && apiSecret) {
    try {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      return { ready: true };
    } catch (_) {}
  }

  return { ready: false };
}

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (_) {}
}

/**
 * Public: Get active site media (Resume & Intro Video)
 * GET /api/public/media/portfolio
 */
export async function getPublicSiteMedia(req, res) {
  try {
    const db = getDb();
    const col = db.collection('site_media');
    let doc = await col.findOne({ key: 'portfolio_assets' });

    if (!doc) {
      doc = DEFAULT_PORTFOLIO_MEDIA;
    }

    return res.status(200).json({
      resumeUrl: doc.resume?.url || DEFAULT_PORTFOLIO_MEDIA.resume.url,
      resumeFileName: doc.resume?.fileName || DEFAULT_PORTFOLIO_MEDIA.resume.fileName,
      resumeUpdatedAt: doc.resume?.updatedAt || doc.updatedAt,
      resumeFileSize: doc.resume?.fileSize || null,
      introVideoUrl: doc.video?.url || DEFAULT_PORTFOLIO_MEDIA.video.url,
      introVideoPosterUrl: doc.video?.posterUrl || DEFAULT_PORTFOLIO_MEDIA.video.posterUrl,
      introVideoTitle: doc.video?.title || DEFAULT_PORTFOLIO_MEDIA.video.title,
      introVideoUpdatedAt: doc.video?.updatedAt || doc.updatedAt,
    });
  } catch (err) {
    console.error('getPublicSiteMedia error:', err);
    return res.status(200).json({
      resumeUrl: DEFAULT_PORTFOLIO_MEDIA.resume.url,
      resumeFileName: DEFAULT_PORTFOLIO_MEDIA.resume.fileName,
      introVideoUrl: DEFAULT_PORTFOLIO_MEDIA.video.url,
      introVideoPosterUrl: DEFAULT_PORTFOLIO_MEDIA.video.posterUrl,
      introVideoTitle: DEFAULT_PORTFOLIO_MEDIA.video.title,
    });
  }
}

/**
 * Public: Direct Resume Download Stream
 * GET /api/public/media/resume/download
 */
export async function downloadResume(req, res) {
  try {
    const db = getDb();
    const doc = await db.collection('site_media').findOne({ key: 'portfolio_assets' });
    const resume = doc?.resume || DEFAULT_PORTFOLIO_MEDIA.resume;
    const fileName = resume.fileName || 'Himanshu_Bharti_Resume.pdf';

    if (resume.url && (resume.url.startsWith('http://') || resume.url.startsWith('https://'))) {
      const response = await fetch(resume.url);
      if (!response.ok) {
        return res.redirect(resume.url);
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      const arrayBuffer = await response.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    }

    // Local file fallback
    const localPath = path.resolve(__dirname, '../../', resume.url.replace(/^\//, ''));
    return res.download(localPath, fileName);
  } catch (err) {
    console.error('downloadResume error:', err);
    return res.redirect(DEFAULT_PORTFOLIO_MEDIA.resume.url);
  }
}

/**
 * Public: Direct Resume View (Inline)
 * GET /api/public/media/resume/view
 */
export async function viewResume(req, res) {
  try {
    const db = getDb();
    const doc = await db.collection('site_media').findOne({ key: 'portfolio_assets' });
    const resume = doc?.resume || DEFAULT_PORTFOLIO_MEDIA.resume;
    const fileName = resume.fileName || 'Himanshu_Bharti_Resume.pdf';

    if (resume.url && (resume.url.startsWith('http://') || resume.url.startsWith('https://'))) {
      const response = await fetch(resume.url);
      if (!response.ok) {
        return res.redirect(resume.url);
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
      const arrayBuffer = await response.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    }

    const localPath = path.resolve(__dirname, '../../', resume.url.replace(/^\//, ''));
    return res.sendFile(localPath);
  } catch (err) {
    console.error('viewResume error:', err);
    return res.redirect(DEFAULT_PORTFOLIO_MEDIA.resume.url);
  }
}

/**
 * Admin: Get complete site media config with version history
 * GET /api/admin/media/portfolio
 */
export async function getAdminSiteMedia(req, res) {
  try {
    const db = getDb();
    const col = db.collection('site_media');
    let doc = await col.findOne({ key: 'portfolio_assets' });

    if (!doc) {
      doc = { ...DEFAULT_PORTFOLIO_MEDIA };
      await col.insertOne(doc);
    }

    return res.status(200).json({ media: doc });
  } catch (err) {
    console.error('getAdminSiteMedia error:', err);
    return res.status(500).json({ error: 'Failed to retrieve site media configuration.' });
  }
}

/**
 * Admin: Update site media URLs and settings
 * PUT /api/admin/media/portfolio
 */
export async function updateSiteMedia(req, res) {
  try {
    const { resumeUrl, resumeFileName, introVideoUrl, introVideoPosterUrl, introVideoTitle } = req.body || {};
    const db = getDb();
    const col = db.collection('site_media');

    let current = await col.findOne({ key: 'portfolio_assets' });
    if (!current) {
      current = { ...DEFAULT_PORTFOLIO_MEDIA };
    }

    const updateFields = {
      updatedAt: new Date(),
    };

    if (resumeUrl !== undefined) {
      updateFields['resume.url'] = resumeUrl.trim();
      updateFields['resume.updatedAt'] = new Date();
    }
    if (resumeFileName !== undefined) {
      updateFields['resume.fileName'] = resumeFileName.trim();
    }
    if (introVideoUrl !== undefined) {
      updateFields['video.url'] = introVideoUrl.trim();
      updateFields['video.updatedAt'] = new Date();
    }
    if (introVideoPosterUrl !== undefined) {
      updateFields['video.posterUrl'] = introVideoPosterUrl.trim();
    }
    if (introVideoTitle !== undefined) {
      updateFields['video.title'] = introVideoTitle.trim();
    }

    await col.updateOne(
      { key: 'portfolio_assets' },
      { $set: updateFields },
      { upsert: true }
    );

    const updated = await col.findOne({ key: 'portfolio_assets' });

    await logAuditEvent({
      req,
      action: 'SITE_MEDIA_UPDATED',
      targetType: 'SITE_MEDIA',
      targetId: 'portfolio_assets',
      metadata: { resumeUrl, introVideoUrl },
    });

    return res.status(200).json({
      message: 'Site media updated successfully.',
      media: updated,
    });
  } catch (err) {
    console.error('updateSiteMedia error:', err);
    return res.status(500).json({ error: 'Failed to update site media configuration.' });
  }
}

/**
 * Admin: Upload Resume PDF (Cloudinary + Local Fallback)
 * POST /api/admin/media/portfolio/upload-resume
 */
export async function uploadResume(req, res) {
  try {
    const { fileName, mimeType, base64Data } = req.body || {};

    if (!base64Data) {
      return res.status(400).json({ error: 'No file data received.' });
    }

    const cleanMime = (mimeType || 'application/pdf').toLowerCase();
    if (!cleanMime.includes('pdf')) {
      return res.status(400).json({ error: 'Only PDF resume files are accepted.' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > 20 * 1024 * 1024) {
      return res.status(400).json({ error: 'Resume PDF exceeds 20MB limit.' });
    }

    // Verify PDF header magic bytes (%PDF)
    if (buffer.slice(0, 4).toString() !== '%PDF') {
      return res.status(400).json({ error: 'File content failed PDF signature verification.' });
    }

    const safeBase = (fileName || 'resume').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const randomHex = crypto.randomBytes(6).toString('hex');
    const safeFilename = `${safeBase}_${randomHex}.pdf`;

    let finalUrl = '';
    let storageType = 'local';
    let cloudinaryPublicId = null;

    const cld = getCloudinary();
    if (cld.ready) {
      try {
        const dataUri = `data:application/pdf;base64,${base64Data}`;
        const uploadResult = await cloudinary.uploader.upload(dataUri, {
          folder: 'portfolio_media/resumes',
          public_id: `resume-${Date.now()}-${safeBase}`,
          resource_type: 'auto',
          overwrite: true,
        });

        if (uploadResult?.secure_url) {
          finalUrl = uploadResult.secure_url;
          storageType = 'cloudinary';
          cloudinaryPublicId = uploadResult.public_id;
        }
      } catch (cldErr) {
        console.warn('Cloudinary resume upload failed, falling back to local:', cldErr.message);
      }
    }

    if (!finalUrl) {
      await ensureDir(path.join(UPLOADS_DIR, 'resumes'));
      const filePath = path.join(UPLOADS_DIR, 'resumes', safeFilename);
      await fs.writeFile(filePath, buffer);
      finalUrl = `/uploads/media/resumes/${safeFilename}`;
      storageType = 'local';
    }

    const db = getDb();
    const col = db.collection('site_media');

    const resumeData = {
      url: finalUrl,
      fileName: fileName || 'Himanshu_Bharti_Resume.pdf',
      fileSize: buffer.length,
      mimeType: 'application/pdf',
      storage: storageType,
      cloudinaryPublicId,
      updatedAt: new Date(),
    };

    const historyEntry = {
      type: 'resume',
      ...resumeData,
      uploadedBy: req.user?.email || 'admin',
    };

    await col.updateOne(
      { key: 'portfolio_assets' },
      {
        $set: {
          resume: resumeData,
          updatedAt: new Date(),
        },
        $push: {
          history: {
            $each: [historyEntry],
            $slice: -20, // Keep last 20 revisions
          },
        },
      },
      { upsert: true }
    );

    await logAuditEvent({
      req,
      action: 'RESUME_UPLOADED',
      targetType: 'SITE_MEDIA',
      targetId: 'portfolio_assets',
      metadata: { finalUrl, fileName, storageType, fileSize: buffer.length },
    });

    return res.status(200).json({
      message: 'Resume PDF uploaded and activated successfully.',
      resume: resumeData,
    });
  } catch (err) {
    console.error('uploadResume error:', err);
    return res.status(500).json({ error: 'Failed to upload resume PDF.' });
  }
}

/**
 * Admin: Upload Intro Video (Cloudinary + Local Fallback)
 * POST /api/admin/media/portfolio/upload-video
 */
export async function uploadVideo(req, res) {
  try {
    const { fileName, mimeType, base64Data, title, posterUrl } = req.body || {};

    if (!base64Data) {
      return res.status(400).json({ error: 'No video data received.' });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > 50 * 1024 * 1024) {
      return res.status(400).json({ error: 'Video file exceeds 50MB limit.' });
    }

    const cleanMime = (mimeType || 'video/mp4').toLowerCase();
    const ext = cleanMime.includes('webm') ? '.webm' : cleanMime.includes('mov') ? '.mov' : '.mp4';
    const safeBase = (fileName || 'intro_video').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const randomHex = crypto.randomBytes(6).toString('hex');
    const safeFilename = `${safeBase}_${randomHex}${ext}`;

    let finalUrl = '';
    let storageType = 'local';
    let cloudinaryPublicId = null;

    const cld = getCloudinary();
    if (cld.ready) {
      try {
        const dataUri = `data:${cleanMime};base64,${base64Data}`;
        const uploadResult = await cloudinary.uploader.upload(dataUri, {
          folder: 'portfolio_media/videos',
          public_id: `video-${Date.now()}-${safeBase}`,
          resource_type: 'video',
          overwrite: true,
          timeout: 120000,
        });

        if (uploadResult?.secure_url) {
          finalUrl = uploadResult.secure_url;
          storageType = 'cloudinary';
          cloudinaryPublicId = uploadResult.public_id;
        }
      } catch (cldErr) {
        console.warn('Cloudinary video upload failed, falling back to local:', cldErr.message);
      }
    }

    if (!finalUrl) {
      await ensureDir(path.join(UPLOADS_DIR, 'videos'));
      const filePath = path.join(UPLOADS_DIR, 'videos', safeFilename);
      await fs.writeFile(filePath, buffer);
      finalUrl = `/uploads/media/videos/${safeFilename}`;
      storageType = 'local';
    }

    const db = getDb();
    const col = db.collection('site_media');

    const videoData = {
      url: finalUrl,
      posterUrl: posterUrl || '/portfolio_crm.webp',
      title: title || 'Himanshu Bharti - AI & Full Stack Engineer Introduction',
      fileSize: buffer.length,
      mimeType: cleanMime,
      storage: storageType,
      cloudinaryPublicId,
      updatedAt: new Date(),
    };

    const historyEntry = {
      type: 'video',
      ...videoData,
      uploadedBy: req.user?.email || 'admin',
    };

    await col.updateOne(
      { key: 'portfolio_assets' },
      {
        $set: {
          video: videoData,
          updatedAt: new Date(),
        },
        $push: {
          history: {
            $each: [historyEntry],
            $slice: -20,
          },
        },
      },
      { upsert: true }
    );

    await logAuditEvent({
      req,
      action: 'VIDEO_UPLOADED',
      targetType: 'SITE_MEDIA',
      targetId: 'portfolio_assets',
      metadata: { finalUrl, fileName, storageType, fileSize: buffer.length },
    });

    return res.status(200).json({
      message: 'Intro video uploaded and activated successfully.',
      video: videoData,
    });
  } catch (err) {
    console.error('uploadVideo error:', err);
    return res.status(500).json({ error: 'Failed to upload video.' });
  }
}
