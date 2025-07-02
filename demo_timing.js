const BackEnd = require('./BackEnd');
const path = require('path');

async function demonstrateTimingFeature() {
    console.log('=== Demonstrating Download Timing Feature ===\n');
    
    // Use the Guardian cache database
    const guardianDbPath = path.join(__dirname, 'tests', 'integration', 'guardian-cache-persistent.sqlite');
    const backend = new BackEnd({
        dbPath: guardianDbPath,
        verbose: false
    });
    
    try {
        await backend.start();
        console.log('✅ Backend started successfully\n');
        
        // Check current metadata for Guardian URLs
        const urls = [
            'https://www.theguardian.com/uk',
            'https://www.theguardian.com/world'
        ];
        
        for (const url of urls) {
            console.log(`🔍 Checking metadata for: ${new URL(url).pathname}`);
            
            const cached = await backend.get_cached_response({
                method: 'GET',
                url: url
            });
            
            if (cached && cached.metadata) {
                if (cached.metadata.download_duration_ms) {
                    console.log(`   ⏱️ Originally downloaded in: ${cached.metadata.download_duration_ms}ms`);
                    console.log(`   📅 Downloaded at: ${cached.metadata.download_timestamp || 'No timestamp available'}`);
                } else {
                    console.log(`   ❓ No timing metadata available (cached before timing feature was added)`);
                }
                
                console.log(`   📊 Content size: ${cached.get_content().length} characters`);
            } else {
                console.log(`   ❌ No cached entry found`);
            }
            console.log('');
        }
        
        // Demonstrate with a fresh URL that will have timing metadata
        const testUrl = 'https://httpbin.org/user-agent';
        console.log(`🆕 Testing fresh download with timing metadata: ${testUrl}\n`);
        
        // Clear any existing cache for this URL
        try {
            await backend.delete_cached_response({
                method: 'GET',
                url: testUrl
            });
        } catch (err) {
            // Ignore if not cached
        }
        
        const startTime = Date.now();
        const result = await backend.get(testUrl);
        const totalTime = Date.now() - startTime;
        
        console.log(`✅ Fresh download completed in: ${totalTime}ms\n`);
        
        // Check the stored metadata
        const freshCached = await backend.get_cached_response({
            method: 'GET',
            url: testUrl
        });
        
        if (freshCached && freshCached.metadata) {
            console.log('📊 Stored metadata includes:');
            if (freshCached.metadata.download_duration_ms) {
                console.log(`   ⏱️ Download Duration: ${freshCached.metadata.download_duration_ms}ms`);
            }
            if (freshCached.metadata.download_timestamp) {
                console.log(`   📅 Download Timestamp: ${freshCached.metadata.download_timestamp}`);
            }
            console.log(`   📏 Content Size: ${freshCached.get_content().length} characters`);
        }
        
        console.log('\n🔄 Now testing cache retrieval (should be instant)...');
        const cacheStartTime = Date.now();
        await backend.get(testUrl);
        const cacheTime = Date.now() - cacheStartTime;
        console.log(`⚡ Cache retrieval: ${cacheTime}ms (${Math.round(totalTime / Math.max(cacheTime, 1))}x faster)\n`);
        
    } catch (error) {
        console.error('❌ Demo failed:', error);
    } finally {
        await backend.shutdown();
        console.log('✅ Backend shutdown complete');
    }
}

// Run the demonstration
demonstrateTimingFeature().catch(console.error);
