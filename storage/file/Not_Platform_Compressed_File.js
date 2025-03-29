const File_Base = require('./File_Base');

/**
 * Represents a file that has not been compressed by the platform.
 * The file may still be compressed using an external algorithm.
 */
class Not_Platform_Compressed_File extends File_Base {
    constructor(options = {}) {
        super(options);
        // Set size when file is created if provided
        this.original_size = options.original_size || 0;
    }

    /**
     * @returns {boolean} false since this is not compressed by our platform
     */
    get is_platform_compressed() {
        return false;
    }

    /**
     * @override
     */
    set_content(content) {
        super.set_content(content);
        // Update original size when content is set
        this.original_size = this._content ? this._content.length : 0;
        return this;
    }

    /**
     * @override
     */
    toJSON() {
        const json = super.toJSON();
        return {
            ...json,
            original_size: this.original_size,
            is_platform_compressed: false
        };
    }
}

module.exports = Not_Platform_Compressed_File;

