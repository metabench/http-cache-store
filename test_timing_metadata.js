const BackEnd = require('./BackEnd');
const path = require('path');

async function testTimingMetadata() {
    console.log('=== Testing Download Timing Metadata Storage ===\n');
    
    // Use a temporary database for this test
    const tempDbPath = path.join(__dirname, 'timing-test.sqlite');
    const backend = new BackEnd({
        dbPath: tempDbPath,
        verbose: false
    });
    
    try {
        await backend.start();
        console.log('✅ Backend started successfully\n');
        
        // Test URL that should be quick to download
        const testUrl = 'https://httpbin.org/json';
        
        console.log(`📥 Testing download timing for: ${testUrl}`);
        console.log('Starting fresh download...\n');
        
        // First, clear any existing cache for this URL
        try {
            await backend.delete_cached_response({
                method: 'GET',
                url: testUrl
            });
            console.log('🗑️ Cleared any existing cache for test URL\n');
        } catch (err) {
            // Ignore errors if entry doesn't exist
        }
        
        // Time the download
        const downloadStartTime = Date.now();
        const result = await backend.get(testUrl);
        const totalTime = Date.now() - downloadStartTime;
        
        console.log(`⏱️ Total download completed in: ${totalTime}ms\n`);
        
        // Now check if the timing metadata was stored
        console.log('🔍 Checking stored metadata...\n');
        
        const cached = await backend.get_cached_response({
            method: 'GET',
            url: testUrl
        });
        
        if (cached && cached.metadata) {
            console.log('✅ Cached response found with metadata:');
            console.log('📊 Download Timing Information:');
            
            if (cached.metadata.download_duration_ms) {
                console.log(`   - Download Duration: ${cached.metadata.download_duration_ms}ms`);
            }
            
            if (cached.metadata.download_start_time) {
                console.log(`   - Download Start Time: ${cached.metadata.download_start_time} (${new Date(cached.metadata.download_start_time).toISOString()})`);
            }
            
            if (cached.metadata.download_end_time) {
                console.log(`   - Download End Time: ${cached.metadata.download_end_time} (${new Date(cached.metadata.download_end_time).toISOString()})`);
            }
            
            if (cached.metadata.download_timestamp) {
                console.log(`   - Download Timestamp: ${cached.metadata.download_timestamp}`);
            }
            
            console.log('\n📋 Full metadata object:');
            console.log(JSON.stringify(cached.metadata, null, 2));
            
        } else {
            console.log('❌ No cached response found or no metadata available');
        }
        
        // Test that subsequent calls use cache (should not have new timing data)
        console.log('\n🔄 Testing cache retrieval (should be much faster)...');
        const cacheStartTime = Date.now();
        const cachedResult = await backend.get(testUrl);
        const cacheTime = Date.now() - cacheStartTime;
        
        console.log(`⚡ Cache retrieval completed in: ${cacheTime}ms`);
        console.log(`🆚 Speed improvement: ${Math.round((totalTime / cacheTime) * 100) / 100}x faster\n`);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await backend.shutdown();
        console.log('✅ Backend shutdown complete');
        
        // Clean up test database
        const fs = require('fs');
        try {
            if (fs.existsSync(tempDbPath)) {
                fs.unlinkSync(tempDbPath);
                console.log('🗑️ Test database cleaned up');
            }
        } catch (err) {
            console.warn('⚠️ Warning: Could not clean up test database:', err.message);
        }
    }
}

// Run the test
testTimingMetadata().catch(console.error);
