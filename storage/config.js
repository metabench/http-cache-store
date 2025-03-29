module.exports = {
    dbPath: 'http-cache.db',
    electron: {
        window: {
            width: 800,
            height: 600,
        }
    },
    compression: {
        defaultAlgorithm: 'brotli',
        brotliOptions: {}
    }
};
