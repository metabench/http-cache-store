const DB_Record_Base = require('./DB_Record_Base');

class DB_Request_Record extends DB_Record_Base {
    constructor(options = {}) {
        super(options);
        this.request_id = options.request_id;
        this.url_id = options.url_id;
        this.method_id = options.method_id;
        this.requested_at = options.requested_at || this.created_at;
        this.body_id = options.body_id || null;
        // Using a Map for headers ensures keys are always in lower-case.
        this.headers = new Map();
    }

    addHeader(name, value) {
        this.headers.set(name.toLowerCase(), value);
        this.modified_at = Date.now();
    }

    getHeader(name) {
        return this.headers.get(name.toLowerCase());
    }

    toJSON() {
        return {
            ...super.toJSON(),
            request_id: this.request_id,
            url_id: this.url_id,
            method_id: this.method_id,
            requested_at: this.requested_at,
            body_id: this.body_id,
            headers: Object.fromEntries(this.headers)
        };
    }
}

module.exports = DB_Request_Record;
