/**
 * Logger Utility
 * 
 * Provides standardized logging functionality across the application.
 */

// Log levels
const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};

// Current log level (can be changed dynamically)
let currentLogLevel = LOG_LEVELS.INFO;

// Whether to include timestamps in logs
let includeTimestamp = true;

// Format the log message with module name and timestamp
const formatMessage = (module, message) => {
  const parts = [];
  
  // Add timestamp if enabled
  if (includeTimestamp) {
    parts.push(`[${new Date().toLocaleTimeString()}]`);
  }
  
  // Add module name if provided
  if (module) {
    parts.push(`[${module}]`);
  }
  
  // Add the message
  parts.push(message);
  
  return parts.join(' ');
};

// The logger object
export const logger = {
  // Configuration
  setLogLevel: (level) => {
    if (Object.values(LOG_LEVELS).includes(level)) {
      currentLogLevel = level;
    } else {
      console.warn(`Invalid log level: ${level}`);
    }
  },
  
  setIncludeTimestamp: (include) => {
    includeTimestamp = !!include;
  },
  
  // Log methods
  debug: (module, message, ...args) => {
    if ([LOG_LEVELS.DEBUG].includes(currentLogLevel)) {
      console.debug(formatMessage(module, message), ...args);
    }
  },
  
  info: (module, message, ...args) => {
    if ([LOG_LEVELS.DEBUG, LOG_LEVELS.INFO].includes(currentLogLevel)) {
      console.info(formatMessage(module, message), ...args);
    }
  },
  
  warn: (module, message, ...args) => {
    if ([LOG_LEVELS.DEBUG, LOG_LEVELS.INFO, LOG_LEVELS.WARN].includes(currentLogLevel)) {
      console.warn(formatMessage(module, message), ...args);
    }
  },
  
  error: (module, message, ...args) => {
    // Errors are always logged
    console.error(formatMessage(module, message), ...args);
  },
  
  // Log level constants
  levels: LOG_LEVELS,
}; 