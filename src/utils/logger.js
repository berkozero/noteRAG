/**
 * Centralized logger for consistent logging across the extension
 */
export const logger = {
  /**
   * Log an informational message
   * @param {string} module - The module/component name
   * @param {string} message - The message to log
   * @param {any} [data] - Optional data to include
   */
  info(module, message, data) {
    console.log(`[${module}] ${message}`, data !== undefined ? data : '');
  },

  /**
   * Log a warning message
   * @param {string} module - The module/component name
   * @param {string} message - The message to log
   * @param {any} [data] - Optional data to include
   */
  warn(module, message, data) {
    console.warn(`[${module}] ${message}`, data !== undefined ? data : '');
  },

  /**
   * Log an error message
   * @param {string} module - The module/component name
   * @param {string} message - The message to log
   * @param {Error|any} [error] - Optional error to include
   */
  error(module, message, error) {
    // Format the error message nicely
    if (error) {
      if (error instanceof Error) {
        console.error(`[${module}] ${message}:`, error.message, error);
      } else if (typeof error === 'object') {
        // Check if it's a Chrome runtime lastError object
        if (error.message) {
          console.error(`[${module}] ${message}: ${error.message}`, error);
        } else {
          try {
            // Try to stringify the object
            const errorStr = JSON.stringify(error);
            console.error(`[${module}] ${message}: ${errorStr}`);
          } catch (e) {
            // If stringify fails, just log the object
            console.error(`[${module}] ${message}`, error);
          }
        }
      } else {
        console.error(`[${module}] ${message}: ${error}`);
      }
    } else {
      console.error(`[${module}] ${message}`);
    }
  }
}; 