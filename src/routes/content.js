const express = require('express');
const router = express.Router();
const fileHandler = require('../utils/fileHandler');
const validator = require('../utils/validator');
const { parseQuery } = require('../utils/queryParser');
const versionHandler = require('../utils/versionHandler');

/**
 * GET /api/content/:type
 * List all content items of a specific type
 * 
 * Query parameters:
 * - filter: ?field=value (equality), ?field__gt=10, ?field__lt=20, ?field__gte=5, ?field__lte=15, ?field__ne=value
 * - array: ?field__in=value1,value2,value3
 * - search: ?search=text (searches across string fields)
 * - status: ?status=published|draft|archived
 * - sort: ?sort=field or ?sort=-field (descending)
 * - pagination: ?limit=10&offset=0
 */
router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const queryOptions = parseQuery(req.query);
    const result = await fileHandler.listContent(type, queryOptions);
    res.json(result);
  } catch (error) {
    console.error('Error listing content:', error);
    res.status(500).json({
      error: 'Failed to list content',
      message: error.message
    });
  }
});

/**
 * GET /api/content/:type/:id
 * Get a single content item by ID
 */
router.get('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const content = await fileHandler.getContent(type, id);
    
    if (!content) {
      return res.status(404).json({
        error: `Content item not found: ${type}/${id}`
      });
    }
    
    res.json(content);
  } catch (error) {
    console.error('Error getting content:', error);
    res.status(500).json({
      error: 'Failed to get content',
      message: error.message
    });
  }
});

/**
 * POST /api/content/:type
 * Create a new content item
 */
router.post('/:type', express.json(), async (req, res) => {
  try {
    const { type } = req.params;
    const data = req.body;
    
    // Validate content against schema
    const validation = await validator.validateContent(type, data);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }
    
    // Validate uniqueness of unique fields
    const uniquenessValidation = await validator.validateUniqueness(type, data);
    if (!uniquenessValidation.valid) {
      return res.status(409).json({
        error: 'Uniqueness validation failed',
        details: uniquenessValidation.errors
      });
    }
    
    // Create content
    const content = await fileHandler.createContent(type, data);
    res.status(201).json(content);
  } catch (error) {
    console.error('Error creating content:', error);
    
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: error.message
      });
    }
    
    res.status(500).json({
      error: 'Failed to create content',
      message: error.message
    });
  }
});

/**
 * PUT /api/content/:type/:id
 * Update an existing content item
 */
router.put('/:type/:id', express.json(), async (req, res) => {
  try {
    const { type, id } = req.params;
    const data = req.body;
    
    // Get existing content to merge
    const existing = await fileHandler.getContent(type, id);
    if (!existing) {
      return res.status(404).json({
        error: `Content item not found: ${type}/${id}`
      });
    }
    
    // Merge existing with new data for validation
    const mergedData = { ...existing, ...data, id };
    
    // Validate merged content against schema
    const validation = await validator.validateContent(type, mergedData);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validation.errors
      });
    }
    
    // Validate uniqueness of unique fields (exclude current item)
    const uniquenessValidation = await validator.validateUniqueness(type, mergedData, id);
    if (!uniquenessValidation.valid) {
      return res.status(409).json({
        error: 'Uniqueness validation failed',
        details: uniquenessValidation.errors
      });
    }
    
    // Update content
    const updated = await fileHandler.updateContent(type, id, data);
    res.json(updated);
  } catch (error) {
    console.error('Error updating content:', error);
    res.status(500).json({
      error: 'Failed to update content',
      message: error.message
    });
  }
});

/**
 * DELETE /api/content/:type/:id
 * Delete a content item
 */
router.delete('/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    const deleted = await fileHandler.deleteContent(type, id);
    
    if (!deleted) {
      return res.status(404).json({
        error: `Content item not found: ${type}/${id}`
      });
    }
    
    res.json({
      message: `Content item ${type}/${id} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting content:', error);
    res.status(500).json({
      error: 'Failed to delete content',
      message: error.message
    });
  }
});

/**
 * GET /api/content/:type/:id/versions
 * List all versions for a content item
 */
router.get('/:type/:id/versions', async (req, res) => {
  try {
    const { type, id } = req.params;
    
    // Check if content exists
    const content = await fileHandler.getContent(type, id);
    if (!content) {
      return res.status(404).json({
        error: `Content item not found: ${type}/${id}`
      });
    }
    
    const versions = await versionHandler.listVersions(type, id);
    res.json(versions);
  } catch (error) {
    console.error('Error listing versions:', error);
    res.status(500).json({
      error: 'Failed to list versions',
      message: error.message
    });
  }
});

/**
 * GET /api/content/:type/:id/versions/:versionId
 * Get a specific version by versionId
 */
router.get('/:type/:id/versions/:versionId', async (req, res) => {
  try {
    const { type, id, versionId } = req.params;
    
    // Check if content exists
    const content = await fileHandler.getContent(type, id);
    if (!content) {
      return res.status(404).json({
        error: `Content item not found: ${type}/${id}`
      });
    }
    
    const version = await versionHandler.getVersion(type, id, versionId);
    if (!version) {
      return res.status(404).json({
        error: `Version not found: ${versionId}`
      });
    }
    
    res.json(version);
  } catch (error) {
    console.error('Error getting version:', error);
    res.status(500).json({
      error: 'Failed to get version',
      message: error.message
    });
  }
});

/**
 * POST /api/content/:type/:id/restore/:versionId
 * Restore a content item to a previous version
 */
router.post('/:type/:id/restore/:versionId', async (req, res) => {
  try {
    const { type, id, versionId } = req.params;
    
    // Check if content exists
    const content = await fileHandler.getContent(type, id);
    if (!content) {
      return res.status(404).json({
        error: `Content item not found: ${type}/${id}`
      });
    }
    
    // Get the version to restore
    const version = await versionHandler.getVersion(type, id, versionId);
    if (!version) {
      return res.status(404).json({
        error: `Version not found: ${versionId}`
      });
    }
    
    // Remove version-specific fields before restoring
    const { versionId: _, versionedAt: __, ...restoredData } = version;
    
    // Restore the content (this will create a new version of the current state)
    const restored = await fileHandler.updateContent(type, id, restoredData);
    
    res.json({
      message: `Content item ${type}/${id} restored to version ${versionId}`,
      content: restored
    });
  } catch (error) {
    console.error('Error restoring version:', error);
    res.status(500).json({
      error: 'Failed to restore version',
      message: error.message
    });
  }
});

/**
 * GET /api/content/:type/:id/related
 * Get related content items (by tags, categories, or relations)
 * 
 * Query parameters:
 * - limit: Maximum number of related items to return
 * - offset: Offset for pagination
 */
router.get('/:type/:id/related', async (req, res) => {
  try {
    const { type, id } = req.params;
    const queryOptions = parseQuery(req.query);
    
    // Check if content exists
    const content = await fileHandler.getContent(type, id);
    if (!content) {
      return res.status(404).json({
        error: `Content item not found: ${type}/${id}`
      });
    }
    
    const result = await fileHandler.getRelatedContent(type, id, {
      limit: queryOptions.limit,
      offset: queryOptions.offset
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error getting related content:', error);
    res.status(500).json({
      error: 'Failed to get related content',
      message: error.message
    });
  }
});

module.exports = router;

