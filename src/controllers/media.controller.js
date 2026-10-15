import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { ObjectId } from 'mongodb';
import { v2 as cloudinary } from 'cloudinary';
import { getDb } from '../db/connection.js';
import { logAuditEvent } from '../services/audit.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads/cms');

// Cloudinary Configuration (Strictly loaded from environment variables)
function getCloudinaryClient() {
  const cldUrl = process.env.CLOUDINARY_URL;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cldUrl && cldUrl.startsWith('cloudinary://')) {
    try {
      cloudinary.config(cldUrl);
      return { ready: true, cloudName: cloudName || 'env_configured' };
    } catch (e) {
      console.warn('Cloudinary URL config error:', e.message);
    }
  }

  if (cloudName && apiKey && apiSecret) {
    try {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      return { ready: true, cloudName };
    } catch (e) {
      console.warn('Cloudinary credentials config error:', e.message);
    }
  }

  return { ready: false, cloudName: null };
}

// Ensure local upload directory exists
async function ensureUploadsDir() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
  } catch (err) {
    console.error('Failed to create upload directory:', err);
  }
}
ensureUploadsDir();

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/gif',
]);

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

function validateFileSignature(buffer, mimeType) {
  if (!buffer || buffer.length < 4) return false;

  if (mimeType === 'image/jpeg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  }
  if (mimeType === 'image/gif') {
    const header = buffer.slice(0, 4).toString('ascii');
    return header === 'GIF8';
  }
  if (mimeType === 'image/webp') {
    const riff = buffer.slice(0, 4).toString('ascii');
    const webp = buffer.length >= 12 ? buffer.slice(8, 12).toString('ascii') : '';
    return riff === 'RIFF' && webp === 'WEBP';
  }
  if (mimeType === 'image/svg+xml') {
    const text = buffer.toString('utf8').toLowerCase();
    // Must contain basic SVG markup
    if (!text.includes('<svg') && !text.includes('<?xml')) return false;
    // Disallow script execution, XML entities, and dangerous event handlers
    const dangerousPatterns = [
      /<script\b/i,
      /\bon[a-z]+\s*=/i, // onload, onerror, onclick, etc.
      /javascript:/i,
      /<!entity/i,
      /<foreignobject/i,
    ];
    for (const pattern of dangerousPatterns) {
      if (pattern.test(text)) return false;
    }
    return true;
  }
  return false;
}

export async function getMedia(req, res) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const skip = (page - 1) * limit;

    const db = getDb();
    const mediaCol = db.collection('cms_media');

    const [mediaItems, total] = await Promise.all([
      mediaCol.find({}).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      mediaCol.countDocuments({}),
    ]);

    return res.status(200).json({
      media: mediaItems.map(m => ({
        id: m._id.toString(),
        filename: m.filename,
        originalName: m.originalName,
        mimeType: m.mimeType,
        size: m.size,
        url: m.url,
        altText: m.altText || '',
        createdAt: m.createdAt,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('Get Media Error:', err);
    return res.status(500).json({ error: 'Failed to retrieve media library.', code: 'SERVER_ERROR' });
  }
}

export async function uploadMedia(req, res) {
  try {
    await ensureUploadsDir();
    const { fileData, originalName = 'upload.webp', altText = '' } = req.body || {};

    if (!fileData || typeof fileData !== 'string') {
      return res.status(400).json({
        error: 'File payload is required (base64 data URI).',
        code: 'VALIDATION_ERROR',
      });
    }

    // Match data URI pattern: data:image/png;base64,....
    const matches = fileData.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({
        error: 'Invalid file format. Must be a valid image base64 data URI.',
        code: 'INVALID_FILE_DATA',
      });
    }

    const mimeType = matches[1].toLowerCase();
    const base64Data = matches[2];

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({
        error: `MIME type '${mimeType}' is not supported. Allowed: ${Array.from(ALLOWED_MIME_TYPES).join(', ')}`,
        code: 'UNSUPPORTED_MIME_TYPE',
      });
    }

    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: `File size exceeds the 5MB maximum limit (${(buffer.length / 1024 / 1024).toFixed(2)} MB).`,
        code: 'FILE_TOO_LARGE',
      });
    }

    // Cryptographic Magic Byte Signature & Content Verification
    const isSignatureValid = validateFileSignature(buffer, mimeType);
    if (!isSignatureValid) {
      return res.status(400).json({
        error: `File content failed binary signature verification for MIME type '${mimeType}'.`,
        code: 'INVALID_FILE_SIGNATURE',
      });
    }

    // Determine extension
    const extMap = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/svg+xml': '.svg',
      'image/gif': '.gif',
    };
    const ext = extMap[mimeType] || '.webp';

    const safeBase = originalName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 30);
    const randomHex = crypto.randomBytes(8).toString('hex');
    const safeFilename = `${safeBase}_${randomHex}${ext}`;

    let finalUrl = '';
    let storageType = 'local';
    let cloudinaryPublicId = null;
    let cloudinaryError = null;

    // Check Cloudinary client configuration
    const cld = getCloudinaryClient();
    if (cld.ready) {
      try {
        const dataUri = `data:${mimeType};base64,${base64Data}`;
        const cleanPublicId = `${Date.now()}-${safeBase.toLowerCase()}`;
        const uploadResult = await cloudinary.uploader.upload(dataUri, {
          folder: 'gyanvaniai/cms',
          public_id: cleanPublicId,
          resource_type: mimeType === 'image/svg+xml' ? 'image' : 'auto',
          overwrite: true,
          timeout: 60000,
        });

        if (uploadResult && uploadResult.secure_url) {
          finalUrl = uploadResult.secure_url;
          storageType = 'cloudinary';
          cloudinaryPublicId = uploadResult.public_id;
        }
      } catch (cldErr) {
        cloudinaryError = cldErr;
        console.error('Cloudinary upload warning:', cldErr.message, cldErr.http_code);
      }
    }

    // Local Storage Fallback if Cloudinary not enabled or errored
    if (!finalUrl) {
      try {
        await ensureUploadsDir();
        const filePath = path.join(UPLOADS_DIR, safeFilename);

        // Path Traversal Security Verification
        if (!filePath.startsWith(UPLOADS_DIR)) {
          return res.status(400).json({ error: 'Path traversal attempt detected and blocked.', code: 'INVALID_PATH' });
        }

        await fs.writeFile(filePath, buffer);
        finalUrl = `/uploads/cms/${safeFilename}`;
        storageType = 'local';
      } catch (fsErr) {
        console.error('Local filesystem storage failed:', fsErr);
        const detailedMsg = cloudinaryError?.message
          ? `Media upload failed: ${cloudinaryError.message}`
          : 'Media upload failed: Cloudinary environment variables (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are missing or invalid in server environment.';
        return res.status(502).json({
          error: detailedMsg,
          code: 'STORAGE_UNAVAILABLE',
          details: cloudinaryError?.message || fsErr.message,
        });
      }
    }

    const db = getDb();
    const mediaCol = db.collection('cms_media');

    const userId = req.user?.id;
    const uploadedByDoc = {
      id: (userId && ObjectId.isValid(userId)) ? new ObjectId(userId) : (userId || 'admin'),
      name: req.user?.name || 'Administrator',
      email: req.user?.email || 'admin@gyanvaniai.com',
    };

    const mediaDoc = {
      filename: safeFilename,
      originalName,
      mimeType,
      size: buffer.length,
      url: finalUrl,
      storage: storageType,
      cloudinaryPublicId,
      altText: altText.trim(),
      uploadedBy: uploadedByDoc,
      createdAt: new Date(),
    };

    const result = await mediaCol.insertOne(mediaDoc);

    await logAuditEvent({
      actorUserId: req.user?.id,
      actorEmail: req.user?.email,
      action: 'MEDIA_UPLOADED',
      targetType: 'MEDIA',
      targetId: result.insertedId.toString(),
      targetName: safeFilename,
      metadata: { mimeType, size: buffer.length, url: finalUrl, storage: storageType },
      ipAddress: req.ip || req.headers?.['x-forwarded-for'],
      userAgent: req.headers?.['user-agent'],
    });

    return res.status(201).json({
      message: 'Media uploaded successfully.',
      media: {
        id: result.insertedId.toString(),
        ...mediaDoc,
      },
    });
  } catch (err) {
    console.error('Upload Media Error:', err);
    return res.status(500).json({ 
      error: err.message || 'Failed to upload media.', 
      code: err.code || 'SERVER_ERROR' 
    });
  }
}

export async function deleteMedia(req, res) {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid media ID.', code: 'INVALID_ID' });
    }

    const db = getDb();
    const mediaCol = db.collection('cms_media');

    const media = await mediaCol.findOne({ _id: new ObjectId(id) });
    if (!media) {
      return res.status(404).json({ error: 'Media not found.', code: 'NOT_FOUND' });
    }

    // If Cloudinary asset, destroy on Cloudinary
    if (media.storage === 'cloudinary' && media.cloudinaryPublicId) {
      try {
        await cloudinary.uploader.destroy(media.cloudinaryPublicId);
      } catch (cldErr) {
        console.warn('Cloudinary destroy warning:', cldErr.message);
      }
    } else if (media.filename) {
      // Local file unlink
      try {
        const filePath = path.join(UPLOADS_DIR, media.filename);
        await fs.unlink(filePath);
      } catch (fsErr) {
        console.warn(`File unlink notice for ${media.filename}:`, fsErr.message);
      }
    }

    await mediaCol.deleteOne({ _id: new ObjectId(id) });

    await logAuditEvent({
      req,
      action: 'MEDIA_DELETED',
      targetType: 'MEDIA',
      targetId: id,
      targetName: media.filename,
    });

    return res.status(200).json({ message: 'Media asset deleted successfully.' });
  } catch (err) {
    console.error('Delete Media Error:', err);
    return res.status(500).json({ error: 'Failed to delete media asset.', code: 'SERVER_ERROR' });
  }
}
