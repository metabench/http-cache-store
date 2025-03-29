# Database Module for http-cache-store

## Introduction

The `/db` module is the data persistence layer of the http-cache-store system, responsible for efficiently storing, retrieving, and managing HTTP cache data. It implements a sophisticated normalized database schema with content deduplication, compression, and versioning capabilities.

### Core Functionality

This module provides:

1. **Abstracted Database Access**: Through adapter interfaces that allow swapping between SQLite and potentially other backends without changing client code.

2. **Content-Aware Compression**: Data is intelligently compressed based on MIME type, content size, and potential compression benefit.

3. **Cache Validation Framework**: Support for HTTP caching standards including ETags, Last-Modified headers, and Cache-Control directives.

4. **Event-Driven Architecture**: All operations emit events that can be observed for metrics, logging, or custom behavior.

5. **Storage Optimization**: Automatic content deduplication ensures the same response body is only stored once regardless of how many requests reference it.

### Design Philosophy

The module follows these key principles:

- **Separation of Concerns**: Each component has a clearly defined role in the storage pipeline.
- **Immutable Data Model**: Content is identified by secure hashes and never modified after storage.
- **Extensibility**: Record classes and adapters can be extended with custom behavior.
- **Performance Focus**: Schema design, indexing, and binary handling are optimized for caching workloads.

---

## Table of Contents

- [Module Structure](#module-structure)
- [Database Schema](#database-schema)
- [Entity Relationships](#entity-relationships)
- [Record Classes](#record-classes)
- [Database Adapters](#database-adapters)
- [Compression System](#compression-system)
- [Key Operations](#key-operations)
- [Integration Patterns](#integration-patterns)

## Module Structure

```
/db
├── adapter/             # Database adapters for different backends
│   ├── HTTP_Cache_Store_DB_Adapter_Base.js    # Abstract interface
│   └── HTTP_Cache_Store_DB_Adapter_SQLite.js  # SQLite implementation 
├── compression/         # Compression algorithms and management
│   ├── Compression_Adapter_Base.js            # Base adapter interface
│   ├── Compression_Adapter_Brotli.js          # Brotli compression
│   ├── Compression_Adapter_No_Compression.js  # Pass-through adapter
│   └── Compression_Manager.js                 # Algorithm selection & coordination
├── record/              # Data record classes representing DB entities
│   ├── DB_Record_Base.js                # Common base class
│   ├── DB_URL_Record.js                 # URL parsing & normalization
│   ├── DB_Request_Record.js             # HTTP request metadata
│   ├── DB_Response_Record.js            # HTTP response with cache controls
│   ├── DB_Body_Record.js                # Response body version tracking
│   ├── DB_Body_Content_Record.js        # Actual content with compression details
│   ├── DB_Header_Name_Record.js         # Header name definitions
│   ├── DB_Header_Pair_Record.js         # Name-value header pairs
│   ├── DB_Cache_Validation_Record.js    # ETag and Last-Modified tracking
│   └── DB_Compression_Process_Record.js # Compression algorithm settings
└── sql/                 # SQL schema definitions
    └── schema_common.sql               # Common SQL schema for all adapters
```

## Database Schema

The database schema follows a normalized structure to efficiently store HTTP cache data while supporting advanced features like versioning, cache validation, and compression statistics.

### Core Tables

```mermaid
erDiagram
    body_contents ||--o{ bodies : "content_id"
    bodies ||--o{ requests : "body_id"
    bodies ||--o{ responses : "body_id"
    compression_processes ||--o{ body_contents : "compression_process_id"
    http_methods ||--o{ requests : "method_id"
    http_statuses ||--o{ responses : "status_code"
    urls ||--o{ requests : "url_id"
    requests ||--|| responses : "request_id"
    header_names ||--o{ header_pairs : "header_name_id"
    header_values ||--o{ header_pairs : "header_value_id"
    header_pairs ||--o{ request_headers : "header_pair_id"
    header_pairs ||--o{ response_headers : "header_pair_id"
    requests ||--o{ request_headers : "request_id"
    responses ||--o{ response_headers : "response_id"
    
    body_contents {
        INTEGER content_id PK
        TEXT content_hash UK
        BLOB body_content
        TEXT content_type
        TEXT content_encoding
        INTEGER content_length
        TEXT mime_category
        INTEGER compression_process_id FK
        INTEGER original_size
        INTEGER compressed_size
        REAL compression_ratio
        INTEGER reference_count
        DATETIME first_seen_at
        DATETIME last_referenced_at
    }
    
    bodies {
        INTEGER body_id PK
        INTEGER content_id FK
        DATETIME created_at
        DATETIME last_accessed_at
        INTEGER access_count
        BOOLEAN is_deleted
        INTEGER version
        INTEGER previous_version_id FK
        DATETIME replaced_at
    }
    
    urls {
        INTEGER url_id PK
        TEXT scheme
        TEXT domain
        INTEGER port
        TEXT path
        TEXT querystring
        TEXT fragment
        TEXT full_url UK
    }
    
    requests {
        INTEGER request_id PK
        INTEGER url_id FK
        INTEGER method_id FK
        TEXT requested_at
        INTEGER body_id FK
    }
    
    responses {
        INTEGER response_id PK
        INTEGER request_id FK
        INTEGER status_code FK
        DATETIME responded_at
        DATETIME expires_at
        INTEGER max_age
        BOOLEAN must_revalidate
        BOOLEAN no_cache
        BOOLEAN no_store
        INTEGER body_id FK
        BOOLEAN is_deleted
    }
```

### Auxiliary Tables

```mermaid
erDiagram
    responses ||--o{ cache_validation : "response_id"
    bodies ||--o{ compression_metrics : "body_id"
    requests ||--o{ cache_statistics : "request_id"
    responses ||--o{ cache_statistics : "response_id"
    
    compression_metrics {
        INTEGER compression_metric_id PK
        INTEGER body_id FK
        INTEGER original_size
        INTEGER compressed_size
        INTEGER compression_time_ms
        REAL compression_ratio
        DATETIME created_at
    }
    
    cache_validation {
        INTEGER validation_id PK
        INTEGER response_id FK
        TEXT etag
        DATETIME last_modified
        TEXT validator_type
        BOOLEAN is_strong_validator
        DATETIME validated_at
    }
    
    cache_statistics {
        INTEGER statistic_id PK
        INTEGER request_id FK
        INTEGER response_id FK
        INTEGER hit_count
        DATETIME last_hit_at
        DATETIME first_hit_at
        INTEGER total_response_time_ms
        REAL avg_response_time_ms
    }
```

### Schema Highlights

- **Content Deduplication**: The `body_contents` table stores unique content by hash, with `reference_count` tracking how many bodies reference it
- **Version Control**: Bodies track version history through `previous_version_id` references
- **Performance Metrics**: Detailed statistics on compression effectiveness and cache hit rates
- **Cache Validation**: Dedicated tracking of ETag and Last-Modified validators for HTTP cache control
- **Header Storage**: Normalized storage of HTTP headers to avoid redundancy

## Record Classes

The record classes provide an object-oriented interface to the database schema, adding validation, events, and helper methods.

### Class Hierarchy

```mermaid
classDiagram
    class Evented_Class {
        +raise_event(event_name, event_data)
        +on(event_name, callback)
    }
    
    class DB_Record_Base {
        +created_at
        +modified_at
        +toJSON()
        +clone()
    }
    
    Evented_Class <|-- DB_Record_Base
    DB_Record_Base <|-- DB_URL_Record
    DB_Record_Base <|-- DB_Request_Record
    DB_Record_Base <|-- DB_Response_Record
    DB_Record_Base <|-- DB_Body_Record
    DB_Record_Base <|-- DB_Body_Content_Record
    DB_Record_Base <|-- DB_Header_Name_Record
    DB_Record_Base <|-- DB_Header_Pair_Record
    DB_Record_Base <|-- DB_Cache_Validation_Record
    DB_Record_Base <|-- DB_Compression_Process_Record
    
    class DB_URL_Record {
        +url_id
        +scheme
        +domain
        +port
        +path
        +querystring
        +fragment
        +full_url
        +constructFullURL()
        +parseFromURL(url)
    }
    
    class DB_Response_Record {
        +response_id
        +request_id
        +status_code
        +responded_at
        +expires_at
        +max_age
        +must_revalidate
        +no_cache
        +no_store
        +body_id
        +is_deleted
        +headers
        +isExpired()
        +needsRevalidation()
    }
    
    class DB_Body_Content_Record {
        +content_id
        +content_hash
        +body_content
        +content_type
        +content_encoding
        +content_length
        +mime_category
        +compression_process_id
        +original_size
        +compressed_size
        +compression_ratio
        +reference_count
        +first_seen_at
        +last_referenced_at
        +incrementReferenceCount()
        +decrementReferenceCount()
    }
    
    class DB_Cache_Validation_Record {
        +validation_id
        +response_id
        +etag
        +last_modified
        +validator_type
        +is_strong_validator
        +validated_at
        +isValid()
    }
```

### Key Features

- **Event System**: All record classes emit events (e.g., 'accessed', 'reference_count_changed', 'version_created')
- **Immutable Hashes**: Content is identified by SHA-256 hashes of the uncompressed content
- **Serialization**: All records have `toJSON()` for data exchange
- **Normalization**: URL components are normalized, HTTP headers are canonicalized to lowercase
- **Validation**: Records include validation of their properties

## Database Adapters

The database adapter pattern allows for multiple backend implementations while providing a consistent interface.

### Adapter Architecture

```mermaid
classDiagram
    class Evented_Class {
        +raise_event(event_name, event_data)
        +on(event_name, callback)
    }
    
    class HTTP_Cache_Store_DB_Adapter {
        +options
        +connected
        +connect()
        +disconnect()
        +store_request_response(data)
        +get_cached_response(request_details)
        +delete_cached_response(request_details)
        +clear_cache()
        +emit_cache_event(type, data)
    }
    
    Evented_Class <|-- HTTP_Cache_Store_DB_Adapter
    HTTP_Cache_Store_DB_Adapter <|-- HTTP_Cache_Store_DB_Adapter_SQLite
    
    class HTTP_Cache_Store_DB_Adapter_SQLite {
        +db_path
        +db
        +initSchema()
    }
```

### SQLite Implementation

```javascript
// Example: Storing a response with SQLite adapter
const adapter = new HTTP_Cache_Store_DB_Adapter_SQLite({ db_path: 'cache.db' });
await adapter.connect();

const fileObj = new Compressed_File({
    hash: Buffer.from([0x01, 0x02, 0x03]),
    mime_type: 'text/html',
    compression_algorithm: 'brotli'
});
fileObj.set_content(compressedHtmlContent);
fileObj.metadata = {
    method: 'GET',
    url: 'https://example.com',
    status_code: 200
};

await adapter.store_request_response(fileObj);
```

### Key Features

- **Binary Support**: Handles binary data storage and retrieval
- **Connection Management**: Consistent connect/disconnect interface
- **Event Emission**: Emits events for all operations (e.g., 'connected', 'cache_hit', 'store_success')
- **Schema Initialization**: Automatic schema creation
- **WAL Journal Mode**: Uses SQLite's WAL mode for better concurrency

## Compression System

The compression system provides a unified interface for multiple compression algorithms with intelligent content-aware selection.

### Component Architecture

```mermaid
classDiagram
    class Evented_Class {
        +raise_event(event_name, event_data)
        +on(event_name, callback)
    }
    
    class Compression_Adapter_Base {
    }
    
    Evented_Class <|-- Compression_Adapter_Base
    Compression_Adapter_Base <|-- Compression_Adapter_Brotli
    Compression_Adapter_Base <|-- Compression_Adapter_No_Compression
    
    class Compression_Adapter_Brotli {
        +compress(data)
        +decompress(data)
    }
    
    class Compression_Adapter_No_Compression {
        +compress(data)
        +decompress(data)
    }
    
    class Compression_Manager {
        +adapters
        +default_algorithm
        +compress(algorithm, data)
        +decompress(algorithm, data)
        +shouldCompress(data, mimeType)
        +compress_data(data)
        +decompress_data(data)
    }
    
    Evented_Class <|-- Compression_Manager
    Compression_Manager o-- Compression_Adapter_Base : contains
```

### Compression Process

```mermaid
flowchart TD
    A[Incoming HTTP Response]
    B{Should Compress?}
    C[Check MIME Type]
    D[Check Content Size]
    E[Compress with Selected Algorithm]
    F[Store Uncompressed]
    G[Store with Compression Metadata]
    
    A --> B
    B --> C
    C --> D
    D --> B
    B -- Yes --> E
    B -- No --> F
    E --> G
    F --> G
```

### Algorithm Selection Logic

- **MIME Type Analysis**: Text-based types (HTML, CSS, JS, JSON) are compressed
- **Size Thresholds**: Small responses (< 100 bytes) bypass compression
- **Already Compressed**: Image, video, audio, and pre-compressed formats are not re-compressed
- **Brotli By Default**: Modern algorithm with good compression ratio/speed tradeoff

## Key Operations

### Cache Storage Process

```mermaid
sequenceDiagram
    participant Client
    participant StorageAdapter
    participant CompressionManager
    participant DBAdapter
    
    Client->>StorageAdapter: store_request_response(data)
    StorageAdapter->>StorageAdapter: computeHash(method, url, headers)
    StorageAdapter->>CompressionManager: shouldCompress(data, mimeType)
    CompressionManager-->>StorageAdapter: true/false
    
    alt should compress
        StorageAdapter->>CompressionManager: compress(algorithm, data)
        CompressionManager-->>StorageAdapter: compressedData
        StorageAdapter->>StorageAdapter: new Compressed_File()
    else no compression
        StorageAdapter->>StorageAdapter: new NotCompressed_File()
    end
    
    StorageAdapter->>DBAdapter: store_request_response(file)
    DBAdapter->>DBAdapter: Save to database
    DBAdapter-->>StorageAdapter: success
    StorageAdapter-->>Client: success
```

### Cache Retrieval Process

```mermaid
sequenceDiagram
    participant Client
    participant StorageAdapter
    participant CompressionManager
    participant DBAdapter
    
    Client->>StorageAdapter: get_cached_response(request_details)
    StorageAdapter->>StorageAdapter: computeHash(method, url, headers)
    StorageAdapter->>DBAdapter: get_cached_response(request_details)
    DBAdapter-->>StorageAdapter: result
    
    alt result exists
        StorageAdapter->>StorageAdapter: create_file_from_storage_object(result)
        
        alt file is compressed
            StorageAdapter->>CompressionManager: decompress(algorithm, content)
            CompressionManager-->>StorageAdapter: decompressedContent
            StorageAdapter->>StorageAdapter: file.set_content(decompressedContent)
        end
        
        StorageAdapter-->>Client: file
    else no result
        StorageAdapter-->>Client: null
    end
```

## Integration Patterns

### Event-Based Integration

All components emit events that can be used for metrics, logging, and integration:

```javascript
// Example: Monitoring compression performance
const dbAdapter = new HTTP_Cache_Store_DB_Adapter_SQLite({ db_path: 'cache.db' });

// Listen for storage events
dbAdapter.on('store_success', (data) => {
    console.log(`Stored: ${data.metadata?.url}`);
    
    if (data.is_compressed) {
        const ratio = (data.original_size / data.compressed_size).toFixed(2);
        console.log(`Compression ratio: ${ratio}x (saved ${data.original_size - data.compressed_size} bytes)`);
    }
});

// Listen for cache hits/misses
dbAdapter.on('cache_hit', (data) => {
    console.log(`Cache hit: ${data.metadata?.url}`);
});

dbAdapter.on('cache_miss', (data) => {
    console.log(`Cache miss: ${data.url}`);
});
```

### Analytics Using Views

The schema includes views for analytics:

```sql
-- Compression Effectiveness by MIME Category
SELECT 
    mime_category,
    COUNT(*) as total_items,
    AVG(compression_ratio) as avg_compression_ratio
FROM body_contents
WHERE compression_process_id IS NOT NULL
GROUP BY mime_category
ORDER BY avg_compression_ratio DESC;

-- Cache Hit Rate by Day
SELECT 
    DATE(first_hit_at) as date,
    COUNT(*) as total_requests,
    SUM(hit_count) as total_hits,
    AVG(avg_response_time_ms) as avg_response_time
FROM cache_statistics
GROUP BY date;
```

### Extension Points

The database module provides several extension points:

1. **New Compression Algorithms**: Implement `Compression_Adapter_Base` for new algorithms
2. **Alternative DB Backends**: Implement `HTTP_Cache_Store_DB_Adapter` for NoSQL or other SQL databases
3. **Custom Record Validation**: Extend record classes with additional validation
4. **New Metrics Collection**: Add listeners for events to collect custom analytics
5. **Migration Support**: Include schema version tracking for future upgrades

## Performance Considerations

- **Content Deduplication**: Reduces storage requirements by only storing unique content bodies
- **Binary Optimizations**: All adapters handle binary data efficiently
- **Index Strategy**: Optimized SQL indexes for common query patterns
- **Lazy Loading**: Record relationships are loaded on-demand
- **Connection Pooling**: SQLite adapter supports connection pooling for multi-threading

For more details on implementation, see the [API Documentation](../API_DOCUMENTATION.md) and the [FUTURE](../../FUTURE.md) document for upcoming enhancements.
