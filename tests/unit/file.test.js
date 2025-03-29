const test = require('node:test');
const assert = require('node:assert');
const File_Base = require('../../storage/file/File_Base');
const Platform_Compressed_File = require('../../storage/file/Platform_Compressed_File');
const Not_Platform_Compressed_File = require('../../storage/file/Not_Platform_Compressed_File');

test('File classes', async (t) => {
    await t.test('File_Base', async (t) => {
        await t.test('initializes with correct defaults', () => {
            const file = new File_Base({
                hash: 'test-hash',
                mime_type: 'text/plain'
            });
            
            assert.strictEqual(file.hash, 'test-hash');
            assert.strictEqual(file.mime_type, 'text/plain');
            assert.deepStrictEqual(file.metadata, {});
            assert(file.stored_at > 0, 'stored_at should be a timestamp');
            // Use _content instead of content as this is the actual property name
            assert.strictEqual(file._content, null);
        });
        
        await t.test('correctly sets and gets content', () => {
            const file = new File_Base();
            const content = 'Test content';
            
            file.set_content(content);
            const retrieved = file.get_content();
            
            assert(Buffer.isBuffer(retrieved), 'Retrieved content should be a Buffer');
            assert.strictEqual(retrieved.toString(), content);
        });
        
        await t.test('handles binary content correctly', () => {
            const file = new File_Base();
            const content = Buffer.from([0x01, 0x02, 0x03]);
            
            file.set_content(content);
            const retrieved = file.get_content();
            
            assert(Buffer.isBuffer(retrieved), 'Retrieved content should be a Buffer');
            assert.deepStrictEqual(retrieved, content);
        });
        
        await t.test('serializes to JSON correctly', () => {
            const now = Date.now();
            const file = new File_Base({
                hash: 'test-hash',
                mime_type: 'text/plain',
                stored_at: now,
                metadata: { key: 'value' }
            });
            
            file.set_content('Test content');
            const json = file.toJSON();
            
            assert.strictEqual(json.hash, 'test-hash');
            assert.strictEqual(json.mime_type, 'text/plain');
            assert.strictEqual(json.stored_at, now);
            assert.deepStrictEqual(json.metadata, { key: 'value' });
            assert.strictEqual(json.content_size, 12);
        });
    });
    
    await t.test('Platform_Compressed_File', async (t) => {
        await t.test('initializes with compression properties', () => {
            const file = new Platform_Compressed_File({
                hash: 'test-hash',
                mime_type: 'text/plain',
                compression_algorithm: 'brotli',
                original_size: 100
            });
            
            assert.strictEqual(file.hash, 'test-hash');
            assert.strictEqual(file.compression_algorithm, 'brotli');
            assert.strictEqual(file.original_size, 100);
            assert.strictEqual(file.compressed_size, 0);
            assert.strictEqual(file.is_platform_compressed, true, 'Compressed file should report is_platform_compressed as true');
        });
        
        await t.test('updates compressed_size when setting content', () => {
            const file = new Platform_Compressed_File({
                original_size: 100
            });
            
            file.set_content('Test content');
            
            assert.strictEqual(file.compressed_size, 12);
        });
        
        await t.test('calculates compression ratio correctly', () => {
            const file = new Platform_Compressed_File({
                original_size: 100
            });
            
            file.set_content('Test content'); // 12 bytes
            
            assert.strictEqual(file.compressed_size, 12);
            assert.strictEqual(file.compression_ratio > 1, true, 'Compression ratio should be > 1');
        });
        
        await t.test('serializes to JSON with compression details', () => {
            const file = new Platform_Compressed_File({
                hash: 'test-hash',
                mime_type: 'text/plain',
                compression_algorithm: 'brotli',
                original_size: 100
            });
            
            file.set_content('Test content');
            const json = file.toJSON();
            
            assert.strictEqual(json.hash, 'test-hash');
            assert.strictEqual(json.compression_algorithm, 'brotli');
            assert.strictEqual(json.original_size, 100);
            assert.strictEqual(json.compressed_size, 12);
            assert.strictEqual(json.is_platform_compressed, true);
            assert(json.compression_ratio > 0);
        });
    });
    
    await t.test('Not_Platform_Compressed_File', async (t) => {
        await t.test('initializes correctly with is_platform_compressed=false', () => {
            const file = new Not_Platform_Compressed_File({
                hash: 'test-hash',
                mime_type: 'text/plain'
            });
            
            assert.strictEqual(file.hash, 'test-hash');
            assert.strictEqual(file.is_platform_compressed, false, 'Not compressed file should report is_platform_compressed as false');
        });
        
        await t.test('updates original_size when setting content', () => {
            const file = new Not_Platform_Compressed_File();
            
            file.set_content('Test content');
            
            assert.strictEqual(file.original_size, 12);
        });
        
        await t.test('serializes to JSON correctly', () => {
            const file = new Not_Platform_Compressed_File({
                hash: 'test-hash',
                mime_type: 'text/plain'
            });
            
            file.set_content('Test content');
            const json = file.toJSON();
            
            assert.strictEqual(json.hash, 'test-hash');
            assert.strictEqual(json.original_size, 12);
            assert.strictEqual(json.is_platform_compressed, false);
        });
    });
});
