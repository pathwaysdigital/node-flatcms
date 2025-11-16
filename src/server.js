const express = require('express');
const config = require('./config');
const authMiddleware = require('./middleware/auth');
const contentRoutes = require('./routes/content');

const app = express();

// Middleware
app.use(express.json());

// Apply authentication middleware to all API routes
app.use('/api', authMiddleware);

// Routes
app.use('/api/content', contentRoutes);

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path
  });
});

/**
 * Start the server
 */
function startServer() {
  const server = app.listen(config.port, () => {
    console.log(`FlatCMS server running on port ${config.port}`);
    console.log(`Content directory: ${config.contentDir}`);
    console.log(`Schema file: ${config.schemaFile}`);
  });
  
  return server;
}

module.exports = app;
module.exports.startServer = startServer;

// If this file is run directly, start the server
if (require.main === module) {
  startServer();
}

