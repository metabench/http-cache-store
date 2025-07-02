const BackEnd = require('./BackEnd');
const path = require('path');

async function clearOneGuardianURL() {
    console.log('=== Clearing one Guardian URL to demonstrate timing ===\n');
    
    // Use the Guardian cache database
    const guardianDbPath = path.join(__dirname, 'tests', 'integration', 'guardian-cache-persistent.sqlite');
    const backend = new BackEnd({
        dbPath: guardianDbPath,
        verbose: false
    });
    
    try {
        await backend.start();
        
        // Clear the UK Guardian URL cache
        const ukUrl = 'https://www.theguardian.com/uk';
        console.log(`🗑️ Clearing cache for: ${ukUrl}`);
        
        await backend.delete_cached_response({
            method: 'GET',
            url: ukUrl
        });
        
        console.log('✅ Cache cleared successfully');
        console.log('🔄 Next test run will download UK page fresh and show timing metadata\n');
        
    } catch (error) {
        console.error('❌ Failed to clear cache:', error);
    } finally {
        await backend.shutdown();
    }
}

// Run the cache clearing
clearOneGuardianURL().catch(console.error);
