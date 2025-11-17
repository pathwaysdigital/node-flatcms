const express = require('express');
const validator = require('../utils/validator');

const router = express.Router();

/**
 * Collect content type summaries from schema definitions.
 * Supports both `definitions` objects and top-level type entries.
 */
function extractContentTypes(schema) {
  const types = {};

  // Helper to add a type entry if it looks like a schema object
  function addType(name, definition) {
    if (!definition || typeof definition !== 'object') {
      return;
    }

    const properties = definition.properties || {};
    const uniqueFields = Object.entries(properties)
      .filter(([, fieldSchema]) => fieldSchema && fieldSchema.unique === true)
      .map(([fieldName]) => fieldName);

    types[name] = {
      name,
      title: definition.title || name,
      description: definition.description || '',
      properties,
      required: definition.required || [],
      uniqueFields
    };
  }

  if (schema.definitions && typeof schema.definitions === 'object') {
    for (const [name, definition] of Object.entries(schema.definitions)) {
      addType(name, definition);
    }
  }

  for (const [name, definition] of Object.entries(schema)) {
    if (name === 'definitions' || name === '$schema') {
      continue;
    }
    addType(name, definition);
  }

  return Object.values(types);
}

/**
 * GET /api/schema
 * Returns the raw schema along with derived metadata for admin UI consumption.
 */
router.get('/', async (req, res) => {
  try {
    const schema = await validator.loadSchema();
    const types = extractContentTypes(schema);

    res.json({
      schema,
      types
    });
  } catch (error) {
    console.error('Error loading schema:', error);
    res.status(500).json({
      error: 'Failed to load schema',
      message: error.message
    });
  }
});

module.exports = router;


