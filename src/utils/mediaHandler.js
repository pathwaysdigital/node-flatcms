const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

/**
 * Ensure the media directory exists
 */
async function ensureMediaDir() {
  await fs.ensureDir(config.mediaDir);
  return config.mediaDir;
}

/**
 * Get the media metadata file path
 */
function getMetadataPath(filePath) {
  return `${filePath}.meta.json`;
}

/**
 * Save uploaded file and create metadata
 */
async function saveMedia(file, type = 'general') {
  await ensureMediaDir();
  
  // Create type subdirectory
  const typeDir = path.join(config.mediaDir, type);
  await fs.ensureDir(typeDir);
  
  // Generate unique filename
  const ext = path.extname(file.originalname);
  const filename = `${uuidv4()}${ext}`;
  const filePath = path.join(typeDir, filename);
  
  // Save file
  await fs.move(file.path, filePath);
  
  // Create metadata
  const metadata = {
    id: uuidv4(),
    originalName: file.originalname,
    filename,
    type,
    mimeType: file.mimetype,
    size: file.size,
    path: filePath,
    url: `/api/media/${type}/${filename}`,
    createdAt: new Date().toISOString()
  };
  
  // Save metadata
  const metadataPath = getMetadataPath(filePath);
  await fs.writeJson(metadataPath, metadata, { spaces: 2 });
  
  return metadata;
}

/**
 * Get media metadata by filename
 */
async function getMediaMetadata(type, filename) {
  const filePath = path.join(config.mediaDir, type, filename);
  const metadataPath = getMetadataPath(filePath);
  
  try {
    const metadata = await fs.readJson(metadataPath);
    return metadata;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * List all media files (optionally filtered by type)
 */
async function listMedia(type = null) {
  await ensureMediaDir();
  
  const media = [];
  
  if (type) {
    // List media of specific type
    const typeDir = path.join(config.mediaDir, type);
    const exists = await fs.pathExists(typeDir);
    if (!exists) {
      return media;
    }
    
    const files = await fs.readdir(typeDir);
    for (const file of files) {
      if (path.extname(file) === '.json' && file.endsWith('.meta.json')) {
        try {
          const metadataPath = path.join(typeDir, file);
          const metadata = await fs.readJson(metadataPath);
          media.push(metadata);
        } catch (error) {
          console.warn(`Warning: Could not parse metadata file ${file}`);
        }
      }
    }
  } else {
    // List all media across all types
    const files = await fs.readdir(config.mediaDir);
    for (const typeDir of files) {
      const typePath = path.join(config.mediaDir, typeDir);
      const stat = await fs.stat(typePath);
      if (stat.isDirectory()) {
        const typeFiles = await fs.readdir(typePath);
        for (const file of typeFiles) {
          if (path.extname(file) === '.json' && file.endsWith('.meta.json')) {
            try {
              const metadataPath = path.join(typePath, file);
              const metadata = await fs.readJson(metadataPath);
              media.push(metadata);
            } catch (error) {
              console.warn(`Warning: Could not parse metadata file ${file}`);
            }
          }
        }
      }
    }
  }
  
  // Sort by createdAt descending
  media.sort((a, b) => {
    const aTime = new Date(a.createdAt || 0).getTime();
    const bTime = new Date(b.createdAt || 0).getTime();
    return bTime - aTime;
  });
  
  return media;
}

/**
 * Delete media file and metadata
 */
async function deleteMedia(type, filename) {
  const filePath = path.join(config.mediaDir, type, filename);
  const metadataPath = getMetadataPath(filePath);
  
  try {
    // Delete file
    const fileExists = await fs.pathExists(filePath);
    if (fileExists) {
      await fs.remove(filePath);
    }
    
    // Delete metadata
    const metadataExists = await fs.pathExists(metadataPath);
    if (metadataExists) {
      await fs.remove(metadataPath);
    }
    
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

/**
 * Get the file path for serving media
 */
function getMediaFilePath(type, filename) {
  return path.join(config.mediaDir, type, filename);
}

module.exports = {
  saveMedia,
  getMediaMetadata,
  listMedia,
  deleteMedia,
  getMediaFilePath
};

