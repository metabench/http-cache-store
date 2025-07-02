const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const BackEnd = require('../../BackEnd');

// Main test container that runs sequentially
test('Storage pipeline integration', { concurrency: 1 }, async (t) => {
    let backend = null;
    const testDbPath = path.join(__dirname, `test-db-${Date.now()}.sqlite`);
    
    // Set up backend before tests
    t.beforeEach(async () => {
        // Clean up any existing backend
        if (backend) {
            await backend.shutdown();
            backend = null;
        }
        
        // Create a new backend instance
        backend = new BackEnd({
            dbPath: testDbPath,
            verbose: process.env.VERBOSE_TESTS === 'true'
        });
        
        await backend.start();
    });
    
    // Clean up after each test
    t.afterEach(async () => {
        if (backend) {
            await backend.shutdown();
            backend = null;
        }
    });
    
    // Clean up at the end of all tests
    t.after(() => {
        // Try to clean up the test database file
        try {
            if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
            }
        } catch (err) {
            console.warn(`Warning: Could not delete test DB: ${err.message}`);
        }
    });
    
    // Your actual test
    await t.test('complete storage and retrieval workflow', async () => {
        // Initialize backend with custom configuration
        const backend = new BackEnd({
            dbPath: testDbPath
        });
        
        await backend.start();
        
        try {
            // 1. Store a text response
            const textResponse = {
                method: 'GET',
                url: 'https://example.com/text',
                headers: { 'content-type': 'text/html' },
                response_body: '<html><body>Hello World</body></html>',
                status_code: 200
            };
            
            await backend.store_response(textResponse);
            
            // 2. Store a JSON response
            const jsonResponse = {
                method: 'GET',
                url: 'https://example.com/api',
                headers: { 'content-type': 'application/json' },
                response_body: JSON.stringify({ message: 'Hello World' }),
                status_code: 200
            };
            
            await backend.store_response(jsonResponse);
            
            // 3. Store a binary response
            const binaryResponse = {
                method: 'GET',
                url: 'https://example.com/binary',
                headers: { 'content-type': 'application/octet-stream' },
                response_body: Buffer.from([0x00, 0xFF, 0x42, 0x13, 0x37]),
                status_code: 200
            };
            
            await backend.store_response(binaryResponse);
            
            // 4. Retrieve the stored responses
            const cachedText = await backend.get_cached_response({
                method: 'GET',
                url: 'https://example.com/text'
            });
            
            const cachedJson = await backend.get_cached_response({
                method: 'GET',
                url: 'https://example.com/api'
            });
            
            const cachedBinary = await backend.get_cached_response({
                method: 'GET',
                url: 'https://example.com/binary'
            });
            
            // 5. Verify the text response
            assert(cachedText, 'Text response should be cached');
            assert.strictEqual(
                cachedText.get_content().toString(),
                '<html><body>Hello World</body></html>',
                'Retrieved text should match original'
            );
            
            // Check for platform compression property instead of is_compressed
            assert('is_platform_compressed' in cachedText, 
                'Response should have is_platform_compressed property');
            
            // 6. Verify the JSON response
            assert(cachedJson, 'JSON response should be cached');
            assert.deepStrictEqual(
                JSON.parse(cachedJson.get_content().toString()),
                { message: 'Hello World' },
                'Retrieved JSON should match original'
            );
            
            // 7. Verify the binary response
            assert(cachedBinary, 'Binary response should be cached');
            assert.deepStrictEqual(
                cachedBinary.get_content(),
                Buffer.from([0x00, 0xFF, 0x42, 0x13, 0x37]),
                'Retrieved binary data should match original'
            );
            
            // 8. Test cache miss
            const notCached = await backend.get_cached_response({
                method: 'GET',
                url: 'https://example.com/not-cached'
            });
            
            assert.strictEqual(notCached, null, 'Non-existent URL should return null');
            
            // 9. Test cache deletion
            await backend.delete_cached_response({
                method: 'GET',
                url: 'https://example.com/text'
            });
            
            const deletedResponse = await backend.get_cached_response({
                method: 'GET',
                url: 'https://example.com/text'
            });
            
            assert.strictEqual(deletedResponse, null, 'Deleted response should return null');
            
        } finally {
            // Clean up
            await backend.shutdown();
        }
    });
    
    // Add a test for POST requests with bodies
    await t.test('store and retrieve POST request with body', async () => {
        const backend = new BackEnd({
            dbPath: testDbPath
        });
        
        await backend.start();
        
        try {
            // Store a POST request with a body
            const postData = {
                method: 'POST',
                url: 'https://example.com/api/submit',
                headers: { 
                    'content-type': 'application/json',
                    'accept': 'application/json'
                },
                request_body: JSON.stringify({ name: 'Example', value: 42 }),
                response_body: JSON.stringify({ success: true, id: 123 }),
                status_code: 201
            };
            
            await backend.store_response(postData);
            
            // Retrieve it
            const cached = await backend.get_cached_response({
                method: 'POST',
                url: 'https://example.com/api/submit'
            });
            
            assert(cached, 'POST response should be cached');
            assert.strictEqual(
                cached.get_content().toString(),
                JSON.stringify({ success: true, id: 123 }),
                'Retrieved response should match original'
            );
            
            // Check if metadata contains request body info
            assert(cached.metadata && cached.metadata.request_body_info, 
                'Metadata should include request body info');
        } finally {
            await backend.shutdown();
        }
    });
});
