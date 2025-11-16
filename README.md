# FlatCMS

A simple headless flat file CMS powered by JSON and JavaScript. Perfect for powering the content layer of simple static websites.

## Features

- **Flat File Storage**: Content stored as JSON files, organized by type
- **JSON Schema Validation**: Validate content structure using standard JSON Schema
- **REST API**: Full CRUD operations via REST endpoints
- **API Key Authentication**: Simple API key-based authentication
- **Zero Database**: No database required - just files and configuration

## Installation

Install via npm:

```bash
npm install flatcms
```

Or install globally to use as a CLI command:

```bash
npm install -g flatcms
```

## Quick Start

### 1. Create a `.env` file

```env
API_KEY=your-secret-api-key-here
PORT=3000
CONTENT_DIR=./content
SCHEMA_FILE=./schema.json
```

### 2. Create a schema file (`schema.json`)

Define your content types using JSON Schema:

```json
{
  "definitions": {
    "post": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "content": { "type": "string" },
        "published": { "type": "boolean" }
      },
      "required": ["title", "content"]
    },
    "page": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "slug": { "type": "string" },
        "body": { "type": "string" }
      },
      "required": ["title", "slug"]
    }
  }
}
```

### 3. Start the server

If installed locally:
```bash
npm start
# or
npx flatcms
```

If installed globally:
```bash
flatcms
```

Or programmatically:

```javascript
const app = require('flatcms');

// App is an Express instance, start it programmatically
const { startServer } = require('flatcms');
startServer();
```

## Configuration

Environment variables:

- `API_KEY` (required): API key for authenticating requests
- `PORT` (optional, default: `3000`): Port number for the server
- `CONTENT_DIR` (optional, default: `./content`): Directory where content JSON files are stored
- `SCHEMA_FILE` (optional, default: `./schema.json`): Path to the JSON Schema file

## Content Storage

Content is stored as JSON files in the following structure:

```
content/
├── post/
│   ├── <id>.json
│   └── <id>.json
└── page/
    ├── <id>.json
    └── <id>.json
```

Each content file automatically includes:
- `id`: Unique identifier (auto-generated if not provided)
- `createdAt`: ISO timestamp when created
- `updatedAt`: ISO timestamp when last updated

## API Endpoints

All API endpoints require authentication via API key. Include the API key in one of these ways:

- `Authorization: Bearer <API_KEY>` header
- `X-API-Key: <API_KEY>` header

### List Content

Get all content items of a specific type.

```http
GET /api/content/:type
```

**Example:**
```bash
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:3000/api/content/post
```

**Response:**
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "My First Post",
    "content": "This is the content...",
    "published": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

### Get Single Content

Get a specific content item by ID.

```http
GET /api/content/:type/:id
```

**Example:**
```bash
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:3000/api/content/post/123e4567-e89b-12d3-a456-426614174000
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "My First Post",
  "content": "This is the content...",
  "published": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Create Content

Create a new content item.

```http
POST /api/content/:type
Content-Type: application/json
```

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"title": "New Post", "content": "Post content", "published": true}' \
  http://localhost:3000/api/content/post
```

**Response:** (201 Created)
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "New Post",
  "content": "Post content",
  "published": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### Update Content

Update an existing content item.

```http
PUT /api/content/:type/:id
Content-Type: application/json
```

**Example:**
```bash
curl -X PUT \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title", "published": false}' \
  http://localhost:3000/api/content/post/123e4567-e89b-12d3-a456-426614174000
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Updated Title",
  "content": "Post content",
  "published": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-02T00:00:00.000Z"
}
```

### Delete Content

Delete a content item.

```http
DELETE /api/content/:type/:id
```

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer your-api-key" \
  http://localhost:3000/api/content/post/123e4567-e89b-12d3-a456-426614174000
```

**Response:**
```json
{
  "message": "Content item post/123e4567-e89b-12d3-a456-426614174000 deleted successfully"
}
```

### Health Check

Check if the server is running (no authentication required).

```http
GET /health
```

**Response:**
```json
{
  "status": "ok"
}
```

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Error message",
  "details": [] // Optional, includes validation errors or additional details
}
```

Common status codes:
- `400`: Bad Request (validation errors)
- `401`: Unauthorized (invalid or missing API key)
- `404`: Not Found (content item doesn't exist)
- `409`: Conflict (content with ID already exists)
- `500`: Internal Server Error

## Programmatic Usage

```javascript
const app = require('flatcms');

// App is an Express instance, can be used in your own server setup
app.listen(3000, () => {
  console.log('Custom server running');
});
```

## Publishing to npm

If you want to publish your own version of this package to npm:

1. **Update package.json**:
   - Update the `name` field (e.g., `@yourusername/flatcms` for scoped packages)
   - Update `version` following semantic versioning
   - Add `repository`, `bugs`, and `homepage` URLs if applicable
   - Add `author` information

2. **Login to npm**:
   ```bash
   npm login
   ```

3. **Publish**:
   ```bash
   npm publish
   ```

   For scoped packages (if using `@yourusername/flatcms`):
   ```bash
   npm publish --access public
   ```

4. **Verify**:
   ```bash
   npm view flatcms
   ```

## License

ISC

