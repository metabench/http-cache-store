const test = require('node:test');
const assert = require('assert');
const Compression_Adapter_Brotli = require('../../storage/db/compression/Compression_Adapter_Brotli');
const Compression_Adapter_No_Compression = require('../../storage/db/compression/Compression_Adapter_No_Compression');
const Compression_Manager = require('../../storage/db/compression/Compression_Manager');

test('Compression systems', async (t) => {
    await t.test('No Compression adapter', async (t) => {
        await t.test('preserves data exactly', async () => {
            const adapter = new Compression_Adapter_No_Compression();
            const testData = 'Hello, World!';
            
            const compressed = await adapter.compress(testData);
            const decompressed = await adapter.decompress(compressed);
            
            assert(Buffer.isBuffer(decompressed), 'Decompressed result should be a Buffer');
            assert.strictEqual(decompressed.toString(), testData, 'Original and decompressed data should match');
        });

        await t.test('handles binary data correctly', async () => {
            const adapter = new Compression_Adapter_No_Compression();
            const binaryData = Buffer.from([0xFF, 0x00, 0xFF]);
            
            const compressed = await adapter.compress(binaryData);
            assert(Buffer.isBuffer(compressed), 'Compressed data should be a Buffer');
            
            const decompressed = await adapter.decompress(compressed);
            assert(Buffer.isBuffer(decompressed), 'Decompressed result should be a Buffer');
            assert.deepStrictEqual(decompressed, binaryData, 'Binary data should be preserved exactly');
        });
    });

    await t.test('Brotli adapter', async (t) => {
        await t.test('compresses and decompresses text correctly', async () => {
            const adapter = new Compression_Adapter_Brotli();
            // Use repeated data to ensure compression is effective
            const testData = 'Hello, World! '.repeat(100);
            
            const compressed = await adapter.compress(testData);
            const decompressed = await adapter.decompress(compressed);
            
            assert(Buffer.isBuffer(decompressed), 'Decompressed result should be a Buffer');
            assert.strictEqual(decompressed.toString(), testData, 'Original and decompressed data should match');
            assert(compressed.length < Buffer.from(testData).length, 'Compressed data should be smaller');
        });

        await t.test('handles empty data correctly', async () => {
            const adapter = new Compression_Adapter_Brotli();
            const empty = '';
            
            const compressed = await adapter.compress(empty);
            const decompressed = await adapter.decompress(compressed);
            
            assert(Buffer.isBuffer(decompressed), 'Decompressed result should be a Buffer');
            assert.strictEqual(decompressed.length, 0, 'Buffer should be empty');
            assert.strictEqual(decompressed.toString(), empty, 'Buffer should convert to empty string');
        });

        await t.test('handles binary data correctly', async () => {
            const adapter = new Compression_Adapter_Brotli();
            // Create a repeating pattern for better compression
            const binaryData = Buffer.from(Array(1000).fill(0x42));
            
            const compressed = await adapter.compress(binaryData);
            assert(Buffer.isBuffer(compressed), 'Compressed data should be a Buffer');
            
            const decompressed = await adapter.decompress(compressed);
            assert(Buffer.isBuffer(decompressed), 'Decompressed result should be a Buffer');
            assert.deepStrictEqual(decompressed, binaryData, 'Decompressed data should match original binary data');
            assert(compressed.length < binaryData.length, 'Compressed data should be smaller');
        });
    });

    await t.test('Compression Manager', async (t) => {
        await t.test('selects appropriate compression algorithm based on content type', async () => {
            const manager = new Compression_Manager();
            
            assert.strictEqual(manager.shouldCompress('small', 'text/html'), false, 'Small content should not be compressed');
            assert.strictEqual(manager.shouldCompress('A'.repeat(500), 'text/html'), true, 'HTML should be compressed');
            assert.strictEqual(manager.shouldCompress('A'.repeat(500), 'image/jpeg'), false, 'JPEGs should not be compressed');
            assert.strictEqual(manager.shouldCompress('A'.repeat(500), 'application/json'), true, 'JSON should be compressed');
            assert.strictEqual(manager.shouldCompress('A'.repeat(500), 'image/svg+xml'), true, 'SVG should be compressed');
            assert.strictEqual(manager.shouldCompress('A'.repeat(500), 'application/zip'), false, 'ZIP files should not be compressed');
        });

        await t.test('compresses and decompresses data with default algorithm', async () => {
            const manager = new Compression_Manager();
            const testData = 'Hello, World! '.repeat(100);
            const testBuffer = Buffer.from(testData);
            
            const result = await manager.compress_data(testData);
            assert(result.data instanceof Buffer, 'Result should contain buffer data');
            
            // Check compression flag
            if (result.compressed) {
                assert(result.data.length < testBuffer.length, 'Compressed data should be smaller');
            }
            
            const decompressed = await manager.decompress_data(result);
            assert(Buffer.isBuffer(decompressed), 'Decompressed result should be a Buffer');
            // Compare the string representation of the buffers
            assert.strictEqual(decompressed.toString(), testData, 'Original and decompressed data should match');
        });

        await t.test('emits events during compression', async () => {
            const manager = new Compression_Manager();
            const testData = 'Hello, World! '.repeat(100);
            
            let compressionEvent = null;
            manager.on('compression_complete', (event) => {
                compressionEvent = event;
            });
            
            await manager.compress('brotli', testData);
            
            assert(compressionEvent, 'Compression event should be emitted');
            assert(compressionEvent.algorithm === 'brotli', 'Event should contain algorithm');
            assert(compressionEvent.input_size > 0, 'Event should contain input size');
            assert(compressionEvent.output_size > 0, 'Event should contain output size');
            assert(compressionEvent.duration_ms >= 0, 'Event should contain duration');
        });
    });
});
