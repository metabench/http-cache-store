const { Evented_Class } = require('lang-mini');
const Compression_Manager = require('./db/compression/Compression_Manager');
const { Crypto } = require('@peculiar/webcrypto');
const webcrypto = new Crypto();
const File_Base = require('./file/File_Base');
const Platform_Compressed_File = require('./file/Platform_Compressed_File');
const Not_Platform_Compressed_File = require('./file/Not_Platform_Compressed_File');
const HTTP_Cache_Store_DB_Adapter_SQLite = require('./db/adapter/HTTP_Cache_Store_DB_Adapter_SQLite');

/**
 * High-level Storage Adapter that manages compression, decompression,
 * and abstracts database interactions across multiple DB backends.
 */

// Needs to deal with / bridge gaps between the lower level db access and the compression systems.

class HTTP_Cache_Store_Storage_Adapter extends Evented_Class {
    constructor(options = {}) {
        super();
        
        // Create default SQLite adapter if none provided
        if (!options.db_adapter) {
            this.db_adapter = new HTTP_Cache_Store_DB_Adapter_SQLite({ 
                db_path: options.db_path || ':memory:',  // Use in-memory SQLite by default
                verbose: options.verbose || false
            });
        } else {
            this.db_adapter = options.db_adapter;
        }

        // Always create our own compression manager
        this.compression_manager = new Compression_Manager();
        
        // Set verbosity level for logging
        this.verbose = options.verbose || false;
    }

    // Helper method for conditional logging
    log(...args) {
        if (this.verbose) {
            console.log(...args);
        }
    }

    async init() {
        try {
            await this.db_adapter.connect();
            this.raise_event('ready');
            return true;
        } catch (error) {
            this.raise_event('error', error);
            throw error;
        }
    }

    // Updated: async utility method to compute a SHA-256 hash supporting multiple inputs
    async computeHash(...inputs) {
        try {
            const encoder = new TextEncoder();
            
            // Default behavior is to use only method and URL for the HTTP cache
            // But allow all inputs for test cases or when explicitly needed
            let normalizedInputs = [...inputs];
            
            // Process each input to ensure consistent string representation
            const normalized = normalizedInputs.map(val => {
                if (val === null || val === undefined) {
                    return '';
                }
                
                if (Buffer.isBuffer(val) || val instanceof Uint8Array) {
                    return Buffer.from(val).toString('utf8');
                }
                
                // If it's a JSON string (likely headers), parse it to normalize
                if (typeof val === 'string' && 
                    (val.startsWith('{') && val.endsWith('}')) || 
                    (val.startsWith('[') && val.endsWith(']'))) {
                    try {
                        const parsed = JSON.parse(val);
                        // Sort keys to ensure consistent ordering
                        return JSON.stringify(parsed, Object.keys(parsed).sort());
                    } catch (e) {
                        // Not valid JSON, use as-is
                        return String(val);
                    }
                }
                
                return String(val);
            });
            
            const combined = normalized.join('|');
            this.log(`Hash input: ${combined}`); // Use conditional logging
            
            const data = encoder.encode(combined);
            const hashBuffer = await webcrypto.subtle.digest("SHA-256", data);
            return Buffer.from(hashBuffer); // Return as Buffer for consistency
        } catch (error) {
            console.error("Hash computation error:", error);
            throw error;
        }
    }

    /**
     * Stores an HTTP request and response as a cache entry.
     * @param {Object} data - Request/response data
     * @returns {Promise<Object>} - The stored cache entry
     */
    async store_request_response(data) {
        if (!this.db_adapter.is_connected) {
            await this.init();
        }
        
        if (!data?.method || !data?.url || !data?.response_body) {
            throw new Error('Required fields missing: method, url, response_body');
        }
        
        try {
            // Normalize headers to lowercase keys
            const requestHeaders = this.normalizeHeaders(data.headers || {});
            const responseHeaders = this.normalizeHeaders(data.response_headers || {});
            
            // Extract content types
            const requestMimeType = requestHeaders['content-type'] || '';
            const responseMimeType = responseHeaders['content-type'] || '';
            
            // Generate request hash (used for cache key)
            const requestHash = await this.computeHash(data.method, data.url);
            
            // Create cache entry object
            const cacheEntry = {
                request_method: data.method,
                request_url: data.url,
                request_hash: requestHash,
                request_headers: JSON.stringify(requestHeaders),
                response_status: data.status_code,
                response_headers: JSON.stringify(responseHeaders),
                stored_at: Date.now(),
                metadata: {}
            };
            
            // Process request body if present
            if (data.request_body) {
                const requestBody = this.ensureBuffer(data.request_body);
                const requestBodyHash = await this.computeHash('request_body', requestBody);
                
                // Check if request body should be platform compressed
                const compressRequest = this.compression_manager.shouldCompress(requestBody, requestMimeType);
                
                // Store request body
                const requestBodyEntry = await this.storeBody({
                    content: requestBody,
                    hash: requestBodyHash,
                    mime_type: requestMimeType,
                    should_compress: compressRequest
                });
                
                cacheEntry.request_body_hash = requestBodyHash;
                cacheEntry.metadata.request_body_info = {
                    size: requestBody.length,
                    is_platform_compressed: requestBodyEntry.is_platform_compressed
                };
            }
            
            // Process response body
            const responseBody = this.ensureBuffer(data.response_body);
            const responseBodyHash = await this.computeHash('response_body', responseBody);
            
            // Check if response body should be platform compressed
            const compressResponse = this.compression_manager.shouldCompress(responseBody, responseMimeType);
            
            // Store response body
            const responseBodyEntry = await this.storeBody({
                content: responseBody,
                hash: responseBodyHash,
                mime_type: responseMimeType,
                should_compress: compressResponse
            });
            
            cacheEntry.response_hash = responseBodyHash;
            cacheEntry.metadata.response_body_info = {
                size: responseBody.length,
                is_platform_compressed: responseBodyEntry.is_platform_compressed
            };
            
            // Add any additional metadata from the input
            if (data.metadata) {
                cacheEntry.metadata = { ...cacheEntry.metadata, ...data.metadata };
            }
            
            // Convert metadata to JSON string
            cacheEntry.metadata = JSON.stringify(cacheEntry.metadata);
            
            // Store the cache entry
            const storedEntry = await this.db_adapter.store_cache_entry(cacheEntry);
            
            this.log(`Stored cache entry for ${data.method} ${data.url}`);
            this.raise_event('store_success', {
                url: data.url,
                method: data.method,
                has_request_body: !!data.request_body
            });
            
            return storedEntry;
        } catch (error) {
            this.raise_event('store_error', { url: data.url, error });
            throw error;
        }
    }
    
    /**
     * Stores a body (request or response) in the database.
     * @private
     * @param {Object} options - Body storage options
     * @returns {Promise<Object>} - The stored body entry
     */
    async storeBody({ content, hash, mime_type, should_compress }) {
        let bodyContent = content;
        let is_platform_compressed = false;
        let platform_compression_algo = null;
        let original_size = content.length;
        
        // If compression is recommended, compress the content
        if (should_compress) {
            platform_compression_algo = this.compression_manager.default_algorithm;
            bodyContent = await this.compression_manager.compress(platform_compression_algo, content);
            is_platform_compressed = true;
        }
        
        // Create body entry
        const bodyEntry = {
            hash,
            content: bodyContent,
            mime_type,
            platform_compression_algo,
            is_platform_compressed,
            original_size,
            stored_at: Date.now()
        };
        
        // Store the body
        await this.db_adapter.store_body(bodyEntry);
        
        return bodyEntry;
    }
    
    /**
     * Normalizes HTTP headers to lowercase keys.
     * @private
     * @param {Object} headers - HTTP headers
     * @returns {Object} - Normalized headers
     */
    normalizeHeaders(headers) {
        const normalized = {};
        Object.keys(headers).forEach(key => {
            normalized[key.toLowerCase()] = headers[key];
        });
        return normalized;
    }
    
    /**
     * Ensures content is a Buffer.
     * @private
     * @param {string|Buffer|Uint8Array} content - Content to convert
     * @returns {Buffer} - Content as Buffer
     */
    ensureBuffer(content) {
        if (Buffer.isBuffer(content)) {
            return content;
        }
        if (content instanceof Uint8Array) {
            return Buffer.from(content);
        }
        return Buffer.from(String(content));
    }

    /**
     * Retrieves a cached response based on request details.
     * @param {Object} request_details - { method, url, headers }
     * @returns {Promise<Object|null>} - The cached response or null
     */
    async get_cached_response(request_details) {
        if (!this.db_adapter.is_connected) {
            await this.init();
        }
        
        if (!request_details?.method || !request_details?.url) {
            console.log('request_details?.method', request_details?.method);
            console.log('request_details?.url', request_details?.url);
            throw new Error('Required fields missing: method, url');
        }
        
        try {
            // Compute request hash for lookup
            const requestHash = await this.computeHash(request_details.method, request_details.url);
            
            // Find cache entry by request hash
            const cacheEntry = await this.db_adapter.get_cache_entry_by_request({
                request_hash: requestHash
            });
            
            if (!cacheEntry) {
                this.raise_event('cache_miss', {
                    method: request_details.method,
                    url: request_details.url
                });
                return null;
            }
            
            // Update last accessed time
            await this.db_adapter.update_cache_entry_access_time(cacheEntry.id);
            
            // Get response body
            const responseBody = await this.db_adapter.get_body_by_hash(cacheEntry.response_hash);
            
            if (!responseBody) {
                this.log(`Cache entry found but response body missing for ${request_details.url}`);
                this.raise_event('cache_error', {
                    method: request_details.method,
                    url: request_details.url,
                    error: 'Response body missing'
                });
                return null;
            }
            
            // Decompress if needed
            let content = responseBody.content;
            if (responseBody.is_platform_compressed) {
                content = await this.compression_manager.decompress(
                    responseBody.platform_compression_algo,
                    content
                );
            }
            
            // Create response object
            const response = {
                method: cacheEntry.request_method,
                url: cacheEntry.request_url,
                status: cacheEntry.response_status,
                headers: JSON.parse(cacheEntry.response_headers || '{}'),
                body: content,
                metadata: JSON.parse(cacheEntry.metadata || '{}'),
                stored_at: cacheEntry.stored_at,
                is_platform_compressed: responseBody.is_platform_compressed,
                mime_type: responseBody.mime_type
            };
            
            // Get request body if it exists
            if (cacheEntry.request_body_hash) {
                const requestBody = await this.db_adapter.get_body_by_hash(cacheEntry.request_body_hash);
                if (requestBody) {
                    let requestContent = requestBody.content;
                    if (requestBody.is_platform_compressed) {
                        requestContent = await this.compression_manager.decompress(
                            requestBody.platform_compression_algo,
                            requestContent
                        );
                    }
                    response.request_body = requestContent;
                }
            }
            
            this.raise_event('cache_hit', {
                method: request_details.method,
                url: request_details.url,
                status: cacheEntry.response_status
            });
            
            // Fix to maintain backward compatibility with tests:
            const fileResponse = responseBody.is_platform_compressed
                ? new Platform_Compressed_File({
                    hash: cacheEntry.response_hash,
                    mime_type: responseBody.mime_type,
                    compression_algorithm: responseBody.platform_compression_algo,
                    original_size: responseBody.original_size,
                    metadata: JSON.parse(cacheEntry.metadata || '{}')
                  })
                : new Not_Platform_Compressed_File({
                    hash: cacheEntry.response_hash,
                    mime_type: responseBody.mime_type,
                    metadata: JSON.parse(cacheEntry.metadata || '{}')
                  });
            
            fileResponse.set_content(content);
            return fileResponse;
        } catch (error) {
            this.raise_event('get_error', {
                method: request_details.method,
                url: request_details.url,
                error
            });
            throw error;
        }
    }

    create_file_from_storage_object(obj) {
        if (!obj) return null;
        
        const Constructor = obj.is_platform_compressed || (obj.compression_algorithm && obj.compression_algorithm !== 'none')
            ? Platform_Compressed_File 
            : Not_Platform_Compressed_File;
        
        const file = new Constructor({
            hash: obj.hash,
            mime_type: obj.mime_type,
            stored_at: obj.stored_at,
            metadata: obj.metadata,
            compression_algorithm: obj.platform_compression_algo || obj.compression_algorithm,
            original_size: obj.original_size
        });
        
        if (obj.body_content) {
            // Ensure content is a Buffer
            file.set_content(Buffer.isBuffer(obj.body_content) 
                ? obj.body_content 
                : Buffer.from(obj.body_content));
        }
        
        return file;
    }

    /**
     * Deletes a cached HTTP response.
     * Computes the hash if not already provided.
     * @param {Object} request_details - { method, url, headers }
     * @returns {Promise<void>}
     */
    async delete_cached_response(request_details) {
        if (!this.db_adapter.is_connected) {
            await this.init();
        }
        if (!request_details?.method || !request_details?.url) {
            throw new Error('Required fields missing: method, url');
        }
        if (!request_details.hash) {
            request_details.hash = await this.computeHash(
                request_details.method, 
                request_details.url
            );
        }
        try {
            await this.db_adapter.delete_cached_response(request_details);
            this.raise_event('delete_success', { url: request_details.url });
            return true;
        } catch (error) {
            this.raise_event('delete_error', { url: request_details.url, error });
            throw error;
        }
    }

    /**
     * Clears the cache.
     * @returns {Promise<void>}
     */
    async clear_cache() {
        return this.db_adapter.clear_cache();
    }
    
    /**
     * Count all files in cache (requests and responses)
     * @returns {Promise<number>} Total number of cached files
     */
    async count_files() {
        if (!this.db_adapter.is_connected) {
            await this.init();
        }
        
        try {
            const count = await this.db_adapter.count_files();
            return count;
        } catch (error) {
            this.raise_event('error', { operation: 'count_files', error });
            throw error;
        }
    }
    
    /**
     * Count requests in cache
     * @returns {Promise<number>} Number of cached requests
     */
    async count_requests() {
        if (!this.db_adapter.is_connected) {
            await this.init();
        }
        
        try {
            const count = await this.db_adapter.count_requests();
            return count;
        } catch (error) {
            this.raise_event('error', { operation: 'count_requests', error });
            throw error;
        }
    }
    
    /**
     * Count responses in cache
     * @returns {Promise<number>} Number of cached responses
     */
    async count_responses() {
        if (!this.db_adapter.is_connected) {
            await this.init();
        }
        
        try {
            const count = await this.db_adapter.count_responses();
            return count;
        } catch (error) {
            this.raise_event('error', { operation: 'count_responses', error });
            throw error;
        }
    }

    /**
     * Count cache entries that match a given URL
     * @param {string} url - The URL to match against
     * @returns {Promise<number>} Number of matching cache entries
     */
    async count_cache_entries_by_url(url) {
        if (!this.db_adapter.is_connected) {
            await this.init();
        }
        
        try {
            return await this.db_adapter.count_cache_entries_by_url(url);
        } catch (error) {
            this.raise_event('error', { operation: 'count_cache_entries_by_url', error });
            throw error;
        }
    }
    
    /**
     * Get stored_at timestamps for cache entries matching a URL
     * @param {string} url - The URL to match against
     * @returns {Promise<Array<number>>} Array of timestamps
     */
    async get_cache_entry_stored_at_timestamps_by_url(url) {
        if (!this.db_adapter.is_connected) {
            await this.init();
        }
        
        try {
            return await this.db_adapter.get_cache_entry_stored_at_timestamps_by_url(url);
        } catch (error) {
            this.raise_event('error', { operation: 'get_cache_entry_stored_at_timestamps_by_url', error });
            throw error;
        }
    }

    /**
     * Close the database connection - used for cleanup
     * @returns {Promise<void>}
     */
    async close() {
        if (this.db_adapter && typeof this.db_adapter.disconnect === 'function') {
            return this.db_adapter.disconnect();
        }
    }
    
    /**
     * Completely destroy the cache, including the database file if applicable
     * @param {Object} options - Configuration options
     * @param {boolean} options.deleteFile - Whether to delete the database file
     * @returns {Promise<boolean>} - Success status
     */
    async destroy(options = {}) {
        try {
            // First ensure everything is closed properly
            await this.close();
            
            // If deleteFile is requested and the adapter supports it
            if (options.deleteFile && this.db_adapter && typeof this.db_adapter.deleteFile === 'function') {
                await this.db_adapter.deleteFile();
                await new Promise(resolve => setTimeout(resolve, 300)); // Wait a bit to ensure file handles are released
            }
            
            this.raise_event('destroyed');
            return true;
        } catch (error) {
            this.raise_event('error', { operation: 'destroy', error });
            throw error;
        }
    }
}

module.exports = HTTP_Cache_Store_Storage_Adapter;
