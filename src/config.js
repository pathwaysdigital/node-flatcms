require('dotenv').config();
const path = require('path');

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  apiKey: process.env.API_KEY,
  contentDir: process.env.CONTENT_DIR || path.join(process.cwd(), 'content'),
  schemaFile: process.env.SCHEMA_FILE || path.join(process.cwd(), 'schema.json'),
  mediaDir: process.env.MEDIA_DIR || path.join(process.cwd(), 'content', 'media'),
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10 * 1024 * 1024, // 10MB default
  allowedMimeTypes: process.env.ALLOWED_MIME_TYPES ? process.env.ALLOWED_MIME_TYPES.split(',') : null, // null = allow all
  publicGetEnabled: process.env.PUBLIC_GET_ENABLED === 'true' || process.env.PUBLIC_GET_ENABLED === '1' // Allow GET requests without API key
};

if (!config.apiKey) {
  throw new Error('API_KEY environment variable is required. Please set it in your .env file.');
}

module.exports = config;

