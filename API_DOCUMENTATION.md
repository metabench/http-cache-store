# HTTP Cache Store API Documentation

## Table of Contents
- [Overview](#overview)
- [Installation](#installation)
- [Core Components](#core-components)
  - [BackEnd](#backend)
  - [Storage API](#storage-api)
  - [File Objects](#file-objects)
  - [SQLite Database Adapter](#sqlite-database-adapter)
- [Advanced Usage](#advanced-usage)
  - [Working with Binary Data](#working-with-binary-data)
  - [Handling Compression](#handling-compression)
  - [Error Handling](#error-handling)
  - [Cache Invalidation](#cache-invalidation)
- [Best Practices](#best-practices)
- [Example: Complete Workflow](#example-complete-workflow)

## Overview

HTTP Cache Store provides a resilient caching layer for HTTP requests and responses, supporting binary data, compression, and persistent storage.

## Installation

```bash
npm install http-cache-store
```

## Core Components

### BackEnd

The main entry point for interaction with the cache system.

```javascript
const BackEnd = require('http-cache-store');
const backend = new BackEnd({
  dbPath: './cache.sqlite', // Path to SQLite database file (optional, default: ':memory:')
  verbose: false            // Enable verbose logging (optional, default: false)
});

// Start the backend
await backend.start();
```

#### Constructor Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `dbPath` | String | No | `:memory:` | Path to SQLite database file or `:memory:` for in-memory database |
| `verbose` | Boolean | No | `false` | Enable detailed logging for debugging |

#### Methods

- **start()**: Initialize and connect to the database
- **shutdown({ deleteFile = false } = {})**: Close connections and optionally delete the database file
- **store_response(data)**: Store an HTTP response in the cache
- **get_cached_response(request)**: Retrieve a cached response
- **delete_cached_response(request)**: Delete a specific cached response
- **clear_cache()**: Clear all cached responses
- **count_files()**: Get total number of files in cache
- **count_requests()**: Get number of cached requests
- **count_responses()**: Get number of cached responses
- **count_cache_entries_by_url(url)**: Count cache entries that match a given URL
- **get_cache_entry_stored_at_timestamps_by_url(url)**: Get stored timestamps for cache entries matching a URL

#### Events

- **'ready'**: Emitted when the backend is fully initialized and ready for use
- **'error'**: Emitted when an error occurs with error details

### Storage API

#### Storing Responses

```javascript
await backend.store_response({
  method: 'GET',                        // HTTP method (required, string)
  url: 'https://example.com/api/data',  // Full URL (required, string)
  headers: {                            // Headers as object (optional)
    'content-type': 'application/json',
    'accept': 'application/json'
  },
  response_body: JSON.stringify({ id: 1, name: 'Example' }), // Response body (required, string or Buffer)
  status_code: 200,                     // HTTP status code (required, number)
  request_body: undefined               // Request body for POST/PUT (optional, string or Buffer)
});
```

##### Store Response Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `method` | String | Yes | HTTP method (GET, POST, PUT, etc.) |
| `url` | String | Yes | Full URL of the request |
| `headers` | Object | No | HTTP headers as key-value pairs |
| `response_body` | String or Buffer | Yes | Response content (use Buffer for binary data) |
| `status_code` | Number | Yes | HTTP status code |
| `request_body` | String or Buffer | No | Request body for POST/PUT requests |

#### Retrieving Responses

```javascript
const cachedResponse = await backend.get_cached_response({
  method: 'GET',                        // HTTP method (required, string)
  url: 'https://example.com/api/data'   // Full URL (required, string)
});

if (cachedResponse) {
  const content = cachedResponse.get_content();  // Returns Buffer
  const headers = cachedResponse.metadata.headers;
  const statusCode = cachedResponse.metadata.status_code;
  
  console.log('Content:', content.toString());
}
```

##### Get Cached Response Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `method` | String | Yes | HTTP method to match |
| `url` | String | Yes | URL to match |
| `request_body` | String or Buffer | No | For POST/PUT requests with a body |

#### Deleting Responses

```javascript
await backend.delete_cached_response({
  method: 'GET',                        // HTTP method (required, string)
  url: 'https://example.com/api/data'   // Full URL (required, string)
});
```

##### Delete Cached Response Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `method` | String | Yes | HTTP method to match |
| `url` | String | Yes | URL to match |
| `request_body` | String or Buffer | No | For POST/PUT requests with a body |

### File Objects

Cached responses are returned as File objects with these common methods and properties:

| Property/Method | Type | Description |
|-----------------|------|-------------|
| `get_content()` | Method | Returns the cached content as a Buffer |
| `is_platform_compressed` | Boolean | Indicates if content is compressed |
| `mime_type` | String | Content MIME type if available |
| `original_size` | Number | Size of content before compression (if compressed) |
| `metadata` | Object | Contains details about the cached response |

### SQLite Database Adapter

The SQLite adapter provides persistent storage for the cache.

```javascript
const HTTP_Cache_Store_DB_Adapter_SQLite = require('http-cache-store/storage/db/adapter/HTTP_Cache_Store_DB_Adapter_SQLite');

const adapter = new HTTP_Cache_Store_DB_Adapter_SQLite({
  db_path: './cache.sqlite',  // Path to SQLite database file (optional, default: ':memory:')
  verbose: false              // Enable verbose logging (optional, default: false)
});

await adapter.connect();  // Establish connection to the database
```

### Constructor Options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `db_path` | String | No | `:memory:` | Path to SQLite database file or `:memory:` for in-memory database |
| `verbose` | Boolean | No | `false` | Enable detailed logging for debugging |

### Methods

- **connect()**: Connects to the SQLite database and initializes schema
- **disconnect()**: Closes the database connection
- **store_request_response(file)**: Stores a file object in the database
- **get_cached_response(request_details)**: Retrieves a cached response by hash
- **delete_cached_response(request_details)**: Deletes a cached response
- **clear_cache()**: Clears all cached data
- **deleteFile()**: Deletes the database file and its associated WAL/SHM files

### Database Schema

The SQLite adapter uses a two-table design:

1. **cache_entries**: Stores request/response metadata and relationships
   - `id`: Primary key
   - `request_method`: HTTP method (e.g., GET, POST)
   - `request_url`: Full URL of the request
   - `request_hash`: Hash of the request (used as lookup key)
   - `request_headers`: Serialized request headers
   - `request_body_hash`: Hash of request body (for POST/PUT)
   - `response_hash`: Hash of the response
   - `response_status`: HTTP status code
   - `response_headers`: Serialized response headers
   - `stored_at`: Timestamp when the entry was stored
   - `last_accessed`: Timestamp when the entry was last accessed
   - `metadata`: Additional JSON metadata

2. **bodies**: Stores the actual content with optional compression
   - `hash`: Primary key, matches with hashes in cache_entries
   - `content`: The actual content data (as BLOB)
   - `mime_type`: Content MIME type
   - `platform_compression_algo`: Algorithm used for compression
   - `is_platform_compressed`: Whether the content is compressed
   - `original_size`: Size before compression
   - `stored_at`: Timestamp when the content was stored

## Advanced Usage

### Working with Binary Data

When working with binary data, always use Buffer:

```javascript
// Storing binary data
await backend.store_response({
  method: 'GET',
  url: 'https://example.com/image.png',
  headers: { 'content-type': 'image/png' },
  response_body: binaryBuffer, // Buffer containing the image data
  status_code: 200
});

// Retrieving binary data
const response = await backend.get_cached_response({
  method: 'GET',
  url: 'https://example.com/image.png'
});

if (response) {
  const imageBuffer = response.get_content();
  // imageBuffer is a Buffer - don't convert to string for binary data
}
```

### Handling Compression

The library automatically manages compression based on content type:

- Text-based formats (HTML, CSS, JS, JSON, XML) are compressed
- Already-compressed formats (JPEG, PNG, GIF, ZIP) are stored as-is
- Compression is transparent to the API user - you always get the original content

### Error Handling

Handle errors with try/catch blocks:

```javascript
try {
  await backend.store_response({
    method: 'GET',
    url: 'https://example.com/api/data',
    response_body: 'test data',
    status_code: 200
  });
} catch (error) {
  console.error('Cache storage error:', error.message);
}
```

Listen for error events:

```javascript
backend.on('error', (error) => {
  console.error('Cache system error:', error);
});
```

### Cache Invalidation

Clear specific entries:

```javascript
// Delete a specific entry
await backend.delete_cached_response({
  method: 'GET',
  url: 'https://example.com/api/data'
});

// Clear the entire cache
await backend.clear_cache();
```

## Best Practices

1. **Always check for null** when retrieving cached responses
2. **Use Buffer.isBuffer()** to safely handle both text and binary responses
3. **Call backend.shutdown()** when your application exits to clean up resources
4. **Avoid implementation details** in your code - interact only through the public API
5. **Provide complete request information** when retrieving responses for accurate cache hits
6. **Include content-type headers** to ensure proper handling of different data formats

## Example: Complete Workflow

```javascript
const BackEnd = require('http-cache-store');

async function example() {
  const backend = new BackEnd();
  
  try {
    await backend.start();
    
    // Store a response
    await backend.store_response({
      method: 'GET',
      url: 'https://example.com/api/data',
      headers: { 'content-type': 'application/json' },
      response_body: '{"result": "success"}',
      status_code: 200
    });
    
    // Retrieve it
    const cached = await backend.get_cached_response({
      method: 'GET',
      url: 'https://example.com/api/data'
    });
    
    if (cached) {
      console.log('Found cached response:', cached.get_content().toString());
    }
    
    // Delete when no longer needed
    await backend.delete_cached_response({
      method: 'GET',
      url: 'https://example.com/api/data'
    });
  } finally {
    // Always clean up
    await backend.shutdown();
  }
}

example().catch(console.error);
```

