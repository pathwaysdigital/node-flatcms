# FlatCMS

A simple headless flat file CMS powered by JSON and JavaScript. Perfect for powering the content layer of simple static websites.

## Features

- **Flat File Storage**: Content stored as JSON files, organized by type
- **JSON Schema Validation**: Validate content structure using standard JSON Schema
- **Field Uniqueness**: Enforce unique values for specific fields (e.g., slugs)
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
- **Browser Admin UI**: PicoCSS-powered UI for managing entries without Postman

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
        "slug": { "type": "string", "unique": true },
        "body": { "type": "string" },
        "status": { "type": "string", "enum": ["draft", "published", "archived"] }
      },
      "required": ["title", "slug"]
    }
  }
}
```

**Field Uniqueness**: Add `"unique": true` to any field property to enforce uniqueness across all content items of that type. For example, the `slug` field in the `page` type above ensures that no two pages can have the same slug. Uniqueness validation is case-insensitive for string fields (e.g., "MySlug" and "myslug" are considered duplicates).

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

### 4. Use the Admin UI

Once the server is running, visit `http://localhost:3000/admin` to open the lightweight admin console. Enter your API key and the FlatCMS base URL (defaults to the current origin), click **Save Credentials**, and the UI will load all content types defined in `schema.json`. From there you can:

- Browse entries with search, status filters, and pagination
- Create, edit, and delete content for any schema type
- Automatically render form controls based on the schema (enums, arrays, booleans, etc.)
- View metadata fields such as ID, status, created/updated timestamps

Credentials are stored only in your browser's `localStorage`. API calls are still protected by the standard API key mechanism (unless you explicitly enable public GET access).

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
- `ADMIN_UI_BASE_URL` (optional): Not required, but you can proxy `/admin` through another server if desired; by default FlatCMS serves `public/` assets directly.

## Admin UI Overview

- Served automatically from the `public/` directory (no build step required). `GET /admin` returns the PicoCSS dashboard, and all static assets live under `/public/admin`.
- The dashboard consumes a new helper endpoint, `GET /api/schema`, which exposes the parsed `schema.json` plus metadata about each content type (required fields, unique fields, etc.).
- CRUD actions use the existing REST endpoints; the UI simply orchestrates them. You still get schema validation, uniqueness enforcement, versioning, and everything else provided by the API.
- The dashboard is intentionally simple—pure HTML/JS/CSS—so you can customize it or embed it elsewhere if needed. Feel free to drop additional static assets into `public/` and serve them alongside the admin.

### Richtext fields

Add `"type": "richtext"` to any property in your schema to render a lightweight WYSIWYG editor in the admin UI. The editor includes the usual basics (bold, italic, underline, unordered/ordered lists) and stores the resulting HTML alongside your other fields. Example:

```json
{
  "definitions": {
    "page": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "slug": { "type": "string", "unique": true },
        "body": { "type": "richtext" }
      },
      "required": ["title", "slug"]
    }
  }
}
```

If the field is required, keep `"body"` inside the `required` array—the admin form will enforce it. Clearing the editor will send an empty string, so updates can remove content if needed.

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

### Schema

- `GET /api/schema`: Returns the full `schema.json` plus derived metadata (list of content types, required fields, unique fields, etc.). Used by the admin UI but also handy for tooling/automation.

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

Create a new content item. The content will be validated against the schema, and uniqueness constraints will be checked for fields marked as `unique: true` in the schema.

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

**Error Response:** (409 Conflict) - If a unique field value already exists:
```json
{
  "error": "Uniqueness validation failed",
  "details": [
    {
      "message": "Field 'slug' must be unique. A page with slug='my-page' already exists.",
      "path": "/slug",
      "field": "slug",
      "value": "my-page"
    }
  ]
}
```

#### Update Content

Update an existing content item. Automatically creates a version snapshot before updating. Uniqueness constraints are validated (excluding the current item).

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

**Error Response:** (409 Conflict) - If updating would violate a uniqueness constraint:
```json
{
  "error": "Uniqueness validation failed",
  "details": [
    {
      "message": "Field 'slug' must be unique. A page with slug='existing-slug' already exists.",
      "path": "/slug",
      "field": "slug",
      "value": "existing-slug"
    }
  ]
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
- `409`: Conflict (content with ID already exists, or uniqueness constraint violation)
- `500`: Internal Server Error

## Programmatic Usage

```javascript
const app = require('flatcms');

// App is an Express instance, can be used in your own server setup
app.listen(3000, () => {
  console.log('Custom server running');
});
```

## Testing the Admin UI

1. Start FlatCMS locally (`npm start` or `npx flatcms`) with a valid `.env` file that includes `API_KEY`, `CONTENT_DIR`, and `SCHEMA_FILE`.
2. Visit `http://localhost:3000/admin`, enter the API key and base URL (defaults to the same origin), and click **Save Credentials**.
3. Verify that the content types defined in `schema.json` appear in the selector, and that you can create/edit/delete entries end-to-end. Changes should immediately reflect in the underlying JSON files and respect schema validation as well as uniqueness rules.
4. (Optional) Toggle `PUBLIC_GET_ENABLED=true` if you want to browse content without providing the API key—write operations still need authentication.

## License

ISC
