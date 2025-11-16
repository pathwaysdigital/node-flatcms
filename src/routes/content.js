const express = require('express');
const router = express.Router();
const fileHandler = require('../utils/fileHandler');
const validator = require('../utils/validator');

/**
 * GET /api/content/:type
 * List all content items of a specific type
 */
router.get('/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const contents = await fileHandler.listContent(type);
    res.json(contents);
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

module.exports = router;

