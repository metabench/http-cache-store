const Evented_Class = require('lang-mini').Evented_Class;
const HTTP_Cache_Store_Storage_Adapter = require('./storage/HTTP_Cache_Store_Storage_Adapter');
const config = require('./storage/config');
const { get: http_get, Agent } = require('http');
const { get: https_get, Agent: HttpsAgent } = require('https');
const zlib = require('zlib');

// Add a delay between HTTP requests to prevent connection issues
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 500; // 0.5 seconds

const VERBOSE_LOGGING = false;

const download_html = (url, userAgent = null, timeoutMs = 10000) =>
  new Promise(async (resolve, reject) => {
    // Log download start
    const downloadStartTime = Date.now();
    console.log(`🔄 Starting download: ${url}`);
    console.log(`📅 Download started at: ${new Date().toISOString()}`);
    
    VERBOSE_LOGGING && console.log(`[DEBUG] 🔄 DOWNLOAD_HTML STARTING for: ${url}`);
    VERBOSE_LOGGING && console.log(`[DEBUG] Request timestamp: ${new Date().toISOString()}`);
    
    // Add delay to prevent rapid successive requests
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime;
    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      VERBOSE_LOGGING && console.log(`[DEBUG] ⏱️ Waiting ${delay}ms between requests (last request was ${timeSinceLastRequest}ms ago)...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    lastRequestTime = Date.now();
    VERBOSE_LOGGING && console.log(`[DEBUG] ✅ Request delay completed, proceeding with download`);
    
    const client = url.startsWith('https') ? https_get : http_get;
    VERBOSE_LOGGING && console.log(`[DEBUG] 🌐 Using ${url.startsWith('https') ? 'HTTPS' : 'HTTP'} client`);
    VERBOSE_LOGGING && console.log(`[DEBUG] 🎯 Target URL: ${url}`);
    
    // Create a fresh agent for each request to avoid TLS session reuse
    const isHttps = url.startsWith('https');
    const freshAgent = isHttps ? 
      new HttpsAgent({ 
        keepAlive: false,
        maxSockets: 1,
        maxFreeSockets: 0,
        maxCachedSessions: 0,  // Disable TLS session caching
        rejectUnauthorized: true
      }) : 
      new Agent({ 
        keepAlive: false,
        maxSockets: 1,
        maxFreeSockets: 0
      });
    
    VERBOSE_LOGGING && console.log(`[DEBUG] 🔒 Created fresh ${isHttps ? 'HTTPS' : 'HTTP'} agent with no session cache`);
    
    const options = {
      headers: {
        'User-Agent': userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'close',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none'
      },
      agent: freshAgent
    };
    
    VERBOSE_LOGGING && console.log('[DEBUG] 📋 Request options:', JSON.stringify(options, null, 2));
    
    // Set a reasonable timeout for HTTP requests
    const timeout = timeoutMs; // Use the provided timeout parameter
    VERBOSE_LOGGING && console.log(`[DEBUG] ⏰ Request timeout set to: ${timeout}ms`);

    VERBOSE_LOGGING && console.log('[DEBUG] 🚀 Making HTTP request...');
    const requestStartTime = Date.now();
    let responseStartTime = null; // Track when response headers arrive
    let firstByteTime = null; // Track when first data arrives
    
    const req = client(url, options, res => {
      responseStartTime = Date.now();
      const responseLatency = responseStartTime - requestStartTime;
      console.log(`📡 Response received for ${url} - Latency: ${responseLatency}ms - Status: ${res.statusCode}`);
      
      VERBOSE_LOGGING && console.log(`[DEBUG] 📥 RESPONSE RECEIVED after ${responseLatency}ms - Status: ${res.statusCode}`);
      VERBOSE_LOGGING && console.log(`[DEBUG] Response status message: ${res.statusMessage}`);
      VERBOSE_LOGGING && console.log('[DEBUG] 📊 Response headers:');
      Object.entries(res.headers).forEach(([key, value]) => {
        VERBOSE_LOGGING && console.log(`[DEBUG]   ${key}: ${value}`);
      });
      
      // Handle redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        VERBOSE_LOGGING && console.log(`[DEBUG] 🔄 REDIRECT detected to: ${res.headers.location}`);
        
        // Clean up the current agent before following redirect
        VERBOSE_LOGGING && console.log('[DEBUG] 🧹 Destroying agent before following redirect');
        freshAgent.destroy();
        
        req.destroy(); // Properly close the current request
        VERBOSE_LOGGING && console.log(`[DEBUG] 🔒 Original request destroyed, following redirect...`);
        return download_html(res.headers.location, userAgent, timeoutMs).then(resolve).catch(reject);
      }
      
      const encoding = res.headers['content-encoding'];
      VERBOSE_LOGGING && console.log(`[DEBUG] 📦 Content encoding: ${encoding || 'none'}`);
      VERBOSE_LOGGING && console.log(`[DEBUG] 📏 Content length: ${res.headers['content-length']}`);
      VERBOSE_LOGGING && console.log(`[DEBUG] 📄 Content type: ${res.headers['content-type']}`);
      
      let html = '';
      let stream = res;
      let bytesReceived = 0;
      
      // Handle gzip compression - but keep it simple
      if (encoding === 'gzip') {
        VERBOSE_LOGGING && console.log('[DEBUG] 🗜️ Setting up gzip decompression');
        const gunzip = zlib.createGunzip();
        
        // Proper error handling for gunzip
        gunzip.on('error', (error) => {
          VERBOSE_LOGGING && console.log(`[DEBUG] ❌ Gzip decompression error: ${error}`);
          req.destroy();
          reject(error);
        });
        
        gunzip.on('pipe', () => {
          VERBOSE_LOGGING && console.log('[DEBUG] 🔗 Gzip stream piped successfully');
        });
        
        stream = res.pipe(gunzip);
      }
      
      // Ensure we handle encoding properly
      stream.setEncoding('utf8');
      VERBOSE_LOGGING && console.log('[DEBUG] 🔤 Stream encoding set to UTF-8');
      
      const dataStartTime = Date.now();
      
      stream.on('data', chunk => {
        bytesReceived += chunk.length;
        html += chunk;
        
        // Log progress for large downloads
        if (bytesReceived % 100000 === 0) { // Every 100KB
          VERBOSE_LOGGING && console.log(`[DEBUG] 📊 Downloaded ${bytesReceived} characters so far...`);
        }
      });
      
      stream.on('end', () => {
        const downloadEndTime = Date.now();
        const totalDownloadTime = downloadEndTime - downloadStartTime;
        const dataTransferTime = downloadEndTime - (responseStartTime || downloadStartTime);
        
        // Console logging for download completion
        console.log(`✅ Download completed: ${url}`);
        console.log(`⏱️ Total download time: ${totalDownloadTime}ms`);
        console.log(`📊 Data transfer time: ${dataTransferTime}ms`);
        console.log(`📏 Downloaded ${html.length} characters (${bytesReceived} bytes)`);
        
        VERBOSE_LOGGING && console.log(`[DEBUG] ✅ DOWNLOAD COMPLETE after ${dataTransferTime}ms (total: ${totalDownloadTime}ms)`);
        VERBOSE_LOGGING && console.log(`[DEBUG] 📏 Total size: ${html.length} characters`);
        VERBOSE_LOGGING && console.log(`[DEBUG] 📊 Bytes received: ${bytesReceived}`);
        VERBOSE_LOGGING && console.log(`[DEBUG] 🔍 First 200 chars: ${html.substring(0, 200)}...`);
        VERBOSE_LOGGING && console.log(`[DEBUG] 🔍 Last 100 chars: ...${html.substring(html.length - 100)}`);
        VERBOSE_LOGGING && console.log('[DEBUG] 🔒 Response connection closed');
        
        // Clean up the agent to prevent session reuse
        VERBOSE_LOGGING && console.log('[DEBUG] 🧹 Destroying agent to prevent session reuse');
        freshAgent.destroy();
        
        const responseLatency = responseStartTime ? (responseStartTime - requestStartTime) : null;
        
        const result = {
          html,
          status_code: res.statusCode,
          headers: res.headers,
          timing: {
            download_start_time: downloadStartTime,
            request_start_time: requestStartTime,
            response_start_time: responseStartTime,
            download_end_time: downloadEndTime,
            total_download_time_ms: totalDownloadTime,
            response_latency_ms: responseLatency,
            data_transfer_time_ms: dataTransferTime
          }
        };
        
        VERBOSE_LOGGING && console.log(`[DEBUG] 🎉 DOWNLOAD_HTML SUCCESSFUL for: ${url}`);
        resolve(result);
      });
      
      stream.on('error', error => {
        VERBOSE_LOGGING && console.log(`[DEBUG] ❌ Stream error: ${error}`);
        VERBOSE_LOGGING && console.log(`[DEBUG] Stream error type: ${error.constructor.name}`);
        VERBOSE_LOGGING && console.log(`[DEBUG] Stream error code: ${error.code}`);
        
        // Clean up the agent on error
        VERBOSE_LOGGING && console.log('[DEBUG] 🧹 Destroying agent due to stream error');
        freshAgent.destroy();
        
        req.destroy();
        reject(error);
      });
    });
    
    req.on('socket', socket => {
      VERBOSE_LOGGING && console.log('[DEBUG] 🔌 Socket assigned to request');
      VERBOSE_LOGGING && console.log(`[DEBUG] Socket details: ${socket.constructor.name}`);
      
      socket.on('connect', () => {
        const connectTime = Date.now() - requestStartTime;
        VERBOSE_LOGGING && console.log(`[DEBUG] ✅ Socket connected after ${connectTime}ms`);
        VERBOSE_LOGGING && console.log(`[DEBUG] Socket state: readable=${socket.readable}, writable=${socket.writable}`);
      });
      
      socket.on('error', error => {
        const errorTime = Date.now() - requestStartTime;
        VERBOSE_LOGGING && console.log(`[DEBUG] ❌ Socket error after ${errorTime}ms: ${error}`);
        VERBOSE_LOGGING && console.log(`[DEBUG] Socket error type: ${error.constructor.name}`);
        VERBOSE_LOGGING && console.log(`[DEBUG] Socket error code: ${error.code}`);
        VERBOSE_LOGGING && console.log(`[DEBUG] Socket error syscall: ${error.syscall}`);
        req.destroy(); // Ensure request is properly closed
      });
      
      socket.on('close', () => {
        const closeTime = Date.now() - requestStartTime;
        VERBOSE_LOGGING && console.log(`[DEBUG] 🔒 Socket closed after ${closeTime}ms`);
      });
      
      socket.on('timeout', () => {
        VERBOSE_LOGGING && console.log('[DEBUG] ⏰ Socket timeout');
      });
    });
    
    req.on('error', error => {
      const errorTime = Date.now() - requestStartTime;
      VERBOSE_LOGGING && console.log(`[DEBUG] ❌ REQUEST ERROR after ${errorTime}ms: ${error}`);
      VERBOSE_LOGGING && console.log(`[DEBUG] Request error type: ${error.constructor.name}`);
      VERBOSE_LOGGING && console.log('[DEBUG] 📋 Error details:', {
        code: error.code,
        errno: error.errno,
        syscall: error.syscall,
        address: error.address,
        port: error.port,
        stack: error.stack?.split('\n')[0]
      });
      
      // Clean up the agent on error
      VERBOSE_LOGGING && console.log('[DEBUG] 🧹 Destroying agent due to request error');
      freshAgent.destroy();
      
      req.destroy(); // Ensure request is properly closed
      VERBOSE_LOGGING && console.log(`[DEBUG] 💥 DOWNLOAD_HTML FAILED for: ${url}`);
      reject(error);
    });
    
    req.setTimeout(timeout, () => {
      const timeoutTime = Date.now() - requestStartTime;
      VERBOSE_LOGGING && console.log(`[DEBUG] ⏰ Request timeout after ${timeoutTime}ms (limit: ${timeout}ms)`);
      
      // Clean up the agent on timeout
      VERBOSE_LOGGING && console.log('[DEBUG] 🧹 Destroying agent due to timeout');
      freshAgent.destroy();
      
      req.destroy(); // Properly close on timeout
      reject(new Error(`Request timeout after ${timeout}ms`));
    });
    
    VERBOSE_LOGGING && console.log('[DEBUG] 📤 Sending request (calling req.end())...');
    req.end();
    VERBOSE_LOGGING && console.log('[DEBUG] ✅ req.end() completed, waiting for response...');
  });

/**
 * Main backend class for HTTP Cache Store.
 * Initializes and manages the storage adapter and provides a clean interface for caching.
 */
class BackEnd extends Evented_Class {
    constructor(options = {}) {
        super();
        
        // Add verbose option
        this.verbose = options.verbose || false;
        
        // Add configurable request timeout (default 10 seconds)
        this.requestTimeout = options.requestTimeout || 10000;
        
        this.config = { ...config, ...options };
        this.id = Math.floor(Math.random() * 10000); // Add unique ID for logging
        this.log(`BackEnd #${this.id} initialized with ${this.requestTimeout}ms timeout.`);
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
    async store_response(data) {
        return this.storage_adapter.store_request_response(data);
    }

    /**
     * Retrieves a cached response if available.
     * @param {Object} request - Request details to lookup
     * @returns {Promise<Object|null>} - The cached file or null
     */
    async get_cached_response(request) {
        return this.storage_adapter.get_cached_response(request);
    }

    /**
     * Deletes a cached response.
     * @param {Object} request - Request details to delete
     * @returns {Promise<void>}
     */
    async delete_cached_response(request) {
        return this.storage_adapter.delete_cached_response(request);
    }

    /**
     * Clears all cached responses.
     * @returns {Promise<void>}
     */
    async clear_cache() {
        return this.storage_adapter.clear_cache();
    }

    /**
     * Count all cached files (both requests and responses)
     * @returns {Promise<number>} Total number of cached files
     */
    async count_files() {
        return this.storage_adapter.count_files();
    }

    /**
     * Count cached requests
     * @returns {Promise<number>} Number of cached requests
     */
    async count_requests() {
        return this.storage_adapter.count_requests();
    }

    /**
     * Count cached responses
     * @returns {Promise<number>} Number of cached responses
     */
    async count_responses() {
        return this.storage_adapter.count_responses();
    }

    /**
     * Count cache entries that match a given URL
     * @param {string} url - The URL to match against
     * @returns {Promise<number>} Number of matching cache entries
     */
    async count_cache_entries_by_url(url) {
        return this.storage_adapter.count_cache_entries_by_url(url);
    }
    
    /**
     * Get stored_at timestamps for cache entries matching a URL
     * @param {string} url - The URL to match against
     * @returns {Promise<Array<number>>} Array of timestamps
     */
    async get_cache_entry_stored_at_timestamps_by_url(url) {
        return this.storage_adapter.get_cache_entry_stored_at_timestamps_by_url(url);
    }

    /**
     * Downloads and caches a URL, or returns cached version if available
     * @param {string} url - The URL to fetch
     * @returns {Promise<Object>} - The cached file object
     */
    async get(url) {
        VERBOSE_LOGGING && console.log(`[DEBUG] ==========================================`);
        VERBOSE_LOGGING && console.log(`[DEBUG] BackEnd.get() called with URL: ${url}`);
        VERBOSE_LOGGING && console.log(`[DEBUG] Backend ID: ${this.id}`);
        VERBOSE_LOGGING && console.log(`[DEBUG] ==========================================`);
        
        // Check cache first
        VERBOSE_LOGGING && console.log(`[DEBUG] STEP 1: Checking cache for URL: ${url}`);
        const cached = await this.get_cached_response({
            method: 'GET',
            url: url
        });
        
        if (cached) {
            VERBOSE_LOGGING && console.log(`[DEBUG] ✅ CACHE HIT for ${url}`);
            VERBOSE_LOGGING && console.log(`[DEBUG] Cached content size: ${cached.get_content().length} chars`);
            VERBOSE_LOGGING && console.log(`[DEBUG] Cache metadata:`, cached.metadata ? Object.keys(cached.metadata) : 'none');
            return cached;
        } else {
            VERBOSE_LOGGING && console.log(`[DEBUG] ❌ CACHE MISS for ${url}, proceeding with download...`);
            this.log(`BackEnd #${this.id} cache miss for ${url}, downloading...`);
            
            try {
                // Download it
                VERBOSE_LOGGING && console.log(`[DEBUG] STEP 2: Starting download process for: ${url}`);
                VERBOSE_LOGGING && console.log(`[DEBUG] About to call download_html for: ${url}`);
                
                const downloadStartTime = Date.now();
                const o_downloaded = await download_html(url, null, this.requestTimeout);
                const downloadEndTime = Date.now();
                const overallDuration = downloadEndTime - downloadStartTime;
                
                VERBOSE_LOGGING && console.log(`[DEBUG] ✅ download_html completed successfully for: ${url}`);
                VERBOSE_LOGGING && console.log(`[DEBUG] Overall download operation took: ${overallDuration}ms`);
                VERBOSE_LOGGING && console.log(`[DEBUG] Downloaded data size: ${o_downloaded.html.length} characters`);
                VERBOSE_LOGGING && console.log(`[DEBUG] Response status: ${o_downloaded.status_code}`);
                VERBOSE_LOGGING && console.log(`[DEBUG] Response headers count: ${Object.keys(o_downloaded.headers).length}`);
                VERBOSE_LOGGING && console.log(`[DEBUG] HTML preview (first 100 chars): ${o_downloaded.html.substring(0, 100)}...`);
                
                // Log timing information
                if (o_downloaded.timing) {
                    console.log(`📈 Download timing for ${url}:`);
                    console.log(`   Response latency: ${o_downloaded.timing.response_latency_ms}ms`);
                    console.log(`   Total download time: ${o_downloaded.timing.total_download_time_ms}ms`);
                    console.log(`   Data transfer time: ${o_downloaded.timing.data_transfer_time_ms}ms`);
                }
                
                this.log(`BackEnd #${this.id} downloaded ${url}, status: ${o_downloaded.status_code}`);

                // Store the response with download timing metadata
                VERBOSE_LOGGING && console.log(`[DEBUG] STEP 3: Storing response in cache for: ${url}`);
                
                // Prepare metadata with timing information
                const metadata = {
                    download_timestamp: new Date().toISOString(),
                    download_start_time: downloadStartTime,
                    download_end_time: downloadEndTime,
                    overall_duration_ms: overallDuration
                };
                
                // Add detailed timing from download_html if available
                if (o_downloaded.timing) {
                    metadata.response_latency_ms = o_downloaded.timing.response_latency_ms;
                    metadata.total_download_time_ms = o_downloaded.timing.total_download_time_ms;
                    metadata.data_transfer_time_ms = o_downloaded.timing.data_transfer_time_ms;
                    metadata.request_start_time = o_downloaded.timing.request_start_time;
                    metadata.response_start_time = o_downloaded.timing.response_start_time;
                    metadata.download_start_time = o_downloaded.timing.download_start_time;
                    metadata.download_end_time = o_downloaded.timing.download_end_time;
                }
                
                VERBOSE_LOGGING && console.log(`[DEBUG] About to store response with timing metadata:`, {
                    method: 'GET',
                    url: url,
                    headers_count: Object.keys(o_downloaded.headers).length,
                    response_body_size: o_downloaded.html.length,
                    status_code: o_downloaded.status_code,
                    metadata: metadata
                });
                
                const storeStartTime = Date.now();
                const storeResult = await this.store_response({
                    method: 'GET',
                    url: url,
                    headers: o_downloaded.headers,
                    response_body: o_downloaded.html,
                    status_code: o_downloaded.status_code,
                    metadata: metadata
                });
                const storeEndTime = Date.now();
                
                VERBOSE_LOGGING && console.log(`[DEBUG] ✅ Response stored successfully for: ${url}`, storeResult ? 'with result' : 'no result');
                VERBOSE_LOGGING && console.log(`[DEBUG] Storage took: ${storeEndTime - storeStartTime}ms`);

                // Return the cached version  
                VERBOSE_LOGGING && console.log(`[DEBUG] STEP 4: Retrieving stored response from cache for: ${url}`);
                const retrieveStartTime = Date.now();
                const stored = await this.get_cached_response({
                    method: 'GET',
                    url: url
                });
                const retrieveEndTime = Date.now();
                
                if (stored) {
                    VERBOSE_LOGGING && console.log(`[DEBUG] ✅ Successfully retrieved stored response for: ${url}`);
                    VERBOSE_LOGGING && console.log(`[DEBUG] Retrieved content size: ${stored.get_content().length} chars`);
                    VERBOSE_LOGGING && console.log(`[DEBUG] Retrieval took: ${retrieveEndTime - retrieveStartTime}ms`);
                    VERBOSE_LOGGING && console.log(`[DEBUG] Final result has metadata:`, stored.metadata ? Object.keys(stored.metadata) : 'none');
                } else {
                    VERBOSE_LOGGING && console.log(`[DEBUG] ❌ WARNING: Failed to retrieve stored response for: ${url}`);
                    VERBOSE_LOGGING && console.log(`[DEBUG] This suggests a cache storage/retrieval issue`);
                }
                
                VERBOSE_LOGGING && console.log(`[DEBUG] ==========================================`);
                VERBOSE_LOGGING && console.log(`[DEBUG] BackEnd.get() completing for: ${url}`);
                VERBOSE_LOGGING && console.log(`[DEBUG] ==========================================`);
                
                return stored;
            } catch (error) {
                VERBOSE_LOGGING && console.log(`[DEBUG] ❌ ERROR in get() method for ${url}: ${error}`);
                VERBOSE_LOGGING && console.log(`[DEBUG] Error type: ${error.constructor.name}`);
                VERBOSE_LOGGING && console.log(`[DEBUG] Error code: ${error.code}`);
                VERBOSE_LOGGING && console.log(`[DEBUG] Error message: ${error.message}`);
                VERBOSE_LOGGING && console.log(`[DEBUG] Error stack:`, error.stack);
                this.log(`BackEnd #${this.id} error downloading ${url}: ${error.message}`);
                
                // Check if we have a cached version from a previous successful attempt
                VERBOSE_LOGGING && console.log(`[DEBUG] FALLBACK: Checking cache again after error for: ${url}`);
                const fallbackCached = await this.get_cached_response({
                    method: 'GET',
                    url: url
                });
                
                if (fallbackCached) {
                    VERBOSE_LOGGING && console.log(`[DEBUG] ✅ Found cached fallback for ${url}`);
                    return fallbackCached;
                } else {
                    VERBOSE_LOGGING && console.log(`[DEBUG] ❌ No cached fallback available for ${url}`);
                }
                
                VERBOSE_LOGGING && console.log(`[DEBUG] ==========================================`);
                VERBOSE_LOGGING && console.log(`[DEBUG] BackEnd.get() FAILED for: ${url}`);
                VERBOSE_LOGGING && console.log(`[DEBUG] ==========================================`);
                
                throw error;
            }
        }
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
