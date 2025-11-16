require('dotenv').config();
const path = require('path');

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  apiKey: process.env.API_KEY,
  contentDir: process.env.CONTENT_DIR || path.join(process.cwd(), 'content'),
  schemaFile: process.env.SCHEMA_FILE || path.join(process.cwd(), 'schema.json')
};

if (!config.apiKey) {
  throw new Error('API_KEY environment variable is required. Please set it in your .env file.');
}

module.exports = config;

