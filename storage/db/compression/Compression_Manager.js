const { Evented_Class } = require('lang-mini');
const Compression_Adapter_Brotli = require('./Compression_Adapter_Brotli');
const Compression_Adapter_No_Compression = require('./Compression_Adapter_No_Compression');

/**
 * Manages multiple compression systems, allowing dynamic selection of compression methods.
 */
class Compression_Manager extends Evented_Class {
    constructor(options = {}) {
        super();
        
        this.adapters = {
            none: new Compression_Adapter_No_Compression(options.no_compression_options || {}),
            brotli: new Compression_Adapter_Brotli(options.brotli_options || {})
        };

        this.default_algorithm = options.default_algorithm || 'brotli';
    }

    /**
     * Compress data using the specified algorithm.
     * @param {string} algorithm - The compression algorithm to use ('none', 'brotli').
     * @param {string|Buffer} data - The data to be compressed.
     * @returns {Promise<Buffer>} - Compressed data as a Buffer.
     */
    async compress(algorithm, data) {
        if (!this.adapters[algorithm]) {
            throw new Error(`Unsupported compression algorithm: ${algorithm}`);
        }
        const start = Date.now();
        try {
            const result = await this.adapters[algorithm].compress(data);
            const duration = Date.now() - start;
            this.raise_event('compression_complete', {
                algorithm,
                input_size: data.length,
                output_size: result.length,
                duration_ms: duration
            });
            return result;
        } catch (error) {
            this.raise_event('compression_error', { algorithm, error });
            throw error;
        }
    }

    /**
     * Decompress data using the specified algorithm.
     * @param {string} algorithm - The compression algorithm used ('none', 'brotli').
     * @param {Buffer} data - The data to be decompressed.
     * @returns {Promise<string|Buffer>} - Decompressed data.
     */
    async decompress(algorithm, data) {
        if (!this.adapters[algorithm]) {
            throw new Error(`Unsupported decompression algorithm: ${algorithm}`);
        }
        const start = Date.now();
        try {
            const result = await this.adapters[algorithm].decompress(data);
            const duration = Date.now() - start;
            this.raise_event('decompression_complete', {
                algorithm,
                input_size: data.length,
                output_size: result.length,
                duration_ms: duration
            });
            return result;
        } catch (error) {
            this.raise_event('decompression_error', { algorithm, error });
            throw error;
        }
    }

    /**
     * Determines if data should be compressed based on content type and size.
     * @param {string|Buffer} data - The data to potentially compress.
     * @param {string} mimeType - The MIME type of the data.
     * @returns {boolean} - Whether the data should be compressed.
     */
    shouldCompress(data, mimeType) {
        // Safety check for null/undefined data
        if (!data) return false;
        
        // Don't compress already compressed formats
        if (mimeType && (
            mimeType.includes('image/') && !mimeType.includes('image/svg') ||
            mimeType.includes('video/') ||
            mimeType.includes('audio/') ||
            mimeType.includes('application/zip') ||
            mimeType.includes('application/x-gzip') ||
            mimeType.includes('application/x-compressed') ||
            mimeType.includes('application/x-7z-compressed')
        )) {
            return false;
        }
        
        // Do compress text-based formats
        const compressibleTypes = [
            'text/', 'application/json', 'application/javascript', 
            'application/xml', 'application/xhtml+xml', 'image/svg'
        ];
        
        const isCompressibleType = compressibleTypes.some(type => mimeType && mimeType.includes(type));
        
        // Don't compress tiny payloads - the overhead isn't worth it
        const minSizeToCompress = 150; // bytes
        const dataSize = Buffer.isBuffer(data) ? data.length : 
                        (typeof data === 'string' ? Buffer.byteLength(data) : 0);
        
        return isCompressibleType && dataSize >= minSizeToCompress;
    }

    /**
     * Convenience method to compress data using the default algorithm.
     * @param {string|Buffer} data - The data to compress.
     * @returns {Promise<{data: Buffer, compressed: boolean}>} - Compressed data with compression flag.
     */
    async compress_data(data) {
        const input = Buffer.isBuffer(data) ? data : Buffer.from(data);
        if (!this.shouldCompress(input, '')) {
            return { data: input, compressed: false };
        }
        const compressed = await this.compress(this.default_algorithm, input);
        return { data: compressed, compressed: true };
    }

    /**
     * Convenience method to decompress data if needed.
     * @param {Buffer|Object} data - The data to decompress or object with data and compressed flag.
     * @returns {Promise<Buffer>} - Decompressed data as a Buffer.
     */
    async decompress_data(data) {
        // Handle the case where we receive the object with compression flag
        if (data && typeof data === 'object' && 'compressed' in data) {
            if (!data.compressed) {
                return data.data; // Already uncompressed
            }
            return this.decompress(this.default_algorithm, data.data);
        }
        
        // For backward compatibility, try to decompress directly
        try {
            return await this.decompress(this.default_algorithm, data);
        } catch (error) {
            // If decompression fails, it might not be compressed
            console.warn("Decompression failed, assuming uncompressed:", error.message);
            return Buffer.isBuffer(data) ? data : Buffer.from(data);
        }
    }
}

module.exports = Compression_Manager;
