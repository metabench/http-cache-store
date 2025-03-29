const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert');
const HTTP_Cache_Store_Storage_Adapter = require('../../storage/HTTP_Cache_Store_Storage_Adapter');

describe('Hash computation module', () => {
    let adapter;
    
    beforeEach(() => {
        adapter = new HTTP_Cache_Store_Storage_Adapter({
            verbose: process.env.VERBOSE_TESTS === 'true' // Enable verbose mode through env variable
        });
    });
    
    it('generates consistent hashes for identical inputs', async () => {
        const hash1 = await adapter.computeHash('GET', 'http://example.com');
        const hash2 = await adapter.computeHash('GET', 'http://example.com');
        
        assert.deepStrictEqual(hash1, hash2, 'Same input should produce same hash');
    });
    
    it('generates different hashes for different methods', async () => {
        const hash1 = await adapter.computeHash('GET', 'http://example.com');
        const hash2 = await adapter.computeHash('POST', 'http://example.com');
        
        assert.notDeepStrictEqual(hash1, hash2, 'Different methods should produce different hashes');
    });
    
    it('generates different hashes for different URLs', async () => {
        const hash1 = await adapter.computeHash('GET', 'http://example.com');
        const hash2 = await adapter.computeHash('GET', 'http://example.org');
        
        assert.notDeepStrictEqual(hash1, hash2, 'Different URLs should produce different hashes');
    });
    
    it('handles headers consistently when explicitly provided', async () => {
        // For internal HTTP_Cache_Store operations, we ignore headers
        // But when testing hash generation directly, we respect all inputs
        
        // First test - same headers should produce same hash
        const hash1 = await adapter.computeHash('GET', 'http://example.com', JSON.stringify({ 'content-type': 'text/html' }));
        const hash2 = await adapter.computeHash('GET', 'http://example.com', JSON.stringify({ 'content-type': 'text/html' }));
        assert.deepStrictEqual(hash1, hash2, 'Same headers should produce same hash');
        
        // Second test - different headers produce different hashes when headers are explicitly included
        const hash3 = await adapter.computeHash('GET', 'http://example.com', JSON.stringify({ 'content-type': 'text/html' }));
        const hash4 = await adapter.computeHash('GET', 'http://example.com', JSON.stringify({ 'content-type': 'application/json' }));
        assert.notDeepStrictEqual(hash3, hash4, 'Different headers should produce different hashes when explicitly included');
    });
    
    it('handles binary input correctly', async () => {
        const buffer = Buffer.from([1, 2, 3, 4, 5]);
        const hash1 = await adapter.computeHash('GET', 'http://example.com', buffer);
        const hash2 = await adapter.computeHash('GET', 'http://example.com', Buffer.from([1, 2, 3, 4, 5]));
        const hash3 = await adapter.computeHash('GET', 'http://example.com', Buffer.from([6, 7, 8, 9, 10]));
        
        assert.deepStrictEqual(hash1, hash2, 'Same binary data should produce same hash');
        assert.notDeepStrictEqual(hash1, hash3, 'Different binary data should produce different hashes');
    });
});
