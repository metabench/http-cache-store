const test = require('node:test');
const assert = require('assert');
const HTTP_Cache_Store_DB_Adapter_SQLite = require('../storage/db/adapter/HTTP_Cache_Store_DB_Adapter_SQLite');
const HTTP_Cache_Store_Storage_Adapter = require('../storage/HTTP_Cache_Store_Storage_Adapter');
const BackEnd = require('../BackEnd');

// Make tests run sequentially
test('Backend lifecycle test suite', { concurrency: 1 }, async (t) => {
    // Create a new backend for each subtest
    let backend = null;
    
    // Setup function to create a fresh backend
    const setupBackend = async () => {
        // Ensure previous backend is shut down
        if (backend) {
            await backend.shutdown();
            backend = null;
        }
        
        // Create new backend
        backend = new BackEnd({
            verbose: process.env.VERBOSE_TESTS === 'true'
        });
        
        // Wait for it to start
        await backend.start();
        return backend;
    };
    
    // Teardown function to clean up
    const teardownBackend = async () => {
        if (backend) {
            await backend.shutdown();
            backend = null;
        }
    };
    
    // Run a subtest with its own backend instance
    await t.test('Store and retrieve sample HTML document with large smiley emoji', async () => {
        // Set up in-memory database
        const dbAdapter = new HTTP_Cache_Store_DB_Adapter_SQLite({ 
            db_path: ':memory:',
            verbose: process.env.VERBOSE_TESTS === 'true'
        });
        await dbAdapter.connect();

        // Set up schema for testing
        await new Promise((resolve, reject) => {
            dbAdapter.db.run(`
                CREATE TABLE IF NOT EXISTS bodies (
                    uncompressed_hash BLOB PRIMARY KEY,
                    body_content BLOB,
                    compression_process_id TEXT
                )
            `, (err) => err ? reject(err) : resolve());
        });
        
        const storageAdapter = new HTTP_Cache_Store_Storage_Adapter({ 
            db_adapter: dbAdapter,
            verbose: process.env.VERBOSE_TESTS === 'true'
        });
        
        // Sample HTML document with a large smiley emoji
        const sampleHTML = `<html><body style="text-align:center;"><h1 style="font-size:100px;">😀</h1></body></html>`;
        const data = {
            method: 'GET',
            url: 'http://localhost/test',
            headers: { 'content-type': 'text/html' },
            request_body: '',
            response_body: sampleHTML,
            status_code: 200
        };
        
        // Store the record
        await storageAdapter.store_request_response(data);
        
        // Retrieve the stored record
        const cached = await storageAdapter.get_cached_response({
            method: 'GET',
            url: 'http://localhost/test',
            headers: { 'content-type': 'text/html' }
        });
        
        assert(cached, 'Cached result should not be null');
        assert.strictEqual(cached.get_content().toString(), sampleHTML, 'Retrieved HTML should match the original');
        
        await dbAdapter.disconnect();
    });
    
    // Clean up after all tests
    t.after(async () => {
        await teardownBackend();
    });
});

// This file can be removed since tests are consolidated into backend.integration.test.js
// If you want to keep it for reference, rename it to something like backend.integration.node.test.js.bak
