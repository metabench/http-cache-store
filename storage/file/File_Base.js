/**
 * Base class for representing files in the cache.
 * This is an abstract class that should be extended.
 */
class File_Base {
    constructor(options = {}) {
        this.hash = options.hash || null;
        this.mime_type = options.mime_type || '';
        this.stored_at = options.stored_at || Date.now();
        this.metadata = options.metadata || {};
        this._content = null;
    }

    /**
     * Set the content of the file.
     * @param {Buffer|string|Uint8Array} content - The content to set
     * @returns {this} For method chaining
     */
    set_content(content) {
        if (content instanceof Buffer) {
            this._content = content;
        } else if (content instanceof Uint8Array) {
            this._content = Buffer.from(content);
        } else if (typeof content === 'string') {
            this._content = Buffer.from(content);
        } else if (content === null || content === undefined) {
            this._content = null;
        } else {
            // Try to convert to string
            this._content = Buffer.from(String(content));
        }
        return this;
    }

    /**
     * Get the content of the file.
     * @returns {Buffer} The file content as a Buffer
     */
    get_content() {
        return this._content;
    }

    /**
     * Check if the file is compressed.
     * @returns {boolean} Always false in the base class
     * @deprecated Use is_platform_compressed instead
     */
    get is_compressed() {
        // For backward compatibility
        return this.is_platform_compressed;
    }

    /**
     * Check if the file is platform compressed.
     * @returns {boolean} Always false in the base class
     */
    get is_platform_compressed() {
        return false;
    }

    /**
     * Convert the file to a JSON-friendly object.
     * @returns {Object} A plain object representation of the file
     */
    toJSON() {
        return {
            hash: this.hash,
            mime_type: this.mime_type,
            stored_at: this.stored_at,
            metadata: this.metadata,
            content_size: this._content ? this._content.length : 0,
            is_platform_compressed: this.is_platform_compressed
        };
    }
}

module.exports = File_Base;
