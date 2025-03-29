const Compression_Adapter_Base = require('./Compression_Adapter_Base');

class Compression_Adapter_No_Compression extends Compression_Adapter_Base {
	constructor(options = {}) {
		super(options);
	}
	
	/**
	 * No compression, just returns the data as a Buffer.
	 * @param {Buffer|string} data 
	 * @returns {Promise<Buffer>}
	 */
	compress(data) {
		// Ensure we always return a buffer
		return Promise.resolve(Buffer.isBuffer(data) ? data : Buffer.from(data));
	}
	
	/**
	 * No decompression, just returns the data as is.
	 * @param {Buffer} data 
	 * @returns {Promise<Buffer>}
	 */
	decompress(data) {
		// Ensure we always return a buffer
		return Promise.resolve(Buffer.isBuffer(data) ? data : Buffer.from(data));
	}
}

module.exports = Compression_Adapter_No_Compression;
