const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const BackEnd = require('../../BackEnd');

// Use a more test-friendly URL that's less likely to rate limit
const TEST_URL = 'http://httpbin.org/html';
const BACKUP_URL = 'https://jsonplaceholder.typicode.com/posts/1';

test('Cache verification test', { timeout: 60000 }, async (t) => {
    let backend = null;
    const testDbPath = path.join(__dirname, 'cache-verification.sqlite');
    
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
        fs.unlinkSync(testDbPath);
        console.log('[TEST DEBUG] Cleaned up existing test database');
    }
    
    t.beforeEach(async () => {
        if (backend) {
            await backend.shutdown();
            backend = null;
        }
        
        backend = new BackEnd({
            dbPath: testDbPath,
            verbose: process.env.VERBOSE_TESTS === 'true'
        });
        
        await backend.start();
    });
    
    t.afterEach(async () => {
        if (backend) {
            await backend.shutdown();
            backend = null;
        }
    });
    
    await t.test('first request should download and cache', async () => {
        console.log('[TEST DEBUG] Testing first download and cache...');
        
        let result;
        try {
            result = await backend.get(TEST_URL);
        } catch (error) {
            console.log(`[TEST DEBUG] Primary URL failed, trying backup: ${error.message}`);
            result = await backend.get(BACKUP_URL);
        }
        
        console.log('[TEST DEBUG] First request completed successfully');
        assert(result, 'Should receive content from first request');
        
        // Handle both string and object responses
        const content = typeof result === 'string' ? result : result.get_content();
        console.log(`[TEST DEBUG] First request content type: ${typeof result}, length: ${content.length}`);
        assert(content.length > 0, 'Content should not be empty');
    });
    
    await t.test('second request should use cache', async () => {
        console.log('[TEST DEBUG] Testing cache hit...');
        
        // First, ensure we have something cached
        let testUrl = TEST_URL;
        try {
            let firstResult = await backend.get(TEST_URL);
            console.log('[TEST DEBUG] Using primary URL for cache test');
        } catch (error) {
            console.log('[TEST DEBUG] Primary URL failed, using backup for cache test');
            testUrl = BACKUP_URL;
            await backend.get(BACKUP_URL);
        }
        
        // Now test cache hit
        const startTime = Date.now();
        const result = await backend.get(testUrl);
        const duration = Date.now() - startTime;
        
        console.log(`[TEST DEBUG] Cache lookup took ${duration}ms`);
        assert(result, 'Should receive content from cache');
        
        // Handle both string and object responses  
        const content = typeof result === 'string' ? result : result.get_content();
        console.log(`[TEST DEBUG] Cache result content type: ${typeof result}, length: ${content.length}`);
        assert(content.length > 0, 'Cached content should not be empty');
        
        // Cache hits should be very fast (under 100ms)
        assert(duration < 100, `Cache hit should be fast, but took ${duration}ms`);
    });
    
    await t.test('verify database contains cached entry', async () => {
        console.log('[TEST DEBUG] Verifying database state...');
        
        // Check that the database file exists and has content
        assert(fs.existsSync(testDbPath), 'Test database should exist');
        
        const stats = fs.statSync(testDbPath);
        console.log(`[TEST DEBUG] Database size: ${stats.size} bytes`);
        assert(stats.size > 0, 'Database should not be empty');
    });
});
