const test = require('node:test');
const assert = require('node:assert');
const HTTP_Cache_Store_DB_Adapter_SQLite = require('../../storage/db/adapter/HTTP_Cache_Store_DB_Adapter_SQLite');
const Not_Platform_Compressed_File = require('../../storage/file/Not_Platform_Compressed_File');
const Platform_Compressed_File = require('../../storage/file/Platform_Compressed_File');

test('Binary data handling', async (t) => {
    await t.test('SQLite adapter handles binary data correctly', async (t) => {
        // Create adapter with verbose mode for detailed logging
        const adapter = new HTTP_Cache_Store_DB_Adapter_SQLite({ 
            db_path: ':memory:',
            verbose: false // Set to true to enable detailed logs
        });
        await adapter.connect();
        await adapter.initSchema();

        await t.test('Stores binary data in the database', async () => {
            const hash = Buffer.from([1, 2, 3]);
            const binaryData = Buffer.from([0xFF, 0x00, 0xFF, 0x42, 0x13, 0x37]);
            
            // First, create a cache entry with the hash
            await adapter.store_cache_entry({
                request_method: 'GET',
                request_url: 'https://example.com/binary-test',
                request_hash: hash,
                response_hash: hash,
                response_status: 200,
                response_headers: JSON.stringify({"content-type": "application/octet-stream"}),
                stored_at: Math.floor(Date.now() / 1000)
            });
            
            // Then store the body content
            const bodyEntry = {
                hash: hash,
                content: binaryData,
                mime_type: 'application/octet-stream',
                is_platform_compressed: false,
                original_size: binaryData.length,
                stored_at: Math.floor(Date.now() / 1000)
            };
            
            await adapter.store_body(bodyEntry);
        });

        await t.test('Retrieves binary data from the database', async () => {
            const hash = Buffer.from([1, 2, 3]);
            const binaryData = Buffer.from([0xFF, 0x00, 0xFF, 0x42, 0x13, 0x37]);

            // Get the cache entry by method and URL
            const result = await adapter.get_cache_entry_by_request({
                method: 'GET',
                url: 'https://example.com/binary-test'
            });
            
            assert(result, 'Retrieved cache entry should not be null');
            
            // Get the body content using the response_hash
            const body = await adapter.get_body_by_hash(result.response_hash);
            
            assert(body, 'Retrieved body should not be null');
            assert(Buffer.isBuffer(body.content) || body.content instanceof Uint8Array, 
                'Body content should be binary');

            const content = Buffer.isBuffer(body.content) ? 
                          body.content : 
                          Buffer.from(body.content);

            assert.deepStrictEqual(
                content, 
                binaryData,
                'Binary data should be preserved exactly'
            );
        });

        await adapter.disconnect();
    });

    await t.test('File classes correctly handle binary data', async (t) => {
        await t.test('NotCompressed_File stores and retrieves binary data', async () => {
            const binaryData = Buffer.from([0xFF, 0x00, 0xFF, 0x42]);
            const hash = Buffer.from([1, 2, 3]);
            const file = new Not_Platform_Compressed_File({
                hash: hash,
                mime_type: 'application/octet-stream'
            });
            file.set_content(binaryData);
            const content = file.get_content();

            assert(Buffer.isBuffer(content), 'Content should be a Buffer');
            assert.deepStrictEqual(content, binaryData, 'Retrieved content should match original binary data');
            assert.strictEqual(content.length, binaryData.length, 'Size should match binary data length');
        });

        await t.test('Compressed_File handles binary data correctly', async () => {
            const binaryData = Buffer.from([0xFF, 0x00, 0xFF, 0x42]);
            const file = new Platform_Compressed_File({
                hash: new Uint8Array([1, 2, 3]),
                mime_type: 'application/octet-stream',
                compression_algorithm: 'brotli',
                original_size: 100
            });

            file.set_content(binaryData);
            const content = file.get_content();

            assert(Buffer.isBuffer(content), 'Content should be a Buffer');
            assert.deepStrictEqual(content, binaryData, 'Retrieved content should match original binary data');
            assert.strictEqual(file.compressed_size, binaryData.length, 'Compressed size should be updated');
        });
    });
});