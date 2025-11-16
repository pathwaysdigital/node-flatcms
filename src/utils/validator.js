const Ajv = require('ajv');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config');

let schemaCache = null;
let ajvInstance = null;

/**
 * Load the schema file from disk
 */
async function loadSchema() {
  if (schemaCache) {
    return schemaCache;
  }
  
  try {
    const schemaPath = path.resolve(config.schemaFile);
    const exists = await fs.pathExists(schemaPath);
    
    if (!exists) {
      throw new Error(`Schema file not found: ${schemaPath}`);
    }
    
    schemaCache = await fs.readJson(schemaPath);
    return schemaCache;
  } catch (error) {
    throw new Error(`Failed to load schema file: ${error.message}`);
  }
}

/**
 * Initialize AJV instance with schema
 */
async function getValidator() {
  if (ajvInstance) {
    return ajvInstance;
  }
  
  const schema = await loadSchema();
  ajvInstance = new Ajv();
  
  // If schema has definitions, compile them
  if (schema.definitions) {
    Object.keys(schema.definitions).forEach(key => {
      ajvInstance.addSchema(schema.definitions[key], `#/definitions/${key}`);
    });
  }
  
  return ajvInstance;
}

/**
 * Validate content against schema for a given content type
 */
async function validateContent(type, data) {
  const schema = await loadSchema();
  const ajv = await getValidator();
  
  // Try to find schema definition for the content type
  let schemaDefinition = null;
  
  if (schema.definitions && schema.definitions[type]) {
    // Use definition from definitions object
    schemaDefinition = schema.definitions[type];
  } else if (schema[type]) {
    // Use direct property
    schemaDefinition = schema[type];
  } else {
    return {
      valid: false,
      errors: [{ message: `No schema definition found for content type: ${type}` }]
    };
  }
  
  // Validate the data
  const validate = ajv.compile(schemaDefinition);
  const valid = validate(data);
  
  if (!valid) {
    return {
      valid: false,
      errors: validate.errors.map(err => ({
        message: err.message,
        path: err.instancePath,
        params: err.params
      }))
    };
  }
  
  return { valid: true, errors: [] };
}

/**
 * Clear schema cache (useful for development/reloading)
 */
function clearCache() {
  schemaCache = null;
  ajvInstance = null;
}

module.exports = {
  validateContent,
  loadSchema,
  clearCache
};

