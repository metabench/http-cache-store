CREATE TABLE compression_processes (
    compression_process_id  INTEGER PRIMARY KEY,
    full_name               TEXT NOT NULL,
    system_name             TEXT NOT NULL,
    compression_level       INTEGER,
    options                 TEXT
);

-------------------------------------------------------------------------------
-- 2. schema_version
-------------------------------------------------------------------------------
CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-------------------------------------------------------------------------------
-- 3. body_contents
-------------------------------------------------------------------------------
CREATE TABLE body_contents (
    content_id              INTEGER PRIMARY KEY,
    content_hash           TEXT NOT NULL UNIQUE,
    body_content          BLOB NOT NULL,
    content_type          TEXT,
    content_encoding      TEXT,
    content_length        INTEGER,
    mime_category         TEXT,
    compression_process_id INTEGER,
    original_size         INTEGER,
    compressed_size       INTEGER,
    compression_ratio     REAL,
    reference_count       INTEGER DEFAULT 1,
    first_seen_at         DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_referenced_at    DATETIME,
    UNIQUE (content_hash),
    FOREIGN KEY (compression_process_id) 
        REFERENCES compression_processes (compression_process_id)
);

-------------------------------------------------------------------------------
-- 4. bodies
-------------------------------------------------------------------------------
CREATE TABLE bodies (
    body_id              INTEGER PRIMARY KEY,
    content_id          INTEGER NOT NULL,
    created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at    DATETIME,
    access_count        INTEGER DEFAULT 0,
    is_deleted          BOOLEAN DEFAULT 0,
    version            INTEGER DEFAULT 1,
    previous_version_id INTEGER REFERENCES bodies(body_id),
    replaced_at        DATETIME,
    FOREIGN KEY (content_id) 
        REFERENCES body_contents (content_id)
);

-------------------------------------------------------------------------------
-- 5. http_methods
-------------------------------------------------------------------------------
CREATE TABLE http_methods (
    method_id       INTEGER PRIMARY KEY,
    method_name     TEXT NOT NULL UNIQUE
);

-------------------------------------------------------------------------------
-- 6. http_statuses
-------------------------------------------------------------------------------
CREATE TABLE http_statuses (
    status_code     INTEGER PRIMARY KEY,
    meaning         TEXT NOT NULL
);

-------------------------------------------------------------------------------
-- 7. urls
-------------------------------------------------------------------------------
CREATE TABLE urls (
    url_id      INTEGER PRIMARY KEY,
    scheme      TEXT NOT NULL,
    domain      TEXT NOT NULL,
    port        INTEGER,
    path        TEXT NOT NULL,
    querystring TEXT,
    fragment    TEXT,
    full_url    TEXT NOT NULL UNIQUE
);

-------------------------------------------------------------------------------
-- 8. requests
-------------------------------------------------------------------------------
CREATE TABLE requests (
    request_id      INTEGER PRIMARY KEY,
    url_id          INTEGER NOT NULL,
    method_id       INTEGER NOT NULL,
    requested_at    TEXT,    -- can be DATETIME or TEXT
    body_id         INTEGER, -- for request payload

    FOREIGN KEY (url_id)    REFERENCES urls (url_id),
    FOREIGN KEY (method_id) REFERENCES http_methods (method_id),
    FOREIGN KEY (body_id)   REFERENCES bodies (body_id)
);

-------------------------------------------------------------------------------
-- 9. responses
-------------------------------------------------------------------------------
CREATE TABLE responses (
    response_id     INTEGER PRIMARY KEY,
    request_id      INTEGER NOT NULL,
    status_code     INTEGER NOT NULL,
    responded_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at      DATETIME,
    max_age         INTEGER,
    must_revalidate BOOLEAN DEFAULT 0,
    no_cache        BOOLEAN DEFAULT 0,
    no_store        BOOLEAN DEFAULT 0,
    body_id         INTEGER,
    is_deleted      BOOLEAN DEFAULT 0,

    FOREIGN KEY (request_id) REFERENCES requests (request_id) ON DELETE CASCADE,
    FOREIGN KEY (status_code) REFERENCES http_statuses (status_code),
    FOREIGN KEY (body_id)    REFERENCES bodies (body_id)
);

-------------------------------------------------------------------------------
-- 10. header_names
-------------------------------------------------------------------------------
CREATE TABLE header_names (
    header_name_id  INTEGER PRIMARY KEY,
    name            TEXT NOT NULL UNIQUE
);

-------------------------------------------------------------------------------
-- 11. header_values
-------------------------------------------------------------------------------
CREATE TABLE header_values (
    header_value_id INTEGER PRIMARY KEY,
    value           TEXT NOT NULL UNIQUE
);

-------------------------------------------------------------------------------
-- 12. header_pairs
-------------------------------------------------------------------------------
CREATE TABLE header_pairs (
    header_pair_id      INTEGER PRIMARY KEY,
    header_name_id      INTEGER NOT NULL,
    header_value_id     INTEGER NOT NULL,

    UNIQUE (header_name_id, header_value_id),

    FOREIGN KEY (header_name_id) REFERENCES header_names (header_name_id),
    FOREIGN KEY (header_value_id) REFERENCES header_values (header_value_id)
);

-------------------------------------------------------------------------------
-- 13. request_headers (bridging table)
-------------------------------------------------------------------------------
CREATE TABLE request_headers (
    request_id      INTEGER NOT NULL,
    header_pair_id  INTEGER NOT NULL,

    PRIMARY KEY (request_id, header_pair_id),

    FOREIGN KEY (request_id)     REFERENCES requests (request_id) ON DELETE CASCADE,
    FOREIGN KEY (header_pair_id) REFERENCES header_pairs (header_pair_id)
);

-------------------------------------------------------------------------------
-- 14. response_headers (bridging table)
-------------------------------------------------------------------------------
CREATE TABLE response_headers (
    response_id     INTEGER NOT NULL,
    header_pair_id  INTEGER NOT NULL,

    PRIMARY KEY (response_id, header_pair_id),

    FOREIGN KEY (response_id)    REFERENCES responses (response_id) ON DELETE CASCADE,
    FOREIGN KEY (header_pair_id) REFERENCES header_pairs (header_pair_id)
);

-------------------------------------------------------------------------------
-- 15. Basic indexes
-------------------------------------------------------------------------------
-- Index on domain for frequent domain-based queries
CREATE INDEX idx_urls_domain ON urls (domain);

-- Index for searching or sorting requests by url_id and requested_at
CREATE INDEX idx_requests_url_id ON requests (url_id);
CREATE INDEX idx_requests_requested_at ON requests (requested_at);

-- Index for searching or sorting responses by request_id and responded_at
CREATE INDEX idx_responses_request_id ON responses (request_id);
CREATE INDEX idx_responses_responded_at ON responses (responded_at);

-- If you frequently look up request_headers by header_pair_id
CREATE INDEX idx_request_headers_header_pair
    ON request_headers (header_pair_id);

-- If you frequently look up response_headers by header_pair_id
CREATE INDEX idx_response_headers_header_pair
    ON response_headers (header_pair_id);

-- Add better indexes
CREATE INDEX idx_bodies_last_accessed ON bodies (last_accessed_at);
CREATE INDEX idx_bodies_content_type ON body_contents (content_type);
CREATE INDEX idx_responses_expires_at ON responses (expires_at);
CREATE INDEX idx_responses_cache_control ON responses (must_revalidate, no_cache, no_store);

-- Add trigger to update last_accessed_at
CREATE TRIGGER update_body_access
AFTER SELECT ON bodies
BEGIN
    UPDATE bodies 
    SET last_accessed_at = CURRENT_TIMESTAMP,
        access_count = access_count + 1
    WHERE body_id = NEW.body_id;
END;

-- Add compression metrics
CREATE TABLE compression_metrics (
    compression_metric_id INTEGER PRIMARY KEY,
    body_id INTEGER NOT NULL,
    original_size INTEGER NOT NULL,
    compressed_size INTEGER NOT NULL,
    compression_time_ms INTEGER,
    compression_ratio REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (body_id) REFERENCES bodies (body_id)
);

-- Add cache statistics
CREATE TABLE cache_statistics (
    statistic_id INTEGER PRIMARY KEY,
    request_id INTEGER NOT NULL,
    response_id INTEGER NOT NULL,
    hit_count INTEGER DEFAULT 0,
    last_hit_at DATETIME,
    first_hit_at DATETIME,
    total_response_time_ms INTEGER DEFAULT 0,
    avg_response_time_ms REAL,
    FOREIGN KEY (request_id) REFERENCES requests (request_id),
    FOREIGN KEY (response_id) REFERENCES responses (response_id)
);

-- Add indexes for new tables
CREATE INDEX idx_compression_metrics_body ON compression_metrics (body_id);
CREATE INDEX idx_cache_stats_request ON cache_statistics (request_id);
CREATE INDEX idx_cache_stats_hits ON cache_statistics (hit_count DESC);

-- Add cache validation
CREATE TABLE cache_validation (
    validation_id INTEGER PRIMARY KEY,
    response_id INTEGER NOT NULL,
    etag TEXT,
    last_modified DATETIME,
    validator_type TEXT CHECK (validator_type IN ('etag', 'last-modified', 'both')),
    is_strong_validator BOOLEAN DEFAULT 0,
    validated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (response_id) REFERENCES responses (response_id) ON DELETE CASCADE
);

-- Add performance tracking
CREATE TABLE performance_metrics (
    metric_id INTEGER PRIMARY KEY,
    request_id INTEGER,
    response_id INTEGER,
    operation_type TEXT NOT NULL,
    started_at DATETIME NOT NULL,
    completed_at DATETIME NOT NULL,
    duration_ms INTEGER,
    bytes_processed INTEGER,
    success BOOLEAN,
    error_message TEXT,
    FOREIGN KEY (request_id) REFERENCES requests (request_id) ON DELETE CASCADE,
    FOREIGN KEY (response_id) REFERENCES responses (response_id) ON DELETE CASCADE
);

-- Add purge tracking
CREATE TABLE purge_events (
    purge_id INTEGER PRIMARY KEY,
    purged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    reason TEXT NOT NULL,
    items_removed INTEGER,
    space_freed INTEGER,
    duration_ms INTEGER
);

-- Add maintenance log
CREATE TABLE maintenance_log (
    log_id INTEGER PRIMARY KEY,
    operation TEXT NOT NULL,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    status TEXT,
    details TEXT
);

-- Additional indexes
CREATE INDEX idx_bodies_mime_category ON body_contents (mime_category);
CREATE INDEX idx_bodies_compression_score ON bodies (compression_score);
CREATE INDEX idx_cache_validation_etag ON cache_validation (etag);
CREATE INDEX idx_cache_validation_last_modified ON cache_validation (last_modified);
CREATE INDEX idx_performance_metrics_timing ON performance_metrics (started_at, completed_at);
CREATE INDEX idx_maintenance_log_operation ON maintenance_log (operation, started_at);

-- Improve existing indexes
CREATE INDEX idx_bodies_version ON bodies (version DESC);
CREATE INDEX idx_responses_validation ON responses (must_revalidate, no_cache, no_store, expires_at);

-- Add indexes for the new structure
CREATE INDEX idx_body_contents_hash ON body_contents (content_hash);
CREATE INDEX idx_body_contents_type ON body_contents (content_type, mime_category);
CREATE INDEX idx_bodies_content ON bodies (content_id);

-- Views for analysis
CREATE VIEW v_compression_effectiveness AS
SELECT 
    b.mime_category,
    COUNT(*) as total_items,
    AVG(cm.compression_ratio) as avg_compression_ratio,
    AVG(cm.compression_time_ms) as avg_compression_time
FROM bodies b
JOIN compression_metrics cm ON b.body_id = cm.body_id
GROUP BY b.mime_category;

CREATE VIEW v_cache_effectiveness AS
SELECT 
    STRFTIME('%Y-%m-%d', cs.first_hit_at) as date,
    COUNT(*) as total_requests,
    SUM(cs.hit_count) as total_hits,
    AVG(cs.avg_response_time_ms) as avg_response_time
FROM cache_statistics cs
GROUP BY date;
