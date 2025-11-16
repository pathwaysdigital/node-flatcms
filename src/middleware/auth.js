const config = require('../config');

/**
 * API key authentication middleware
 * Supports both Authorization: Bearer <API_KEY> and X-API-Key: <API_KEY> headers
 */
function authMiddleware(req, res, next) {
  let apiKey = null;
  
  // Try Authorization Bearer header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.substring(7);
  }
  
  // Fall back to X-API-Key header
  if (!apiKey) {
    apiKey = req.headers['x-api-key'];
  }
  
  // Check if API key is provided and matches
  if (!apiKey) {
    return res.status(401).json({
      error: 'Authentication required. Please provide API key via Authorization: Bearer <API_KEY> or X-API-Key header.'
    });
  }
  
  if (apiKey !== config.apiKey) {
    return res.status(401).json({
      error: 'Invalid API key.'
    });
  }
  
  next();
}

module.exports = authMiddleware;

