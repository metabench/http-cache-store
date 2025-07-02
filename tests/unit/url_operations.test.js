const test = require('node:test');
const assert = require('node:assert');
const HTTP_Cache_Store_DB_Adapter_SQLite = require('../../storage/db/adapter/HTTP_Cache_Store_DB_Adapter_SQLite');

test('SQLite URL-based cache operations', async (t) => {
    // Create a clean adapter for testing
    const adapter = new HTTP_Cache_Store_DB_Adapter_SQLite({
        db_path: ':memory:',
        verbose: false
    });
    
    // Connect and setup
    await adapter.connect();
    await adapter.init_schema();
    
    await t.test('Counts cache entries by URL', async () => {
        // Prepare test data with multiple entries for the same URL
        const testUrl = 'https://example.com/test-url-count';
        const hash1 = Buffer.from([1, 2, 3, 4]);
        const hash2 = Buffer.from([5, 6, 7, 8]);
        const hash3 = Buffer.from([9, 10, 11, 12]);
        
        // Store three entries with the same URL but different timestamps
        await adapter.store_cache_entry({
            request_method: 'GET',
            request_url: testUrl,
            request_hash: hash1,
            response_hash: hash1,
            response_status: 200,
            stored_at: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
        });
        
        await adapter.store_cache_entry({
            request_method: 'GET',
            request_url: testUrl,
            request_hash: hash2,
            response_hash: hash2,
            response_status: 200,
            stored_at: Math.floor(Date.now() / 1000) - 1800 // 30 minutes ago
        });
        
        await adapter.store_cache_entry({
            request_method: 'GET',
            request_url: testUrl,
            request_hash: hash3,
            response_hash: hash3,
            response_status: 200,
            stored_at: Math.floor(Date.now() / 1000) // now
        });
        
        // Store a different URL as control
        await adapter.store_cache_entry({
            request_method: 'GET',
            request_url: 'https://example.com/different-url',
            request_hash: Buffer.from([20, 21, 22]),
            response_hash: Buffer.from([20, 21, 22]),
            response_status: 200,
            stored_at: Math.floor(Date.now() / 1000)
        });
        
        // Test count_cache_entries_by_url
        const count = await adapter.count_cache_entries_by_url(testUrl);
        assert.strictEqual(count, 3, 'Should find 3 entries for the test URL');
        
        const controlCount = await adapter.count_cache_entries_by_url('https://example.com/different-url');
        assert.strictEqual(controlCount, 1, 'Should find 1 entry for the control URL');
        
        const nonexistentCount = await adapter.count_cache_entries_by_url('https://example.com/nonexistent');
        assert.strictEqual(nonexistentCount, 0, 'Should find 0 entries for a nonexistent URL');
    });
    
    await t.test('Gets timestamps for cache entries by URL', async () => {
        // URL used in previous test
        const testUrl = 'https://example.com/test-url-count';
        
        // Get timestamps for the test URL
        const timestamps = await adapter.get_cache_entry_stored_at_timestamps_by_url(testUrl);
        
        // Verify we got 3 timestamps
        assert.strictEqual(timestamps.length, 3, 'Should return 3 timestamps');
        
        // Verify timestamps are sorted in descending order (newest first)
        assert(timestamps[0] >= timestamps[1], 'Timestamps should be in descending order');
        assert(timestamps[1] >= timestamps[2], 'Timestamps should be in descending order');
        
        // Test with URL that has no entries
        const emptyTimestamps = await adapter.get_cache_entry_stored_at_timestamps_by_url('https://example.com/nonexistent');
        assert.strictEqual(emptyTimestamps.length, 0, 'Should return empty array for URL with no entries');
    });
    
    // Clean up
    await adapter.disconnect();
});