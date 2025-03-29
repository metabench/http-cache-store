const zlib = require('zlib');
const Compression_Adapter_Base = require('./Compression_Adapter_Base');

class Compression_Adapter_Brotli extends Compression_Adapter_Base {
	constructor(options = {}) {
		super(options);
	}
	
	/**
	 * Compress data using Brotli.
	 * @param {Buffer|string} data 
	 * @returns {Promise<Buffer>}
	 */
	compress(data) {
		return new Promise((resolve, reject) => {
			try {
				const input = Buffer.isBuffer(data) ? data : Buffer.from(data);
				zlib.brotliCompress(input, (err, compressed) => {
					if (err) {
						return reject(err);
					}
					resolve(compressed);
				});
			} catch (error) {
				reject(error);
			}
		});
	}
	
	/**
	 * Decompress Brotli-compressed data.
	 * @param {Buffer} data 
	 * @returns {Promise<Buffer>}
	 */
	decompress(data) {
		return new Promise((resolve, reject) => {
			try {
				if (!Buffer.isBuffer(data)) {
					data = Buffer.from(data);
				}
				
				zlib.brotliDecompress(data, (err, decompressed) => {
					if (err) {
						return reject(err);
					}
					// Return buffer directly - string conversion should happen at usage site
					resolve(decompressed);
				});
			} catch (error) {
				reject(error);
			}
		});
	}
}

module.exports = Compression_Adapter_Brotli;