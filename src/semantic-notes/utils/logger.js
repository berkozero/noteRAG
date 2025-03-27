/**
 * Simple logger module for semantic notes
 */

// Log levels
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Current log level (can be overridden through environment)
const currentLevel = LOG_LEVELS.debug; // Changed to debug to show more information

/**
 * Log a message if its level is equal to or higher than the current level
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {*} [data] - Optional data to log
 */
function log(level, message, data) {
  if (LOG_LEVELS[level] >= currentLevel) {
    const timestamp = new Date().toLocaleTimeString();
    
    if (data === undefined) {
      console.log(`[${timestamp}] [${message}] ${data}`);
    } else if (data instanceof Error) {
      console.log(`[${timestamp}] [${message}] ${data.message}`);
      console.log(data.stack);
    } else {
      console.log(`[${timestamp}] [${message}] ${JSON.stringify(data)}`);
    }
  }
}

module.exports = {
  debug: (message, data) => log('debug', message, data),
  info: (message, data) => log('info', message, data),
  warn: (message, data) => log('warn', message, data),
  error: (message, data) => log('error', message, data)
}; 