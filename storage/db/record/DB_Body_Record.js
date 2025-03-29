const DB_Record_Base = require('./DB_Record_Base');

class DB_Body_Record extends DB_Record_Base {
    constructor(options = {}) {
        super(options);
        this.body_id = options.body_id;
        this.content_id = options.content_id;
        this.last_accessed_at = options.last_accessed_at;
        this.access_count = options.access_count || 0;
        this.is_deleted = options.is_deleted || false;
        this.version = options.version || 1;
        this.previous_version_id = options.previous_version_id;
        this.replaced_at = options.replaced_at;
    }

    recordAccess() {
        this.access_count++;
        this.last_accessed_at = Date.now();
        this.raise_event('accessed', {
            access_count: this.access_count,
            last_accessed_at: this.last_accessed_at
        });
    }

    createNewVersion() {
        this.previous_version_id = this.body_id;
        this.version++;
        this.replaced_at = Date.now();
        this.raise_event('version_created', {
            version: this.version,
            previous_version_id: this.previous_version_id
        });
    }
}

module.exports = DB_Body_Record;
