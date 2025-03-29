const test = require('node:test');
const assert = require('assert');
const ErrorHandler = require('../../utils/ErrorHandler');
const HTTP_Cache_Store_Storage_Adapter = require('../../storage/HTTP_Cache_Store_Storage_Adapter');

test('Error handling', async (t) => {
    await t.test('ErrorHandler', async (t) => {
        await t.test('creates standardized error objects', () => {
            const error = ErrorHandler.createError('Test error', 'TEST_ERR', { foo: 'bar' });
            
            assert(error instanceof Error);
            assert.strictEqual(error.message, 'Test error');
            assert.strictEqual(error.code, 'TEST_ERR');
            assert.deepStrictEqual(error.context, { foo: 'bar' });
            assert(error.timestamp > 0);
        });
    });
    
    await t.test('Storage Adapter error handling', async (t) => {
        // Create a failing mock DB adapter with all required methods
        const failingDbAdapter = {
            is_connected: true,
            async connect() { this.is_connected = true; },
            async disconnect() { this.is_connected = false; },
            async store_request_response() { 
                throw new Error('Storage failure');
            },
            async get_cached_response() { 
                throw new Error('Retrieval failure');
            },
            async store_body() {
                throw new Error('Storage failure');
            },
            async get_cache_entry_by_request() {
                throw new Error('Retrieval failure');
            },
            async delete_cache_entry() {
                throw new Error('Deletion failure');
            },
            async clear_cache() {
                throw new Error('Clear failure');
            }
        };
        
        await t.test('properly handles and propagates storage errors', async () => {
            const adapter = new HTTP_Cache_Store_Storage_Adapter({
                db_adapter: failingDbAdapter
            });
            
            let errorEmitted = false;
            adapter.on('store_error', () => {
                errorEmitted = true;
            });
            
            try {
                await adapter.store_request_response({
                    method: 'GET',
                    url: 'https://example.com',
                    response_body: 'test'
                });
                assert.fail('Should have thrown an error');
            } catch (err) {
                assert.strictEqual(err.message, 'Storage failure');
                assert(errorEmitted, 'Error event should be emitted');
            }
        });
        
        await t.test('properly handles and propagates retrieval errors', async () => {
            const adapter = new HTTP_Cache_Store_Storage_Adapter({
                db_adapter: failingDbAdapter
            });
            
            let errorEmitted = false;
            adapter.on('get_error', () => {
                errorEmitted = true;
            });
            
            try {
                await adapter.get_cached_response({
                    method: 'GET',
                    url: 'https://example.com'
                });
                assert.fail('Should have thrown an error');
            } catch (err) {
                assert.strictEqual(err.message, 'Retrieval failure');
                assert(errorEmitted, 'Error event should be emitted');
            }
        });
        
        await t.test('validates required input parameters', async () => {
            const adapter = new HTTP_Cache_Store_Storage_Adapter({
                db_adapter: failingDbAdapter
            });
            
            // Missing method
            try {
                await adapter.store_request_response({
                    url: 'https://example.com',
                    response_body: 'test'
                });
                assert.fail('Should have thrown an error');
            } catch (err) {
                assert(err.message.includes('Required fields missing'));
            }
            
            // Missing URL
            try {
                await adapter.store_request_response({
                    method: 'GET',
                    response_body: 'test'
                });
                assert.fail('Should have thrown an error');
            } catch (err) {
                assert(err.message.includes('Required fields missing'));
            }
            
            // Missing response body
            try {
                await adapter.store_request_response({
                    method: 'GET',
                    url: 'https://example.com'
                });
                assert.fail('Should have thrown an error');
            } catch (err) {
                assert(err.message.includes('Required fields missing'));
            }
        });
    });
});
