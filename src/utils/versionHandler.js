const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

/**
 * Get the versions directory for a content item
 */
function getVersionsDir(type, id) {
  return path.join(config.contentDir, type, id, 'versions');
}

/**
 * Ensure the versions directory exists
 */
async function ensureVersionsDir(type, id) {
  const dir = getVersionsDir(type, id);
  await fs.ensureDir(dir);
  return dir;
}

/**
 * Create a version snapshot of content
 */
async function createVersion(type, id, content) {
  const versionsDir = await ensureVersionsDir(type, id);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const versionId = `v${timestamp}`;
  const versionPath = path.join(versionsDir, `${versionId}.json`);
  
  const version = {
    ...content,
    versionId,
    versionedAt: new Date().toISOString()
  };
  
  await fs.writeJson(versionPath, version, { spaces: 2 });
  
  // Cleanup old versions (keep last 10 by default)
  await cleanupOldVersions(type, id, 10);
  
  return version;
}

/**
 * Get all versions for a content item
 */
async function listVersions(type, id) {
  const versionsDir = getVersionsDir(type, id);
  
  try {
    const exists = await fs.pathExists(versionsDir);
    if (!exists) {
      return [];
    }
    
    const files = await fs.readdir(versionsDir);
    const versions = [];
    
    for (const file of files) {
      if (path.extname(file) === '.json') {
        try {
          const filePath = path.join(versionsDir, file);
          const version = await fs.readJson(filePath);
          versions.push(version);
        } catch (error) {
          console.warn(`Warning: Could not parse version file ${file} as JSON`);
        }
      }
    }
    
    // Sort by versionedAt descending (newest first)
    versions.sort((a, b) => {
      const aTime = new Date(a.versionedAt || 0).getTime();
      const bTime = new Date(b.versionedAt || 0).getTime();
      return bTime - aTime;
    });
    
    return versions;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

/**
 * Get a specific version by versionId
 */
async function getVersion(type, id, versionId) {
  const versionsDir = getVersionsDir(type, id);
  const versionPath = path.join(versionsDir, `${versionId}.json`);
  
  try {
    const version = await fs.readJson(versionPath);
    return version;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Cleanup old versions, keeping only the last N versions
 */
async function cleanupOldVersions(type, id, keepCount = 10) {
  const versions = await listVersions(type, id);
  
  if (versions.length <= keepCount) {
    return;
  }
  
  // Remove oldest versions (they're already sorted newest first)
  const toRemove = versions.slice(keepCount);
  const versionsDir = getVersionsDir(type, id);
  
  for (const version of toRemove) {
    const versionPath = path.join(versionsDir, `${version.versionId}.json`);
    try {
      await fs.remove(versionPath);
    } catch (error) {
      console.warn(`Warning: Could not remove version file ${versionPath}:`, error.message);
    }
  }
}

/**
 * Delete all versions for a content item
 */
async function deleteAllVersions(type, id) {
  const versionsDir = getVersionsDir(type, id);
  
  try {
    const exists = await fs.pathExists(versionsDir);
    if (exists) {
      await fs.remove(versionsDir);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

module.exports = {
  createVersion,
  listVersions,
  getVersion,
  cleanupOldVersions,
  deleteAllVersions
};

