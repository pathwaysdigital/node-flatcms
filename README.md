# FlatCMS

A simple headless flat file CMS powered by JSON and JavaScript. Perfect for powering the content layer of simple static websites.

## Features

- **Flat File Storage**: Content stored as JSON files, organized by type
- **JSON Schema Validation**: Validate content structure using standard JSON Schema
- **REST API**: Full CRUD operations via REST endpoints
- **Query & Filtering**: Advanced query system with filtering, sorting, and search
- **Pagination**: Built-in pagination support for large content sets
- **Draft/Published Workflow**: Content status management with automatic timestamps
- **Content Versioning**: Automatic version history with restore capability
- **Content Organization**: Tags, categories, and content relations
- **Media Management**: File upload and management with metadata
- **API Key Authentication**: Simple API key-based authentication
- **Public GET Option**: Optional public read access for GET endpoints
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
PUBLIC_GET_ENABLED=false
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
        "status": { "type": "string", "enum": ["draft", "published", "archived"] },
        "tags": { "type": "array", "items": { "type": "string" } },
        "category": { "type": "string" }
      },
      "required": ["title", "content"]
    },
    "page": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "slug": { "type": "string" },
        "body": { "type": "string" },
        "status": { "type": "string", "enum": ["draft", "published", "archived"] }
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
- `PUBLIC_GET_ENABLED` (optional, default: `false`): Set to `true` or `1` to allow GET requests without API key
- `MEDIA_DIR` (optional, default: `./content/media`): Directory where media files are stored
- `MAX_FILE_SIZE` (optional, default: `10485760`): Maximum file size in bytes (10MB default)
- `ALLOWED_MIME_TYPES` (optional): Comma-separated list of allowed MIME types (e.g., `image/jpeg,image/png,image/gif`). If not set, all types are allowed.

## Content Storage

Content is stored as JSON files in the following structure:

```
content/
├── post/
│   ├── <id>.json
│   ├── <id>/
│   │   └── versions/
│   │       └── v<timestamp>.json
│   └── <id>.json
├── page/
│   └── <id>.json
└── media/
    └── <type>/
        ├── <filename>
        └── <filename>.meta.json
```

Each content file automatically includes:
- `id`: Unique identifier (auto-generated if not provided)
- `status`: Content status (draft, published, archived) - defaults to "draft"
- `createdAt`: ISO timestamp when created
- `updatedAt`: ISO timestamp when last updated
- `publishedAt`: ISO timestamp when status was set to "published" (if applicable)

## API Endpoints

### Authentication

By default, all API endpoints require authentication via API key. Include the API key in one of these ways:

- `Authorization: Bearer <API_KEY>` header
- `X-API-Key: <API_KEY>` header

**Note**: If `PUBLIC_GET_ENABLED=true` is set in your `.env` file, all GET requests become public (no API key required). Write operations (POST, PUT, DELETE) always require authentication.

### Content Endpoints

#### List Content

Get all content items of a specific type with optional filtering, sorting, and pagination.

```http
GET /api/content/:type
```

**Query Parameters:**
- `field=value` - Filter by field equality
- `field__gt=value` - Filter where field is greater than value
- `field__lt=value` - Filter where field is less than value
- `field__gte=value` - Filter where field is greater than or equal to value
- `field__lte=value` - Filter where field is less than or equal to value
- `field__ne=value` - Filter where field is not equal to value
- `field__in=value1,value2,value3` - Filter where field is in array of values
- `field__contains=text` - Filter where field contains text (case-insensitive)
- `search=text` - Full-text search across all string fields
- `status=published` - Filter by status (draft, published, archived)
- `sort=field` - Sort by field (ascending)
- `sort=-field` - Sort by field (descending)
- `limit=10` - Limit number of results
- `offset=0` - Offset for pagination

**Example:**
```bash
curl -H "Authorization: Bearer your-api-key" \
  "http://localhost:3000/api/content/post?status=published&sort=-createdAt&limit=10"
```

**Response:**
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "title": "My First Post",
      "content": "This is the content...",
      "status": "published",
      "publishedAt": "2024-01-01T00:00:00.000Z",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

#### Get Single Content

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
  "status": "published",
  "publishedAt": "2024-01-01T00:00:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### Create Content

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
  -d '{"title": "New Post", "content": "Post content", "status": "published"}' \
  http://localhost:3000/api/content/post
```

**Response:** (201 Created)
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "New Post",
  "content": "Post content",
  "status": "published",
  "publishedAt": "2024-01-01T00:00:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### Update Content

Update an existing content item. Automatically creates a version snapshot before updating.

```http
PUT /api/content/:type/:id
Content-Type: application/json
```

**Example:**
```bash
curl -X PUT \
  -H "Authorization: Bearer your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title", "status": "archived"}' \
  http://localhost:3000/api/content/post/123e4567-e89b-12d3-a456-426614174000
```

**Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Updated Title",
  "content": "Post content",
  "status": "archived",
  "publishedAt": "2024-01-01T00:00:00.000Z",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-02T00:00:00.000Z"
}
```

#### Delete Content

Delete a content item and all its versions.

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

#### List Versions

Get all version history for a content item.

```http
GET /api/content/:type/:id/versions
```

**Example:**
```bash
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:3000/api/content/post/123e4567-e89b-12d3-a456-426614174000/versions
```

**Response:**
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Previous Title",
    "content": "Previous content...",
    "versionId": "v2024-01-01T12-00-00-000Z",
    "versionedAt": "2024-01-01T12:00:00.000Z",
    "status": "published",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T12:00:00.000Z"
  }
]
```

#### Get Version

Get a specific version by versionId.

```http
GET /api/content/:type/:id/versions/:versionId
```

**Example:**
```bash
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:3000/api/content/post/123e4567-e89b-12d3-a456-426614174000/versions/v2024-01-01T12-00-00-000Z
```

#### Restore Version

Restore a content item to a previous version.

```http
POST /api/content/:type/:id/restore/:versionId
```

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer your-api-key" \
  http://localhost:3000/api/content/post/123e4567-e89b-12d3-a456-426614174000/restore/v2024-01-01T12-00-00-000Z
```

**Response:**
```json
{
  "message": "Content item post/123e4567-e89b-12d3-a456-426614174000 restored to version v2024-01-01T12-00-00-000Z",
  "content": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "title": "Previous Title",
    "content": "Previous content...",
    "status": "published",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-02T00:00:00.000Z"
  }
}
```

#### Get Related Content

Get content items related to a specific item (by tags, categories, or relations).

```http
GET /api/content/:type/:id/related
```

**Query Parameters:**
- `limit=10` - Limit number of results
- `offset=0` - Offset for pagination

**Example:**
```bash
curl -H "Authorization: Bearer your-api-key" \
  "http://localhost:3000/api/content/post/123e4567-e89b-12d3-a456-426614174000/related?limit=5"
```

**Response:**
```json
{
  "data": [
    {
      "id": "456e7890-e89b-12d3-a456-426614174001",
      "title": "Related Post",
      "content": "Related content...",
      "status": "published",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "total": 3,
    "limit": 5,
    "offset": 0,
    "hasMore": false
  }
}
```

### Media Endpoints

#### Upload Media

Upload a media file.

```http
POST /api/media/upload
Content-Type: multipart/form-data
```

**Form Data:**
- `file` (required): The file to upload
- `type` (optional): Media type/category (default: 'general')

**Example:**
```bash
curl -X POST \
  -H "Authorization: Bearer your-api-key" \
  -F "file=@image.jpg" \
  -F "type=images" \
  http://localhost:3000/api/media/upload
```

**Response:** (201 Created)
```json
{
  "id": "789e0123-e89b-12d3-a456-426614174002",
  "originalName": "image.jpg",
  "filename": "a1b2c3d4-e89b-12d3-a456-426614174003.jpg",
  "type": "images",
  "mimeType": "image/jpeg",
  "size": 123456,
  "path": "/path/to/content/media/images/a1b2c3d4-e89b-12d3-a456-426614174003.jpg",
  "url": "/api/media/images/a1b2c3d4-e89b-12d3-a456-426614174003.jpg",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### List Media

List all media files (optionally filtered by type).

```http
GET /api/media
```

**Query Parameters:**
- `type` (optional): Filter by media type

**Example:**
```bash
curl -H "Authorization: Bearer your-api-key" \
  "http://localhost:3000/api/media?type=images"
```

#### Get Media Metadata

Get metadata for a specific media file.

```http
GET /api/media/:type/:filename
```

**Example:**
```bash
curl -H "Authorization: Bearer your-api-key" \
  http://localhost:3000/api/media/images/a1b2c3d4-e89b-12d3-a456-426614174003.jpg
```

#### Serve Media File

Get the actual media file (public endpoint, no authentication required).

```http
GET /api/media/:type/:filename/file
```

**Example:**
```bash
curl http://localhost:3000/api/media/images/a1b2c3d4-e89b-12d3-a456-426614174003.jpg/file
```

#### Delete Media

Delete a media file and its metadata.

```http
DELETE /api/media/:type/:filename
```

**Example:**
```bash
curl -X DELETE \
  -H "Authorization: Bearer your-api-key" \
  http://localhost:3000/api/media/images/a1b2c3d4-e89b-12d3-a456-426614174003.jpg
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

## License

ISC
