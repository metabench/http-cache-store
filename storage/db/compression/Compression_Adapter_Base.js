const { Evented_Class } = require('lang-mini');

/**
 * Base class for compression adapters.
 */
class Compression_Adapter_Base extends Evented_Class {
    constructor(options = {}) {
        super();
    }
}

module.exports = Compression_Adapter_Base;