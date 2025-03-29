const { Evented_Class } = require('lang-mini');

/**
 * Abstract Base Class for HTTP Cache Store Database Adapters.
 * Interfaces with a database that follows `schema_common.sql`.
 */
class HTTP_Cache_Store_DB_Adapter extends Evented_Class {
    constructor(options = {}) {
        super();

        if (new.target === HTTP_Cache_Store_DB_Adapter) {
            throw new Error("HTTP_Cache_Store_DB_Adapter is an abstract class and cannot be instantiated directly.");
        }

        this.options = options;
        this.is_connected = false; // Changed from 'connected' to 'is_connected' for consistency
    }

    /**
     * Connect to the database.
     * Must be implemented by subclasses.
     * @returns {Promise<void>}
     */
    async connect() {
        throw new Error("connect() must be implemented by a subclass");
    }

    /**
     * Disconnect from the database.
     * Must be implemented by subclasses.
     * @returns {Promise<void>}
     */
    async disconnect() {
        throw new Error("disconnect() must be implemented by a subclass");
    }

    /**
     * Stores an HTTP request and response in the cache.
     * Uses the `bodies` table for storing request/response bodies.
     * @param {Object} data - { method, url, headers, request_body, response_body, status_code, compression_process_id }
     * @returns {Promise<void>}
     */
    async store_request_response(data) {
        throw new Error("store_request_response() must be implemented by a subclass");
    }

    /**
     * Retrieves a cached HTTP response based on request details.
     * Looks up using `bodies.uncompressed_hash` and metadata.
     * @param {Object} request_details - { method, url, headers }
     * @returns {Promise<Object|null>} - Returns cached response or null if not found.
     */
    async get_cached_response(request_details) {
        throw new Error("get_cached_response() must be implemented by a subclass");
    }

    /**
     * Deletes a cached HTTP response based on request details.
     * Deletes from `bodies` using hash or metadata.
     * @param {Object} request_details - { method, url, headers }
     * @returns {Promise<void>}
     */
    async delete_cached_response(request_details) {
        throw new Error("delete_cached_response() must be implemented by a subclass");
    }

    /**
     * Clears all cached responses (truncate `bodies` table).
     * @returns {Promise<void>}
     */
    async clear_cache() {
        throw new Error("clear_cache() must be implemented by a subclass");
    }

    /**
     * Returns whether a body already exists in storage based on its hash.
     * This is useful for avoiding duplicate storage.
     * @param {string} hash - The hash of the request/response body.
     * @returns {Promise<boolean>} - Returns true if the hash exists.
     */
    async body_exists(hash) {
        throw new Error("body_exists() must be implemented by a subclass");
    }

    /**
     * Retrieves a response body by its hash.
     * Needed when looking up cached responses.
     * @param {string} hash - The hash of the response body.
     * @returns {Promise<string|null>} - Returns the body content or null.
     */
    async get_body_by_hash(hash) {
        throw new Error("get_body_by_hash() must be implemented by a subclass");
    }

    /**
     * Stores a response/request body in the `bodies` table.
     * @param {string} hash - Hash of the body.
     * @param {string} body - The response/request body content.
     * @param {number|null} compression_process_id - ID of the compression process (if used).
     * @returns {Promise<void>}
     */
    async store_body(hash, body, compression_process_id = null) {
        throw new Error("store_body() must be implemented by a subclass");
    }

    /**
     * Checks the health/status of the database.
     * @returns {Promise<boolean>} - Returns true if the DB is healthy.
     */
    async check_health() {
        throw new Error("check_health() must be implemented by a subclass");
    }

    /**
     * Runs a raw SQL query (optional utility method).
     * Some databases may support it, some may not.
     * @param {string} query - The SQL query to execute.
     * @param {Array} params - The parameters for the query.
     * @returns {Promise<Object[]>} - Returns query results.
     */
    async run_query(query, params = []) {
        throw new Error("run_query() must be implemented by a subclass if supported");
    }

    /**
     * Emits event notifications for caching operations.
     * @param {string} type - The event type (e.g., 'cache_hit', 'cache_miss').
     * @param {Object} data - Additional event data.
     */
    emit_cache_event(type, data) {
        this.raise_event(type, data);
    }

    /**
     * Count all files in the cache
     * @returns {Promise<number>} Total count
     */
    async count_files() {
        throw new Error('count_files() must be implemented by subclasses');
    }
    
    /**
     * Count request files in the cache
     * @returns {Promise<number>} Request count
     */
    async count_requests() {
        throw new Error('count_requests() must be implemented by subclasses');
    }
    
    /**
     * Count response files in the cache
     * @returns {Promise<number>} Response count
     */
    async count_responses() {
        throw new Error('count_responses() must be implemented by subclasses');
    }

    /**
     * Stores a cache entry (request-response pair).
     * @param {Object} cacheEntry - The cache entry to store
     * @returns {Promise<Object>} - The stored cache entry
     */
    async store_cache_entry(cacheEntry) {
        throw new Error("store_cache_entry() must be implemented by a subclass");
    }
    
    /**
     * Stores a body (request or response).
     * @param {Object} bodyEntry - The body entry to store
     * @returns {Promise<Object>} - The stored body entry
     */
    async store_body(bodyEntry) {
        throw new Error("store_body() must be implemented by a subclass");
    }
    
    /**
     * Retrieves a cache entry by request details.
     * @param {Object} request - { request_hash, method, url }
     * @returns {Promise<Object|null>} - The cache entry or null
     */
    async get_cache_entry_by_request(request) {
        throw new Error("get_cache_entry_by_request() must be implemented by a subclass");
    }
    
    /**
     * Retrieves a body by its hash.
     * @param {Buffer} hash - The body hash
     * @returns {Promise<Object|null>} - The body entry or null
     */
    async get_body_by_hash(hash) {
        throw new Error("get_body_by_hash() must be implemented by a subclass");
    }
    
    /**
     * Updates the last accessed time for a cache entry.
     * @param {number} id - The cache entry ID
     * @returns {Promise<void>}
     */
    async update_cache_entry_access_time(id) {
        throw new Error("update_cache_entry_access_time() must be implemented by a subclass");
    }
    
    /**
     * Deletes a cache entry by its ID.
     * @param {number} id - The cache entry ID
     * @returns {Promise<void>}
     */
    async delete_cache_entry(id) {
        throw new Error("delete_cache_entry() must be implemented by a subclass");
    }
    
    /**
     * Deletes a body by its hash.
     * @param {Buffer} hash - The body hash
     * @returns {Promise<void>}
     */
    async delete_body(hash) {
        throw new Error("delete_body() must be implemented by a subclass");
    }
}

module.exports = HTTP_Cache_Store_DB_Adapter;
