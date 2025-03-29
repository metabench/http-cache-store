const DB_Record_Base = require('./DB_Record_Base');

class DB_Compression_Process_Record extends DB_Record_Base {
    constructor(options = {}) {
        super(options);
        this.compression_process_id = options.compression_process_id;
        this.full_name = options.full_name;
        this.system_name = options.system_name;
        this.compression_level = options.compression_level;
        if (typeof options.options === 'string') {
            try {
                this.options = JSON.parse(options.options);
            } catch (e) {
                this.options = {};
            }
        } else {
            this.options = options.options || {};
        }
    }

    toJSON() {
        return {
            ...super.toJSON(),
            compression_process_id: this.compression_process_id,
            full_name: this.full_name,
            system_name: this.system_name,
            compression_level: this.compression_level,
            options: JSON.stringify(this.options)
        };
    }
}

module.exports = DB_Compression_Process_Record;
