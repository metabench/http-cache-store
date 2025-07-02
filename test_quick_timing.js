const BackEnd = require('./BackEnd');

async function quickTest() {
    console.log('=== Quick Download Timing Test ===\n');
    
    const backend = new BackEnd({
        dbPath: ':memory:', // Use in-memory database for quick test
        verbose: false
    });
    
    try {
        await backend.start();
        console.log('✅ Backend started\n');
        
        // Test with a simple, fast URL
        const testUrl = 'https://httpbin.org/uuid';
        
        console.log(`📥 Testing download timing for: ${testUrl}\n`);
        
        const result = await backend.get(testUrl);
        
        console.log(`📄 Downloaded content length: ${result ? result.length : 'undefined'} characters\n`);
        
        // Check the stored metadata
        const cached = await backend.get_cached_response({
            method: 'GET',
            url: testUrl
        });
        
        if (cached && cached.metadata) {
            let metadata;
            try {
                metadata = typeof cached.metadata === 'string' ? JSON.parse(cached.metadata) : cached.metadata;
                console.log('📊 Timing Summary:');
                console.log(`   Response Latency: ${metadata.response_latency_ms}ms`);
                console.log(`   Total Download Time: ${metadata.total_download_time_ms}ms`);
                console.log(`   Data Transfer Time: ${metadata.data_transfer_time_ms}ms`);
                console.log(`   Overall Duration: ${metadata.overall_duration_ms}ms\n`);
            } catch (parseError) {
                console.log('❌ Error parsing metadata:', parseError);
                console.log('📋 Raw metadata:', cached.metadata);
            }
        } else {
            console.log('❌ No cached response or metadata found');
        }
        
        console.log('✅ Test completed successfully');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

quickTest();
