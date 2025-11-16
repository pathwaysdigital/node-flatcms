const Ajv = require('ajv');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const fileHandler = require('./fileHandler');

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
 * Get unique fields from schema definition
 */
async function getUniqueFields(type) {
  const schema = await loadSchema();
  
  // Try to find schema definition for the content type
  let schemaDefinition = null;
  
  if (schema.definitions && schema.definitions[type]) {
    schemaDefinition = schema.definitions[type];
  } else if (schema[type]) {
    schemaDefinition = schema[type];
  } else {
    return [];
  }
  
  // Extract fields marked as unique
  const uniqueFields = [];
  if (schemaDefinition.properties) {
    for (const [fieldName, fieldSchema] of Object.entries(schemaDefinition.properties)) {
      // Check for custom 'unique' property (not standard JSON Schema, but we support it)
      if (fieldSchema.unique === true) {
        uniqueFields.push(fieldName);
      }
    }
  }
  
  return uniqueFields;
}

/**
 * Validate uniqueness of fields marked as unique
 * @param {string} type - Content type
 * @param {object} data - Content data to validate
 * @param {string} excludeId - ID to exclude from uniqueness check (for updates)
 */
async function validateUniqueness(type, data, excludeId = null) {
  const uniqueFields = await getUniqueFields(type);
  
  if (uniqueFields.length === 0) {
    return { valid: true, errors: [] };
  }
  
  const errors = [];
  
  // Get all existing content of this type
  const allContent = await fileHandler.listContent(type, {});
  
  for (const fieldName of uniqueFields) {
    const fieldValue = data[fieldName];
    
    // Skip if field is not provided or is null/undefined
    if (fieldValue === undefined || fieldValue === null) {
      continue;
    }
    
    // Check if any other content item has the same value for this field
    const duplicate = allContent.data.find(item => {
      // Exclude the current item if we're updating
      if (excludeId && item.id === excludeId) {
        return false;
      }
      
      // Compare field values (case-insensitive for strings)
      const itemValue = item[fieldName];
      if (typeof fieldValue === 'string' && typeof itemValue === 'string') {
        return fieldValue.toLowerCase() === itemValue.toLowerCase();
      }
      return fieldValue === itemValue;
    });
    
    if (duplicate) {
      errors.push({
        message: `Field '${fieldName}' must be unique. A ${type} with ${fieldName}='${fieldValue}' already exists.`,
        path: `/${fieldName}`,
        field: fieldName,
        value: fieldValue
      });
    }
  }
  
  if (errors.length > 0) {
    return {
      valid: false,
      errors
    };
  }
  
  return { valid: true, errors: [] };
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
  validateUniqueness,
  getUniqueFields,
  loadSchema,
  clearCache
};

