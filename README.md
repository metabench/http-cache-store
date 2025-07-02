# HTTP Cache Store

A flexible, extensible HTTP response caching system with support for compression and multiple storage backends.

## Features

- **Cross-request caching**: Store and retrieve HTTP responses with efficient cache entries
- **Request body support**: Cache and retrieve both GET and POST/PUT requests with bodies
- **Platform compression**: Automatic content compression based on MIME type and size
- **Extensible storage**: Modular design with support for multiple database backends (SQLite included)
- **Event-based architecture**: Subscribe to cache events (hits, misses, errors)
- **Binary data support**: Properly handles images, audio, and other binary content
- **Resource management**: Proper cleanup with database connection closing and file removal
- **Cache statistics**: Easy access to cache usage metrics for entries, requests, and responses

## Installation

```bash
npm install http-cache-store
```

## Quick Start

```javascript
const { BackEnd } = require('http-cache-store');

async function main() {
  // Create a cache instance with default settings (SQLite in-memory)
  const backend = new BackEnd();
  
  // Initialize the cache
  await backend.start();

  try {
    // Store a simple GET response
    await backend.store_response({
      method: 'GET',
      url: 'https://example.com/api/data',
      headers: { 'content-type': 'application/json' },
      response_body: JSON.stringify({ key: 'value' }),
      status_code: 200
    });

    // Store a POST request with a request body
    await backend.store_response({
      method: 'POST',
      url: 'https://example.com/api/submit',
      headers: { 
        'content-type': 'application/json',
        'accept': 'application/json'
      },
      request_body: JSON.stringify({ name: 'Example', value: 42 }),
      response_body: JSON.stringify({ success: true, id: 123 }),
      status_code: 201
    });

    // Retrieve a cached response
    const cachedResponse = await backend.get_cached_response({
      method: 'GET',
      url: 'https://example.com/api/data'
    });

    if (cachedResponse) {
      console.log('Cache hit!', cachedResponse.get_content().toString());
      console.log('Is platform compressed:', cachedResponse.is_platform_compressed);
      console.log('MIME type:', cachedResponse.mime_type);
    } else {
      console.log('Cache miss!');
    }
    
    // Get cache statistics
    const fileCount = await backend.count_files();
    const responseCount = await backend.count_responses();
    console.log(`Cache contains ${fileCount} files, including ${responseCount} responses`);
  } finally {
    // Always properly shutdown to close database connections
    await backend.shutdown();
  }
}

main().catch(console.error);
```

## Architecture

HTTP Cache Store uses a layered architecture with a new cache entry system:

1. **BackEnd**: Main entry point and API for application integration
2. **Storage Adapter**: Manages the caching process with compression
3. **Database Adapters**: Interface with storage backends using cache entries
4. **File Classes**: Handle content representation with or without platform compression

### Database Structure

The system uses a two-table design that separates metadata from content:

- **cache_entries**: Stores request/response metadata and relationships
- **bodies**: Stores the actual content with optional platform compression

This design enables efficient lookups, content deduplication, and separation of concerns.

## Caching Mechanism

The system uses SHA-256 hashes of the request method and URL as cache keys. Both request bodies and response bodies can be stored and retrieved efficiently.

### Key Features in v1.x

- New cache entry system for better organization and performance
- Updated terminology to distinguish platform compression from content compression
- Full support for request bodies in POST/PUT methods
- Improved storage efficiency with content deduplication

## Testing

Run the tests with:

```bash
npm test
```

Unit tests validate core functionality while integration tests ensure the entire pipeline works correctly.

## License

MIT
