const BackEnd = require('./BackEnd');
const path = require('path');
const fs = require('fs');

async function testGetAllCachedUrlsWithTiming() {
    console.log('=== Testing Get All Cached URLs with Timing ===\n');
    
    // Use a temporary database for this test
    const tempDbPath = path.join(__dirname, 'test-cached-urls-timing.sqlite');
    
    // Clean up any existing test database
    if (fs.existsSync(tempDbPath)) {
        fs.unlinkSync(tempDbPath);
        console.log('🗑️ Cleaned up existing test database\n');
    }
    
    const backend = new BackEnd({
        dbPath: tempDbPath,
        verbose: false,
        requestTimeout: 5000
    });
    
    try {
        await backend.start();
        console.log('✅ Backend started successfully\n');
        
        // Test with multiple URLs to create a list
        const testUrls = [
            'https://httpbin.org/uuid',
            'https://httpbin.org/json',
            'https://jsonplaceholder.typicode.com/posts/1'
        ];
        
        console.log(`📥 Downloading ${testUrls.length} test URLs to populate cache...\n`);
        
        // Download each URL to populate the cache with timing data
        for (let i = 0; i < testUrls.length; i++) {
            const url = testUrls[i];
            console.log(`${i + 1}. Downloading: ${url}`);
            
            try {
                const result = await backend.get(url);
                console.log(`   ✅ Downloaded successfully (${result ? 'got result' : 'no result'})\n`);
                
                // Add a small delay between downloads
                if (i < testUrls.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            } catch (error) {
                console.log(`   ❌ Download failed: ${error.message}\n`);
            }
        }
        
        console.log('🔍 Retrieving all cached URLs with timing information...\n');
        
        // Test the new method
        const cachedUrls = await backend.get_all_cached_urls_with_timing();
        
        console.log(`📊 Found ${cachedUrls.length} cached URLs\n`);
        
        if (cachedUrls.length > 0) {
            console.log('📋 Cached URLs with Timing Information:');
            console.log('=' .repeat(80));
            
            cachedUrls.forEach((entry, index) => {
                console.log(`${index + 1}. ${entry.method} ${entry.url}`);
                console.log(`   Status: ${entry.status}`);
                console.log(`   Stored at: ${entry.stored_at_iso}`);
                
                if (entry.timing.response_latency_ms) {
                    console.log(`   Response Latency: ${entry.timing.response_latency_ms}ms`);
                }
                if (entry.timing.total_download_time_ms) {
                    console.log(`   Total Download Time: ${entry.timing.total_download_time_ms}ms`);
                }
                if (entry.timing.data_transfer_time_ms) {
                    console.log(`   Data Transfer Time: ${entry.timing.data_transfer_time_ms}ms`);
                }
                if (entry.timing.overall_duration_ms) {
                    console.log(`   Overall Duration: ${entry.timing.overall_duration_ms}ms`);
                }
                console.log('   ' + '-'.repeat(50));
            });
            
            console.log(`\n✅ Successfully retrieved timing data for all ${cachedUrls.length} cached URLs`);
            
            // Verify that timing data is present
            const urlsWithTiming = cachedUrls.filter(entry => 
                entry.timing.response_latency_ms !== null || 
                entry.timing.total_download_time_ms !== null
            );
            
            console.log(`📈 ${urlsWithTiming.length} out of ${cachedUrls.length} URLs have timing data`);
            
            if (urlsWithTiming.length > 0) {
                console.log('✅ Timing data verification: PASSED');
            } else {
                console.log('⚠️ Timing data verification: No timing data found');
            }
        } else {
            console.log('⚠️ No cached URLs found - test may have failed');
        }
        
        await backend.shutdown();
        console.log('\n✅ Backend shutdown complete');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        await backend.shutdown();
    } finally {
        // Clean up test database
        if (fs.existsSync(tempDbPath)) {
            fs.unlinkSync(tempDbPath);
            console.log('🗑️ Test database cleaned up');
        }
    }
}

// Add a simple API endpoint test
async function testAsListingAPI() {
    console.log('\n=== Testing as API Endpoint ===\n');
    
    const backend = new BackEnd({
        dbPath: ':memory:', // Use in-memory for this test
        verbose: false
    });
    
    try {
        await backend.start();
        
        // Add a few test entries
        await backend.store_response({
            method: 'GET',
            url: 'https://example.com/test1',
            headers: { 'content-type': 'text/html' },
            response_body: '<html>Test 1</html>',
            status_code: 200,
            metadata: {
                response_latency_ms: 150,
                total_download_time_ms: 250,
                data_transfer_time_ms: 100,
                overall_duration_ms: 300,
                download_timestamp: new Date().toISOString()
            }
        });
        
        await backend.store_response({
            method: 'GET',
            url: 'https://example.com/test2',
            headers: { 'content-type': 'application/json' },
            response_body: '{"test": "data"}',
            status_code: 200,
            metadata: {
                response_latency_ms: 75,
                total_download_time_ms: 125,
                data_transfer_time_ms: 50,
                overall_duration_ms: 180,
                download_timestamp: new Date().toISOString()
            }
        });
        
        const results = await backend.get_all_cached_urls_with_timing();
        
        console.log('📋 API Response (JSON format):');
        console.log(JSON.stringify(results, null, 2));
        
        console.log(`\n✅ API test successful - returned ${results.length} entries`);
        
        await backend.shutdown();
        
    } catch (error) {
        console.error('❌ API test failed:', error);
        await backend.shutdown();
    }
}

// Run both tests
(async () => {
    await testGetAllCachedUrlsWithTiming();
    await testAsListingAPI();
})();
