const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const config = require('../config');
const mediaHandler = require('../utils/mediaHandler');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    // Create temp directory for uploads
    const tempDir = path.join(config.mediaDir, '.temp');
    await fs.ensureDir(tempDir);
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Use original filename with timestamp for temp storage
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSize
  },
  fileFilter: (req, file, cb) => {
    // Check MIME type if restrictions are configured
    if (config.allowedMimeTypes && !config.allowedMimeTypes.includes(file.mimetype)) {
      return cb(new Error(`File type ${file.mimetype} is not allowed. Allowed types: ${config.allowedMimeTypes.join(', ')}`));
    }
    cb(null, true);
  }
});

/**
 * POST /api/media/upload
 * Upload a media file
 * 
 * Form data:
 * - file: The file to upload
 * - type: (optional) Media type/category (default: 'general')
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded'
      });
    }
    
    const type = req.body.type || 'general';
    const metadata = await mediaHandler.saveMedia(req.file, type);
    
    res.status(201).json(metadata);
  } catch (error) {
    console.error('Error uploading media:', error);
    
    // Clean up temp file if it exists
    if (req.file && req.file.path) {
      try {
        await fs.remove(req.file.path);
      } catch (cleanupError) {
        console.warn('Warning: Could not cleanup temp file:', cleanupError.message);
      }
    }
    
    res.status(500).json({
      error: 'Failed to upload media',
      message: error.message
    });
  }
});

/**
 * GET /api/media
 * List all media files
 * 
 * Query parameters:
 * - type: (optional) Filter by media type
 */
router.get('/', async (req, res) => {
  try {
    const type = req.query.type || null;
    const media = await mediaHandler.listMedia(type);
    res.json(media);
  } catch (error) {
    console.error('Error listing media:', error);
    res.status(500).json({
      error: 'Failed to list media',
      message: error.message
    });
  }
});

/**
 * GET /api/media/:type/:filename
 * Get media file metadata
 */
router.get('/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;
    const metadata = await mediaHandler.getMediaMetadata(type, filename);
    
    if (!metadata) {
      return res.status(404).json({
        error: `Media file not found: ${type}/${filename}`
      });
    }
    
    res.json(metadata);
  } catch (error) {
    console.error('Error getting media metadata:', error);
    res.status(500).json({
      error: 'Failed to get media metadata',
      message: error.message
    });
  }
});

/**
 * GET /api/media/:type/:filename/file
 * Serve the actual media file
 */
router.get('/:type/:filename/file', async (req, res) => {
  try {
    const { type, filename } = req.params;
    const filePath = mediaHandler.getMediaFilePath(type, filename);
    
    const exists = await fs.pathExists(filePath);
    if (!exists) {
      return res.status(404).json({
        error: `Media file not found: ${type}/${filename}`
      });
    }
    
    // Get metadata for content-type
    const metadata = await mediaHandler.getMediaMetadata(type, filename);
    if (metadata && metadata.mimeType) {
      res.type(metadata.mimeType);
    }
    
    res.sendFile(path.resolve(filePath));
  } catch (error) {
    console.error('Error serving media file:', error);
    res.status(500).json({
      error: 'Failed to serve media file',
      message: error.message
    });
  }
});

/**
 * DELETE /api/media/:type/:filename
 * Delete a media file
 */
router.delete('/:type/:filename', async (req, res) => {
  try {
    const { type, filename } = req.params;
    const deleted = await mediaHandler.deleteMedia(type, filename);
    
    if (!deleted) {
      return res.status(404).json({
        error: `Media file not found: ${type}/${filename}`
      });
    }
    
    res.json({
      message: `Media file ${type}/${filename} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({
      error: 'Failed to delete media',
      message: error.message
    });
  }
});

module.exports = router;

