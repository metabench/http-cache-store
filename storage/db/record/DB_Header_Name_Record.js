const DB_Record_Base = require('./DB_Record_Base');

class DB_Header_Name_Record extends DB_Record_Base {
    constructor(options = {}) {
        super(options);
        this.header_name_id = options.header_name_id;
        this.name = options.name ? options.name.trim().toLowerCase() : null;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            header_name_id: this.header_name_id,
            name: this.name
        };
    }
}

module.exports = DB_Header_Name_Record;
