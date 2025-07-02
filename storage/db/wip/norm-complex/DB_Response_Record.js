const DB_Record_Base = require('./DB_Record_Base');

class DB_Response_Record extends DB_Record_Base {
    constructor(options = {}) {
        super(options);
        this.response_id = options.response_id;
        this.request_id = options.request_id;
        this.status_code = options.status_code;
        this.responded_at = options.responded_at || this.created_at;
        this.expires_at = options.expires_at;
        this.max_age = options.max_age;
        this.must_revalidate = options.must_revalidate || false;
        this.no_cache = options.no_cache || false;
        this.no_store = options.no_store || false;
        this.body_id = options.body_id;
        this.is_deleted = options.is_deleted || false;
        this.headers = new Map();
    }

    // Convert expires_at to a timestamp for comparison.
    _getExpiresTimestamp() {
        if (!this.expires_at) return null;
        return typeof this.expires_at === 'number'
            ? this.expires_at
            : new Date(this.expires_at).getTime();
    }

    isExpired() {
        const expiresAt = this._getExpiresTimestamp();
        if (!expiresAt) return false;
        return Date.now() > expiresAt;
    }

    needsRevalidation() {
        return this.must_revalidate || this.isExpired();
    }

    toJSON() {
        return {
            ...super.toJSON(),
            response_id: this.response_id,
            request_id: this.request_id,
            status_code: this.status_code,
            responded_at: this.responded_at,
            expires_at: this.expires_at,
            max_age: this.max_age,
            must_revalidate: this.must_revalidate,
            no_cache: this.no_cache,
            no_store: this.no_store,
            body_id: this.body_id,
            is_deleted: this.is_deleted,
            headers: Object.fromEntries(this.headers)
        };
    }
}

module.exports = DB_Response_Record;
