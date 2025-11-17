const Ajv = require('ajv');
const fs = require('fs-extra');
const path = require('path');
const config = require('../config');
const fileHandler = require('./fileHandler');

let schemaCache = null;
let normalizedSchemaCache = null;
let ajvInstance = null;

function clone(value) {
  if (Array.isArray(value)) {
    return value.map(clone);
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, val]) => {
      acc[key] = clone(val);
      return acc;
    }, {});
  }
  return value;
}

function normalizeType(type) {
  if (typeof type === 'string') {
    return type === 'richtext' ? 'string' : type;
  }
  if (Array.isArray(type)) {
    return type.map(t => (t === 'richtext' ? 'string' : t));
  }
  return type;
}

function normalizeSchemaNode(node) {
  if (Array.isArray(node)) {
    return node.map(normalizeSchemaNode);
  }
  if (node && typeof node === 'object') {
    const normalized = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === 'type') {
        normalized[key] = normalizeType(value);
      } else {
        normalized[key] = normalizeSchemaNode(value);
      }
    }
    return normalized;
  }
  return node;
}

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
    normalizedSchemaCache = normalizeSchemaNode(schemaCache);
    return schemaCache;
  } catch (error) {
    throw new Error(`Failed to load schema file: ${error.message}`);
  }
}

function getNormalizedSchema() {
  return normalizedSchemaCache || null;
}

function resolveSchemaDefinition(schema, type) {
  if (!schema) return null;
  if (schema.definitions && schema.definitions[type]) {
    return schema.definitions[type];
  }
  if (schema[type]) {
    return schema[type];
  }
  return null;
}

/**
 * Initialize AJV instance with schema
 */
async function getValidator() {
  if (ajvInstance) {
    return ajvInstance;
  }
  
  const schema = await loadSchema();
  const normalizedSchema = getNormalizedSchema() || normalizeSchemaNode(schema);
  ajvInstance = new Ajv();
  
  // If schema has definitions, compile them
  if (normalizedSchema.definitions) {
    Object.keys(normalizedSchema.definitions).forEach(key => {
      ajvInstance.addSchema(normalizedSchema.definitions[key], `#/definitions/${key}`);
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
  
  schemaDefinition = resolveSchemaDefinition(schema, type);
  if (!schemaDefinition) {
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
  const normalizedSchema = getNormalizedSchema();
  
  // Try to find schema definition for the content type
  const schemaDefinition = resolveSchemaDefinition(schema, type);
  const normalizedDefinition = resolveSchemaDefinition(normalizedSchema, type);

  if (!schemaDefinition) {
    return {
      valid: false,
      errors: [{ message: `No schema definition found for content type: ${type}` }]
    };
  }
  
  // Validate the data
  const validate = ajv.compile(normalizedDefinition || normalizeSchemaNode(schemaDefinition));
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
  normalizedSchemaCache = null;
  ajvInstance = null;
}

module.exports = {
  validateContent,
  validateUniqueness,
  getUniqueFields,
  loadSchema,
  clearCache,
  getNormalizedSchema // exported for testing if needed
};

