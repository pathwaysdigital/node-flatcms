const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { matchesFilters, matchesSearch, sortItems, paginateItems } = require('./queryParser');
const versionHandler = require('./versionHandler');

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
 * @param {string} type - Content type
 * @param {object} options - Query options (filters, search, sort, limit, offset)
 * @returns {object} - Object with data array and pagination info
 */
async function listContent(type, options = {}) {
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
  
  // Apply filters
  let filtered = contents;
  if (options.filters && Object.keys(options.filters).length > 0) {
    filtered = contents.filter(item => matchesFilters(item, options.filters));
  }
  
  // Apply search
  if (options.search) {
    filtered = filtered.filter(item => matchesSearch(item, options.search));
  }
  
  // Apply sorting
  if (options.sort) {
    filtered = sortItems(filtered, options.sort);
  }
  
  // Get total before pagination
  const total = filtered.length;
  
  // Apply pagination
  const paginated = paginateItems(filtered, options.limit, options.offset || 0);
  
  // Return paginated response
  return {
    data: paginated,
    pagination: {
      total,
      limit: options.limit,
      offset: options.offset || 0,
      hasMore: options.limit ? (options.offset || 0) + options.limit < total : false
    }
  };
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
  
  const now = new Date().toISOString();
  
  // Handle status and publishedAt for draft/published workflow
  const status = data.status || 'draft';
  const publishedAt = status === 'published' && !data.publishedAt ? now : data.publishedAt;
  
  // Ensure id is in the data object
  const content = {
    ...data,
    id,
    status,
    createdAt: data.createdAt || now,
    updatedAt: now,
    ...(publishedAt && { publishedAt })
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
 * Automatically creates a version snapshot before updating
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
  
  // Create version snapshot before updating
  try {
    await versionHandler.createVersion(type, id, existing);
  } catch (error) {
    // Log but don't fail the update if versioning fails
    console.warn(`Warning: Could not create version for ${type}/${id}:`, error.message);
  }
  
  const now = new Date().toISOString();
  
  // Handle status changes for draft/published workflow
  const newStatus = data.status !== undefined ? data.status : existing.status;
  let publishedAt = existing.publishedAt;
  
  // If status is changing to published and publishedAt is not set, set it now
  if (newStatus === 'published' && !publishedAt) {
    publishedAt = now;
  }
  // If status is changing from published to something else, keep publishedAt
  // If status is explicitly provided in data, use it
  if (data.publishedAt !== undefined) {
    publishedAt = data.publishedAt;
  }
  
  // Merge with new data
  const updated = {
    ...existing,
    ...data,
    id, // Ensure ID doesn't change
    status: newStatus,
    updatedAt: now,
    ...(publishedAt && { publishedAt })
  };
  
  await fs.writeJson(filePath, updated, { spaces: 2 });
  return updated;
}

/**
 * Delete a content item
 * Also deletes all associated versions
 */
async function deleteContent(type, id) {
  const dir = getContentDir(type);
  const filePath = path.join(dir, `${id}.json`);
  
  try {
    await fs.remove(filePath);
    
    // Also delete all versions
    try {
      await versionHandler.deleteAllVersions(type, id);
    } catch (error) {
      // Log but don't fail if version cleanup fails
      console.warn(`Warning: Could not delete versions for ${type}/${id}:`, error.message);
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
 * Get related content items
 * Finds content that shares tags, categories, or has relations to the given content
 */
async function getRelatedContent(type, id, options = {}) {
  const content = await getContent(type, id);
  if (!content) {
    return { data: [], pagination: { total: 0, limit: null, offset: 0, hasMore: false } };
  }
  
  const allContent = await listContent(type, {});
  const related = [];
  
  // Find content with matching tags
  if (content.tags && Array.isArray(content.tags) && content.tags.length > 0) {
    for (const item of allContent.data) {
      if (item.id !== id && item.tags && Array.isArray(item.tags)) {
        const commonTags = content.tags.filter(tag => item.tags.includes(tag));
        if (commonTags.length > 0) {
          related.push({ item, score: commonTags.length, reason: 'tags' });
        }
      }
    }
  }
  
  // Find content with matching category
  if (content.category) {
    for (const item of allContent.data) {
      if (item.id !== id && item.category === content.category) {
        // Check if already added
        const existing = related.find(r => r.item.id === item.id);
        if (!existing) {
          related.push({ item, score: 1, reason: 'category' });
        } else {
          existing.score += 1;
        }
      }
    }
  }
  
  // Find content that references this item (relations)
  const relationFields = ['related', 'relations', 'references', 'linked'];
  for (const field of relationFields) {
    for (const item of allContent.data) {
      if (item.id !== id && item[field]) {
        let references = [];
        if (Array.isArray(item[field])) {
          references = item[field];
        } else if (typeof item[field] === 'string') {
          references = [item[field]];
        } else if (typeof item[field] === 'object' && item[field].id) {
          references = [item[field].id];
        }
        
        if (references.includes(id) || references.some(ref => 
          (typeof ref === 'object' && ref.id === id) || ref === id
        )) {
          const existing = related.find(r => r.item.id === item.id);
          if (!existing) {
            related.push({ item, score: 1, reason: 'relation' });
          } else {
            existing.score += 1;
          }
        }
      }
    }
  }
  
  // Sort by score (most related first)
  related.sort((a, b) => b.score - a.score);
  
  // Extract just the items
  const relatedItems = related.map(r => r.item);
  
  // Apply limit if specified
  const limit = options.limit || null;
  const offset = options.offset || 0;
  const paginated = paginateItems(relatedItems, limit, offset);
  
  return {
    data: paginated,
    pagination: {
      total: relatedItems.length,
      limit,
      offset,
      hasMore: limit ? offset + limit < relatedItems.length : false
    }
  };
}

module.exports = {
  getContentDir,
  ensureContentDir,
  listContent,
  getContent,
  createContent,
  updateContent,
  deleteContent,
  getRelatedContent
};

