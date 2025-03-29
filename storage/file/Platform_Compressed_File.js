const File_Base = require('./File_Base');

/**
 * Represents a file that has been compressed by the platform.
 */
class Platform_Compressed_File extends File_Base {
    constructor(options = {}) {
        super(options);
        this.compression_algorithm = options.compression_algorithm || 'unknown';
        this.original_size = options.original_size || 0;
        this.compressed_size = options.compressed_size || 0;
    }

    /**
     * @returns {boolean} true since this is a platform-compressed file
     */
    get is_platform_compressed() {
        return true;
    }

    /**
     * Calculate the compression ratio (original size / compressed size)
     * @returns {number} Compression ratio
     */
    get compression_ratio() {
        if (!this.compressed_size) return 1;
        return this.original_size / this.compressed_size;
    }

    /**
     * @override
     */
    set_content(content) {
        super.set_content(content);
        // Update compressed size when content is set
        this.compressed_size = this._content ? this._content.length : 0;
        return this;
    }

    /**
     * @override
     */
    toJSON() {
        const json = super.toJSON();
        return {
            ...json,
            compression_algorithm: this.compression_algorithm,
            original_size: this.original_size,
            compressed_size: this.compressed_size,
            compression_ratio: this.compression_ratio,
            is_platform_compressed: true
        };
    }

    /**
     * Returns the current compression ratio
     * @returns {number} Compression ratio or 1 if unknown
     * @deprecated Use compression_ratio property instead
     */
    get_compression_ratio() {
        return this.compression_ratio;
    }
}

module.exports = Platform_Compressed_File;