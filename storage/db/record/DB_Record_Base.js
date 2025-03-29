const { Evented_Class } = require('lang-mini');

class DB_Record_Base extends Evented_Class {
    constructor(options = {}) {
        super();
        const now = Date.now();
        this.created_at = options.created_at || now;
        this.modified_at = options.modified_at || this.created_at;
    }

    toJSON() {
        return {
            created_at: this.created_at,
            modified_at: this.modified_at
        };
    }

    clone() {
        return JSON.parse(JSON.stringify(this.toJSON()));
    }
}

module.exports = DB_Record_Base;
