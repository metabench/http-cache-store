const DB_Record_Base = require('./DB_Record_Base');

class DB_Header_Pair_Record extends DB_Record_Base {
    constructor(options = {}) {
        super(options);
        this.header_pair_id = options.header_pair_id;
        this.header_name_id = options.header_name_id;
        this.header_value_id = options.header_value_id;
        // Store original header name and value.
        this._name = options.name;
        this._value = options.value;
    }

    get headerString() {
        return `${this._name}: ${this._value}`;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            header_pair_id: this.header_pair_id,
            header_name_id: this.header_name_id,
            header_value_id: this.header_value_id,
            name: this._name,
            value: this._value
        };
    }
}

module.exports = DB_Header_Pair_Record;
