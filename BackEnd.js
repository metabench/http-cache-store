const Evented_Class = require('lang-mini').Evented_Class;
const HTTP_Cache_Store_Storage_Adapter = require('./storage/HTTP_Cache_Store_Storage_Adapter');
const config = require('./storage/config');

/**
 * Main backend class for HTTP Cache Store.
 * Initializes and manages the storage adapter and provides a clean interface for caching.
 */
class BackEnd extends Evented_Class {
    constructor(options = {}) {
        super();
        
        // Add verbose option
        this.verbose = options.verbose || false;
        
        this.config = { ...config, ...options };
        this.id = Math.floor(Math.random() * 10000); // Add unique ID for logging
        this.log(`BackEnd #${this.id} initialized.`);
    }

    // Add conditional logging method
    log(...args) {
        if (this.verbose) {
            console.log(...args);
        }
    }

    /**
     * Starts the backend and initializes the storage adapter.
     * @returns {Promise<void>}
     */
    async start() {
        try {
            this.log(`BackEnd #${this.id} starting...`);
            this.storage_adapter = new HTTP_Cache_Store_Storage_Adapter({
                db_path: this.config.dbPath,
                verbose: this.verbose
            });
            
            // Forward events from the storage adapter
            this.storage_adapter.on('error', (error) => {
                this.raise_event('error', error);
            });
            
            this.storage_adapter.on('ready', () => {
                this.raise_event('ready');
            });
            
            // Initialize the storage adapter
            await this.storage_adapter.init();
            this.log(`BackEnd #${this.id} storage adapter created and connected.`);
            this.log(`BackEnd #${this.id} is running...`);
            
            // We'll also emit our own ready event directly
            this.raise_event("ready");
            
            return true;
        } catch (error) {
            this.log(`BackEnd #${this.id} failed to start: ${error.message}`);
            this.raise_event("error", error);
            throw error;
        }
    }

    /**
     * Stores an HTTP request/response pair in the cache.
     * @param {Object} data - Request/response data to store
     * @returns {Promise<Object>} - The stored file
     */
    async storeResponse(data) {
        return this.storage_adapter.store_request_response(data);
    }

    /**
     * Retrieves a cached response if available.
     * @param {Object} request - Request details to lookup
     * @returns {Promise<Object|null>} - The cached file or null
     */
    async getCachedResponse(request) {
        return this.storage_adapter.get_cached_response(request);
    }

    /**
     * Deletes a cached response.
     * @param {Object} request - Request details to delete
     * @returns {Promise<void>}
     */
    async deleteCachedResponse(request) {
        return this.storage_adapter.delete_cached_response(request);
    }

    /**
     * Clears all cached responses.
     * @returns {Promise<void>}
     */
    async clearCache() {
        return this.storage_adapter.clear_cache();
    }

    /**
     * Count all cached files (both requests and responses)
     * @returns {Promise<number>} Total number of cached files
     */
    async countFiles() {
        return this.storage_adapter.count_files();
    }

    /**
     * Count cached requests
     * @returns {Promise<number>} Number of cached requests
     */
    async countRequests() {
        return this.storage_adapter.count_requests();
    }

    /**
     * Count cached responses
     * @returns {Promise<number>} Number of cached responses
     */
    async countResponses() {
        return this.storage_adapter.count_responses();
    }

    /**
     * Gracefully shuts down the backend.
     * @returns {Promise<void>}
     */
    async shutdown() {
        try {
            this.log(`BackEnd #${this.id} shutting down...`);
            if (this.storage_adapter && this.storage_adapter.db_adapter) {
                await this.storage_adapter.db_adapter.disconnect();
                this.log(`BackEnd #${this.id} database disconnected.`);
                this.raise_event('shutdown');
            }
            this.log(`BackEnd #${this.id} shutdown complete.`);
            return true;
        } catch (error) {
            this.log(`BackEnd #${this.id} error during shutdown: ${error.message}`);
            this.raise_event('error', error);
            throw error;
        }
    }
}

module.exports = BackEnd;
