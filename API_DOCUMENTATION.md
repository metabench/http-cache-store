# HTTP Cache Store API Documentation

## Table of Contents
- [Overview](#overview)
- [Installation](#installation)
- [Core Components](#core-components)
  - [BackEnd](#backend)
  - [Storage API](#storage-api)
  - [File Objects](#file-objects)
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
  dbPath: './cache.sqlite', // Path to SQLite database file
  verbose: false            // Enable verbose logging
});

// Start the backend
await backend.start();
```

#### Methods

- **start()**: Initialize and connect to the database
- **shutdown({ deleteFile = false } = {})**: Close connections and optionally delete the database file
- **storeResponse(data)**: Store an HTTP response in the cache
- **getCachedResponse(request)**: Retrieve a cached response
- **deleteCachedResponse(request)**: Delete a specific cached response
- **clearCache()**: Clear all cached responses

#### Events

- **'ready'**: Emitted when the backend is fully initialized and ready for use
- **'error'**: Emitted when an error occurs with error details

### Storage API

#### Storing Responses

```javascript
await backend.storeResponse({
  method: 'GET',                        // HTTP method
  url: 'https://example.com/api/data',  // Full URL
  headers: {                            // Headers as object
    'content-type': 'application/json',
    'accept': 'application/json'
  },
  response_body: JSON.stringify({ id: 1, name: 'Example' }),
  status_code: 200                      // HTTP status code
});
```

For POST requests with a body:

```javascript
await backend.storeResponse({
  method: 'POST',
  url: 'https://example.com/api/submit',
  request_body: JSON.stringify({ data: 'to submit' }),
  headers: { 'content-type': 'application/json' },
  response_body: '{"success":true}',
  status_code: 201
});
```

#### Retrieving Responses

```javascript
const cachedResponse = await backend.getCachedResponse({
  method: 'GET',
  url: 'https://example.com/api/data'
});

if (cachedResponse) {
  const content = cachedResponse.get_content();
  const headers = cachedResponse.metadata.headers;
  const statusCode = cachedResponse.metadata.status_code;
  
  console.log('Content:', content.toString());
}
```

#### Deleting Responses

```javascript
await backend.deleteCachedResponse({
  method: 'GET',
  url: 'https://example.com/api/data'
});
```

### File Objects

Cached responses are returned as File objects with these common methods:

- **get_content()**: Returns the cached content as a Buffer
- **is_platform_compressed**: Boolean property indicating if content is compressed
- **metadata**: Object containing details about the cached response

## Advanced Usage

### Working with Binary Data

When working with binary data, always use Buffer:

```javascript
// Storing binary data
await backend.storeResponse({
  method: 'GET',
  url: 'https://example.com/image.png',
  headers: { 'content-type': 'image/png' },
  response_body: binaryBuffer, // Buffer containing the image data
  status_code: 200
});

// Retrieving binary data
const response = await backend.getCachedResponse({
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
  await backend.storeResponse({
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
await backend.deleteCachedResponse({
  method: 'GET',
  url: 'https://example.com/api/data'
});

// Clear the entire cache
await backend.clearCache();
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
    await backend.storeResponse({
      method: 'GET',
      url: 'https://example.com/api/data',
      headers: { 'content-type': 'application/json' },
      response_body: '{"result": "success"}',
      status_code: 200
    });
    
    // Retrieve it
    const cached = await backend.getCachedResponse({
      method: 'GET',
      url: 'https://example.com/api/data'
    });
    
    if (cached) {
      console.log('Found cached response:', cached.get_content().toString());
    }
    
    // Delete when no longer needed
    await backend.deleteCachedResponse({
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

