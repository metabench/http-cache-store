-- HTTP Cache Store schema definition

-- Cache entries table - stores request/response pairs metadata
CREATE TABLE IF NOT EXISTS cache_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_method TEXT NOT NULL,
    request_url TEXT NOT NULL,
    request_hash BLOB NOT NULL, -- Hash of method+URL for lookups
    request_headers TEXT, -- JSON serialized request headers
    request_body_hash BLOB, -- Reference to request body (if any)
    response_hash BLOB, -- Reference to response body
    response_status INTEGER,
    response_headers TEXT, -- JSON serialized response headers
    stored_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
    last_accessed INTEGER,
    metadata TEXT -- Additional metadata as JSON
);

-- Bodies table - stores the actual content
CREATE TABLE IF NOT EXISTS bodies (
    hash BLOB PRIMARY KEY,
    content BLOB NOT NULL,
    mime_type TEXT,
    platform_compression_algo TEXT, -- Algorithm used if platform compressed
    is_platform_compressed BOOLEAN,
    original_size INTEGER,
    stored_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_request_method_url ON cache_entries(request_method, request_url);
CREATE INDEX IF NOT EXISTS idx_request_hash ON cache_entries(request_hash);
CREATE INDEX IF NOT EXISTS idx_response_hash ON cache_entries(response_hash);
CREATE INDEX IF NOT EXISTS idx_request_body_hash ON cache_entries(request_body_hash);

-- Optimize SQLite performance
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
