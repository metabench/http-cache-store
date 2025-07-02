const DB_Record_Base = require('./DB_Record_Base');

/**
 * Represents a cache validation record in the database.
 * Extends the DB_Record_Base class.
 */
class DB_Cache_Validation_Record extends DB_Record_Base {
    /**
     * Creates an instance of DB_Cache_Validation_Record.
     * @param {Object} options - The options for the record.
     * @param {string} options.validation_id - The validation ID.
     * @param {string} options.response_id - The response ID.
     * @param {string} options.etag - The ETag value.
     * @param {string} options.last_modified - The last modified date.
     * @param {string} [options.validator_type] - The type of validator.
     * @param {boolean} [options.is_strong_validator=false] - Whether the validator is strong.
     * @param {Date} [options.validated_at] - The date the record was validated.
     */
    constructor(options = {}) {
        super(options);
        this.validation_id = options.validation_id;
        this.response_id = options.response_id;
        this.etag = options.etag;
        this.last_modified = options.last_modified;
        this.validator_type = options.validator_type || this._determineValidatorType();
        this.is_strong_validator = options.is_strong_validator || false;
        this.validated_at = options.validated_at || this.created_at;
    }

    /**
     * Determines the type of validator based on the provided properties.
     * @returns {string|null} The type of validator.
     */
    _determineValidatorType() {
        if (this.etag && this.last_modified) {
            return 'both';
        } else if (this.etag) {
            return 'etag';
        } else if (this.last_modified) {
            return 'last-modified';
        }
        return null;
    }

    /**
     * Checks if the record is valid.
     * @returns {boolean} True if the record is valid, false otherwise.
     */
    isValid() {
        return Boolean(this.validator_type);
    }

    /**
     * Check if the validator has expired
     * @param {number} [maxAgeMs=86400000] - Maximum age in milliseconds (default 24 hours)
     * @returns {boolean} - True if the validator is considered expired
     */
    isExpired(maxAgeMs = 86400000) {
        if (!this.validated_at) return true;
        const validatedAt = typeof this.validated_at === 'number' 
            ? this.validated_at 
            : new Date(this.validated_at).getTime();
        return (Date.now() - validatedAt) > maxAgeMs;
    }

    /**
     * Converts the record to a JSON object.
     * @returns {Object} The JSON representation of the record.
     */
    toJSON() {
        return {
            ...super.toJSON(),
            validation_id: this.validation_id,
            response_id: this.response_id,
            etag: this.etag,
            last_modified: this.last_modified,
            validator_type: this.validator_type,
            is_strong_validator: this.is_strong_validator,
            validated_at: this.validated_at
        };
    }
}

module.exports = DB_Cache_Validation_Record;
