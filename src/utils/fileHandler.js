const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

/**
 * Get the content directory path for a specific type
 */
function getContentDir(type) {
  return path.join(config.contentDir, type);
}

/**
 * Ensure the content directory exists for a specific type
 */
async function ensureContentDir(type) {
  const dir = getContentDir(type);
  await fs.ensureDir(dir);
  return dir;
}

/**
 * List all content items of a specific type
 */
async function listContent(type) {
  const dir = await ensureContentDir(type);
  const files = await fs.readdir(dir);
  
  const contents = [];
  for (const file of files) {
    if (path.extname(file) === '.json') {
      try {
        const filePath = path.join(dir, file);
        const content = await fs.readJson(filePath);
        contents.push(content);
      } catch (error) {
        // Skip files that can't be parsed as JSON
        console.warn(`Warning: Could not parse ${file} as JSON`);
      }
    }
  }
  
  return contents;
}

/**
 * Get a specific content item by ID
 */
async function getContent(type, id) {
  const dir = getContentDir(type);
  const filePath = path.join(dir, `${id}.json`);
  
  try {
    const content = await fs.readJson(filePath);
    return content;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Create a new content item
 */
async function createContent(type, data) {
  const dir = await ensureContentDir(type);
  
  // Generate ID if not provided
  const id = data.id || uuidv4();
  
  // Ensure id is in the data object
  const content = {
    ...data,
    id,
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  const filePath = path.join(dir, `${id}.json`);
  
  // Check if file already exists
  const exists = await fs.pathExists(filePath);
  if (exists) {
    throw new Error(`Content with ID ${id} already exists`);
  }
  
  await fs.writeJson(filePath, content, { spaces: 2 });
  return content;
}

/**
 * Update an existing content item
 */
async function updateContent(type, id, data) {
  const dir = getContentDir(type);
  const filePath = path.join(dir, `${id}.json`);
  
  // Check if file exists
  const exists = await fs.pathExists(filePath);
  if (!exists) {
    return null;
  }
  
  // Read existing content
  const existing = await fs.readJson(filePath);
  
  // Merge with new data
  const updated = {
    ...existing,
    ...data,
    id, // Ensure ID doesn't change
    updatedAt: new Date().toISOString()
  };
  
  await fs.writeJson(filePath, updated, { spaces: 2 });
  return updated;
}

/**
 * Delete a content item
 */
async function deleteContent(type, id) {
  const dir = getContentDir(type);
  const filePath = path.join(dir, `${id}.json`);
  
  try {
    await fs.remove(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

module.exports = {
  getContentDir,
  ensureContentDir,
  listContent,
  getContent,
  createContent,
  updateContent,
  deleteContent
};

