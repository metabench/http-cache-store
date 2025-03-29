const DB_Record_Base = require('./DB_Record_Base');

class DB_Body_Content_Record extends DB_Record_Base {
    constructor(options = {}) {
        super(options);
        this.content_id = options.content_id;
        this.content_hash = options.content_hash;
        this.body_content = options.body_content;
        this.content_type = options.content_type;
        this.content_encoding = options.content_encoding;
        this.content_length = options.content_length;
        this.mime_category = options.mime_category;
        this.compression_process_id = options.compression_process_id;
        this.original_size = options.original_size;
        this.compressed_size = options.compressed_size;
        this.compression_ratio = options.compression_ratio;
        this.reference_count = options.reference_count || 1;
        this.first_seen_at = options.first_seen_at || this.created_at;
        this.last_referenced_at = options.last_referenced_at;
    }

    // Increment the reference count and update last-referenced timestamp.
    incrementReferenceCount() {
        this.reference_count++;
        this.last_referenced_at = Date.now();
        this.raise_event('reference_count_changed', { count: this.reference_count });
    }

    // Decrement reference count with an event trigger.
    decrementReferenceCount() {
        this.reference_count--;
        this.last_referenced_at = Date.now();
        this.raise_event('reference_count_changed', { count: this.reference_count });
        return this.reference_count;
    }
}

module.exports = DB_Body_Content_Record;
