const sqlite3 = require('sqlite3').verbose();
const HTTP_Cache_Store_DB_Adapter = require('./HTTP_Cache_Store_DB_Adapter_Base');
const fs = require('fs').promises;
const path = require('path');

/**
 * SQLite implementation of HTTP_Cache_Store_DB_Adapter.
 */
class HTTP_Cache_Store_DB_Adapter_SQLite extends HTTP_Cache_Store_DB_Adapter {
    constructor(options = {}) {
        super(options);
        this.db_path = options.db_path || ':memory:';
        this.db = null;
        this.is_connected = false;
        this.verbose = options.verbose || false;
    }

    log(...args) {
        if (this.verbose) {
            console.log(...args);
        }
    }

    /**
     * Connect to the SQLite database.
     * @returns {Promise<void>}
     */
    async connect() {
        try {
            await new Promise((resolve, reject) => {
                this.db = new sqlite3.Database(this.db_path, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            // Initialize schema
            await this.initSchema();
            
            this.is_connected = true;
            this.raise_event('connected');
        } catch (error) {
            this.raise_event('error', error);
            throw error;
        }
    }

    async initSchema() {
        const schema = `
            -- Create the cache_entries table
            CREATE TABLE IF NOT EXISTS cache_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                request_method TEXT NOT NULL,
                request_url TEXT NOT NULL,
                request_hash BLOB NOT NULL,
                request_headers TEXT,
                request_body_hash BLOB,
                response_hash BLOB,
                response_status INTEGER,
                response_headers TEXT,
                stored_at INTEGER DEFAULT (strftime('%s', 'now')),
                last_accessed INTEGER,
                metadata TEXT
            );

            -- Create the bodies table
            CREATE TABLE IF NOT EXISTS bodies (
                hash BLOB PRIMARY KEY,
                content BLOB NOT NULL,
                mime_type TEXT,
                platform_compression_algo TEXT,
                is_platform_compressed BOOLEAN,
                original_size INTEGER,
                stored_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
            
            -- Indexes for faster lookups
            CREATE INDEX IF NOT EXISTS idx_request_method_url ON cache_entries(request_method, request_url);
            CREATE INDEX IF NOT EXISTS idx_request_hash ON cache_entries(request_hash);
            
            PRAGMA journal_mode=WAL;
            PRAGMA synchronous=NORMAL;
        `;

        // Only log schema in verbose mode
        this.log(`Debug: Applying schema:`, schema);
        
        try {
            await new Promise((resolve, reject) => {
                this.db.exec(schema, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            this.log(`Schema initialized successfully for ${this.db_path}`);
        } catch (error) {
            this.log(`Schema initialization error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Disconnect from the SQLite database.
     * @returns {Promise<void>}
     */
    async disconnect() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        reject(err);
                    } else {
                        this.is_connected = false;
                        this.raise_event('disconnected');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Stores an HTTP request and response in the cache.
     * @param {File_Base} file - File object containing the response content and metadata
     * @returns {Promise<void>}
     */
    async store_request_response(file) {
        if (!this.is_connected) throw new Error('Database not connected');
        if (!file.hash) throw new Error('Hash is required for storage');
        
        try {
            this.log(`Debug: Received file.hash: ${file.hash}`);
            // Convert hash to Buffer if it's a Uint8Array
            const hash = file.hash instanceof Uint8Array ? Buffer.from(file.hash) : file.hash;
            this.log(`Debug: Converted hash: ${hash.toString('hex')}`);
            const content = file.get_content();
            const metadata = JSON.stringify(file.metadata || {});
            
            this.log(`SQLite: Storing hash ${hash.toString('hex')}, type: ${file.mime_type}, compressed: ${file.is_platform_compressed}`);
            
            // Update column names to match the new schema
            const query = `INSERT OR REPLACE INTO bodies 
                (hash, content, mime_type,
                 platform_compression_algo, is_platform_compressed,
                 original_size, stored_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)`;
            
            this.log(`Debug: Executing query: ${query}`);
            this.log(`Debug: Query parameters:`, {
                hash: hash ? hash.toString('hex') : null,
                content_length: content ? content.length : 0,
                mime_type: file.mime_type,
                platform_compression_algo: file.compression_algorithm,
                is_platform_compressed: file.is_platform_compressed,
                original_size: file.original_size,
                stored_at: Date.now()
            });

            const lastID = await new Promise((resolve, reject) => {
                this.db.run(query, [
                    hash,
                    content,
                    file.mime_type || null,
                    file.compression_algorithm || null,
                    file.is_platform_compressed ? 1 : 0,
                    file.original_size || null,
                    Date.now()
                ], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                });
            });
            
            this.log(`SQLite: Successfully stored with rowid ${lastID}`);
            return true;
        } catch (error) {
            this.log("SQLite store error:", error);
            throw error;
        }
    }

    /**
     * Retrieves a cached HTTP response based on request details.
     * @param {Object} request_details - { hash } containing the hash of the request
     * @returns {Promise<Object|null>}
     */
    async get_cached_response(request_details) {
        if (!this.is_connected) throw new Error('Database not connected');
        
        try {
            const hash = Buffer.from(request_details.hash);
            this.log(`SQLite: Looking up hash ${hash.toString('hex')}`);
            
            // First check if the hash exists in the database
            const countQuery = `SELECT COUNT(*) as count FROM bodies WHERE hash = ?`;
            
            // Here we can use arrow functions because we don't need special statement properties
            const countResult = await new Promise((resolve, reject) => {
                this.db.get(countQuery, [hash], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
            
            this.log(`SQLite: Found ${countResult?.count || 0} records matching hash`);
            
            if (!countResult || countResult.count === 0) {
                this.emit_cache_event('cache_miss', request_details);
                return null;
            }
            
            const query = `SELECT * FROM bodies WHERE hash = ?`;
            
            return new Promise((resolve, reject) => {
                this.db.get(query, [hash], (err, row) => {
                    if (err) {
                        reject(err);
                    } else if (!row) {
                        this.emit_cache_event('cache_miss', request_details);
                        resolve(null);
                    } else {
                        try {
                            // Log row info but without potentially large binary content
                            this.log(`Debug: Retrieved row with hash: ${hash.toString('hex')}, mime: ${row.mime_type}, size: ${row.content ? row.content.length : 0} bytes`);
                            
                            const result = {
                                hash: row.hash,
                                body_content: row.content,
                                compression_algorithm: row.platform_compression_algo,
                                mime_type: row.mime_type,
                                stored_at: row.stored_at,
                                metadata: row.metadata ? JSON.parse(row.metadata) : {},
                                is_compressed: Boolean(row.is_platform_compressed),
                                original_size: row.original_size
                            };
                            
                            this.emit_cache_event('cache_hit', result);
                            resolve(result);
                        } catch (parseError) {
                            this.log("Parse error:", parseError);
                            reject(parseError);
                        }
                    }
                });
            });
        } catch (error) {
            this.log("SQLite get error:", error);
            throw error;
        }
    }

    /**
     * Deletes a cached HTTP response based on request details.
     * @param {Object} request_details - { hash } containing the hash of the request
     * @returns {Promise<void>}
     */
    async delete_cached_response(request_details) {
        if (!this.is_connected) throw new Error('Database not connected');
        
        try {
            const requestHash = request_details.hash;
            
            // Find the cache entry first to get response hash
            const cacheEntry = await this.get_cache_entry_by_request({ request_hash: requestHash });
            
            if (!cacheEntry) {
                return; // Nothing to delete
            }
            
            // Delete the cache entry
            const deleteQuery = `DELETE FROM cache_entries WHERE request_hash = ?`;
            
            await new Promise((resolve, reject) => {
                this.db.run(deleteQuery, [requestHash], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
            
            // Check if any other entries reference the same response body
            if (cacheEntry.response_hash) {
                const countQuery = `
                    SELECT COUNT(*) as count FROM cache_entries 
                    WHERE response_hash = ?
                `;
                
                const result = await new Promise((resolve, reject) => {
                    this.db.get(countQuery, [cacheEntry.response_hash], (err, row) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(row);
                        }
                    });
                });
                
                // If no other entries reference this body, delete it
                if (result.count === 0) {
                    await this.delete_body(cacheEntry.response_hash);
                }
            }
            
            // Do the same for request body if present
            if (cacheEntry.request_body_hash) {
                const countQuery = `
                    SELECT COUNT(*) as count FROM cache_entries 
                    WHERE request_body_hash = ?
                `;
                
                const result = await new Promise((resolve, reject) => {
                    this.db.get(countQuery, [cacheEntry.request_body_hash], (err, row) => {
                        if (err) {
                            reject(err);
                        } else {
                            resolve(row);
                        }
                    });
                });
                
                // If no other entries reference this body, delete it
                if (result.count === 0) {
                    await this.delete_body(cacheEntry.request_body_hash);
                }
            }
        } catch (error) {
            this.log("SQLite delete cache entry error:", error);
            throw error;
        }
    }

    /**
     * Clears all cached responses.
     * @returns {Promise<void>}
     */
    async clear_cache() {
        if (!this.is_connected) throw new Error('Database not connected');
        
        try {
            // Delete all cache entries
            await new Promise((resolve, reject) => {
                this.db.run(`DELETE FROM cache_entries`, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
            
            // Delete all bodies
            await new Promise((resolve, reject) => {
                this.db.run(`DELETE FROM bodies`, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
            
            this.log(`SQLite: Cache cleared`);
        } catch (error) {
            this.log("SQLite clear cache error:", error);
            throw error;
        }
    }

    /**
     * Stores a cache entry (request-response pair).
     * @param {Object} cacheEntry - The cache entry to store
     * @returns {Promise<Object>} - The stored cache entry with ID
     */
    async store_cache_entry(cacheEntry) {
        if (!this.is_connected) throw new Error('Database not connected');
        
        try {
            const query = `
                INSERT OR REPLACE INTO cache_entries (
                    request_method, request_url, request_hash,
                    request_headers, request_body_hash,
                    response_hash, response_status, response_headers,
                    stored_at, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
                cacheEntry.request_method,
                cacheEntry.request_url,
                cacheEntry.request_hash,
                cacheEntry.request_headers,
                cacheEntry.request_body_hash,
                cacheEntry.response_hash,
                cacheEntry.response_status,
                cacheEntry.response_headers,
                cacheEntry.stored_at,
                cacheEntry.metadata
            ];
            
            const id = await new Promise((resolve, reject) => {
                this.db.run(query, params, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(this.lastID);
                    }
                });
            });
            
            this.log(`SQLite: Stored cache entry with ID ${id}`);
            return { ...cacheEntry, id };
        } catch (error) {
            this.log("SQLite store cache entry error:", error);
            throw error;
        }
    }
    
    /**
     * Stores a body (request or response).
     * @param {Object} bodyEntry - The body entry to store
     * @returns {Promise<Object>} - The stored body entry
     */
    async store_body(bodyEntry) {
        if (!this.is_connected) throw new Error('Database not connected');
        
        try {
            // Check if body already exists
            const exists = await this.body_exists(bodyEntry.hash);
            if (exists) {
                this.log(`SQLite: Body with hash ${bodyEntry.hash.toString('hex')} already exists`);
                return bodyEntry;
            }
            
            const query = `
                INSERT INTO bodies (
                    hash, content, mime_type,
                    platform_compression_algo, is_platform_compressed,
                    original_size, stored_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            const params = [
                bodyEntry.hash,
                bodyEntry.content,
                bodyEntry.mime_type,
                bodyEntry.platform_compression_algo,
                bodyEntry.is_platform_compressed ? 1 : 0,
                bodyEntry.original_size,
                bodyEntry.stored_at
            ];
            
            await new Promise((resolve, reject) => {
                this.db.run(query, params, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
            
            this.log(`SQLite: Stored body with hash ${bodyEntry.hash.toString('hex')}`);
            return bodyEntry;
        } catch (error) {
            this.log("SQLite store body error:", error);
            throw error;
        }
    }
    
    /**
     * Checks if a body exists by its hash.
     * @param {Buffer} hash - The body hash
     * @returns {Promise<boolean>} - True if the body exists
     */
    async body_exists(hash) {
        if (!this.is_connected) throw new Error('Database not connected');
        
        try {
            const query = `SELECT 1 FROM bodies WHERE hash = ? LIMIT 1`;
            
            const result = await new Promise((resolve, reject) => {
                this.db.get(query, [hash], (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });
            
            return !!result;
        } catch (error) {
            this.log("SQLite body exists error:", error);
            throw error;
        }
    }
    
    /**
     * Retrieves a cache entry by request details.
     * @param {Object} request - { request_hash, method, url }
     * @returns {Promise<Object|null>} - The cache entry or null
     */
    async get_cache_entry_by_request(request) {
        if (!this.is_connected) throw new Error('Database not connected');
        
        try {
            let query, params;
            
            if (request.request_hash) {
                // Lookup by hash (preferred, faster)
                query = `SELECT * FROM cache_entries WHERE request_hash = ? LIMIT 1`;
                params = [request.request_hash];
            } else if (request.method && request.url) {
                // Lookup by method and URL
                query = `SELECT * FROM cache_entries WHERE request_method = ? AND request_url = ? LIMIT 1`;
                params = [request.method, request.url];
            } else {
                throw new Error('Invalid request parameters for cache lookup');
            }
            
            const row = await new Promise((resolve, reject) => {
                this.db.get(query, params, (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });
            
            return row || null;
        } catch (error) {
            this.log("SQLite get cache entry error:", error);
            throw error;
        }
    }
    
    /**
     * Retrieves a body by its hash.
     * @param {Buffer} hash - The body hash
     * @returns {Promise<Object|null>} - The body entry or null
     */
    async get_body_by_hash(hash) {
        if (!this.is_connected) throw new Error('Database not connected');
        
        try {
            const query = `SELECT * FROM bodies WHERE hash = ? LIMIT 1`;
            
            const row = await new Promise((resolve, reject) => {
                this.db.get(query, [hash], (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });
            
            if (!row) return null;
            
            return {
                hash: row.hash,
                content: row.content,
                mime_type: row.mime_type,
                platform_compression_algo: row.platform_compression_algo,
                is_platform_compressed: Boolean(row.is_platform_compressed),
                original_size: row.original_size,
                stored_at: row.stored_at
            };
        } catch (error) {
            this.log("SQLite get body error:", error);
            throw error;
        }
    }
    
    /**
     * Updates the last accessed time for a cache entry.
     * @param {number} id - The cache entry ID
     * @returns {Promise<void>}
     */
    async update_cache_entry_access_time(id) {
        if (!this.is_connected) throw new Error('Database not connected');
        
        try {
            const query = `UPDATE cache_entries SET last_accessed = ? WHERE id = ?`;
            const params = [Date.now(), id];
            
            await new Promise((resolve, reject) => {
                this.db.run(query, params, function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        } catch (error) {
            this.log("SQLite update cache entry access time error:", error);
            // Non-critical error, just log
        }
    }
    
    /**
     * Deletes a body by its hash.
     * @param {Buffer} hash - The body hash
     * @returns {Promise<void>}
     */
    async delete_body(hash) {
        if (!this.is_connected) throw new Error('Database not connected');
        
        try {
            const query = `DELETE FROM bodies WHERE hash = ?`;
            
            await new Promise((resolve, reject) => {
                this.db.run(query, [hash], function(err) {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
            
            this.log(`SQLite: Deleted body with hash ${hash.toString('hex')}`);
        } catch (error) {
            this.log("SQLite delete body error:", error);
            throw error;
        }
    }
    
    /**
     * Count all files in cache
     * @returns {Promise<number>} Total count of files
     */
    async count_files() {
        if (!this.is_connected) throw new Error('Database not connected');
        
        const query = `SELECT COUNT(*) as count FROM bodies`;
        
        try {
            const result = await new Promise((resolve, reject) => {
                this.db.get(query, (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });
            
            return result?.count || 0;
        } catch (error) {
            this.log("SQLite count error:", error);
            throw error;
        }
    }
    
    /**
     * Count request files in cache
     * @returns {Promise<number>} Number of requests
     */
    async count_requests() {
        if (!this.is_connected) throw new Error('Database not connected');
        
        // In our schema, we count requests based on metadata
        const query = `
            SELECT COUNT(*) as count 
            FROM bodies 
            WHERE metadata IS NOT NULL 
            AND json_extract(metadata, '$.method') IS NOT NULL
        `;
        
        try {
            const result = await new Promise((resolve, reject) => {
                this.db.get(query, (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });
            
            return result?.count || 0;
        } catch (error) {
            this.log("SQLite count requests error:", error);
            throw error;
        }
    }
    
    /**
     * Count response files in cache
     * @returns {Promise<number>} Number of responses
     */
    async count_responses() {
        if (!this.is_connected) throw new Error('Database not connected');
        
        // In our schema, we count responses based on metadata having status_code
        const query = `
            SELECT COUNT(*) as count 
            FROM bodies 
            WHERE metadata IS NOT NULL 
            AND json_extract(metadata, '$.status_code') IS NOT NULL
        `;
        
        try {
            const result = await new Promise((resolve, reject) => {
                this.db.get(query, (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });
            
            return result?.count || 0;
        } catch (error) {
            this.log("SQLite count responses error:", error);
            throw error;
        }
    }

    /**
     * Completely remove the database file if it exists
     * Only works for file-based databases (not :memory:)
     * @returns {Promise<boolean>}
     */
    async deleteFile() {
        if (this.db_path === ':memory:') {
            // Nothing to do for in-memory databases
            return true;
        }
        
        // Ensure we're disconnected first
        if (this.is_connected) {
            await this.disconnect();
        }
        
        try {
            // Wait a bit to ensure file handles are fully released
            await new Promise(resolve => setTimeout(resolve, 300));
            
            // Modern approach: Try to access/delete files directly and handle errors
            try {
                // Try to delete the main database file
                await fs.unlink(this.db_path);
                this.log(`Removed database file: ${this.db_path}`);
            } catch (err) {
                // File might not exist or might be inaccessible
                if (err.code !== 'ENOENT') { // Only log if error is not "file doesn't exist"
                    this.log(`Could not remove database file: ${err.message}`);
                }
            }
            
            // Also try to clean up WAL and SHM files that SQLite might create
            const walPath = `${this.db_path}-wal`;
            const shmPath = `${this.db_path}-shm`;
            
            try {
                await fs.unlink(walPath);
                this.log(`Removed WAL file: ${walPath}`);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    this.log(`WAL file not found or couldn't be removed: ${err.message}`);
                }
            }
            
            try {
                await fs.unlink(shmPath);
                this.log(`Removed SHM file: ${shmPath}`);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    this.log(`SHM file not found or couldn't be removed: ${err.message}`);
                }
            }
            
            return true;
        } catch (error) {
            this.log(`Error during file cleanup: ${error.message}`);
            throw error;
        }
    }
}

module.exports = HTTP_Cache_Store_DB_Adapter_SQLite;
