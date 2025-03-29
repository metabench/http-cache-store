/**
 * Utility class for consistent error handling across the application
 */
class ErrorHandler {
    /**
     * Create a standardized error object with additional context
     * @param {string} message - Error message
     * @param {string} code - Error code
     * @param {Object} [context={}] - Additional context information
     * @returns {Error} Enhanced error object
     */
    static createError(message, code, context = {}) {
        const error = new Error(message);
        error.code = code;
        error.context = context;
        error.timestamp = Date.now();
        return error;
    }

    /**
     * Log error with consistent format
     * @param {Error} error - Error to log
     * @param {string} [component] - Component where error occurred
     */
    static logError(error, component) {
        console.error(`[${component || 'HTTP-CACHE-STORE'}] ERROR: ${error.message}`);
        if (error.context) {
            console.error('Context:', error.context);
        }
        if (error.stack) {
            console.error('Stack:', error.stack);
        }
    }
}

module.exports = ErrorHandler;
