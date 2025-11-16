#!/usr/bin/env node

const app = require('./src/server');
const { startServer } = require('./src/server');

// Export the app and startServer for programmatic use
module.exports = app;
module.exports.startServer = startServer;

// If run directly (via npm start, flatcms, or node index.js), start the server
if (require.main === module) {
  startServer();
}

