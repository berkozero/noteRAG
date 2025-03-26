import { logger } from '../../utils/logger';

/**
 * Centralized messaging service for communication between components
 */
export const messagingService = {
  // Active connections storage
  connections: new Map(),
  
  /**
   * Initialize background script messaging handlers
   */
  initBackground() {
    // Listen for connection attempts
    chrome.runtime.onConnect.addListener(this.handleConnect.bind(this));
    
    // Listen for one-time messages
    chrome.runtime.onMessage.addListener(this.handleBackgroundMessage.bind(this));
    
    logger.info('Messaging', 'Background messaging initialized');
  },
  
  /**
   * Handle incoming connections
   * @param {chrome.runtime.Port} port - The connection port
   */
  handleConnect(port) {
    logger.info('Messaging', `New connection from ${port.name}`);
    
    // Store the connection
    this.connections.set(port.name, port);
    
    // Setup listeners
    port.onMessage.addListener((msg) => this.handlePortMessage(port, msg));
    
    port.onDisconnect.addListener(() => {
      logger.info('Messaging', `Port disconnected: ${port.name}`);
      this.connections.delete(port.name);
      
      if (chrome.runtime.lastError) {
        logger.error('Messaging', 'Disconnect error', chrome.runtime.lastError);
      }
    });
    
    // Send confirmation
    this.sendToPort(port, { type: 'CONNECTION_ESTABLISHED' });
  },
  
  /**
   * Handle messages from a port
   * @param {chrome.runtime.Port} port - The port that sent the message
   * @param {Object} message - The message payload
   */
  handlePortMessage(port, message) {
    logger.info('Messaging', `Message from ${port.name}`, message);
    
    // Handle common messages
    switch (message.type) {
      case 'PING':
        this.sendToPort(port, { type: 'PONG' });
        break;
      default:
        // Let specific handlers deal with this
        if (this.portMessageHandlers[message.type]) {
          this.portMessageHandlers[message.type](port, message);
        }
    }
  },
  
  /**
   * Handle one-time messages in background script
   * @param {Object} message - The message 
   * @param {Object} sender - The message sender
   * @param {Function} sendResponse - Function to send a response
   * @returns {boolean} - Return true to indicate async response
   */
  handleBackgroundMessage(message, sender, sendResponse) {
    logger.info('Messaging', 'One-time message received', { message, sender });
    
    try {
      const handler = this.backgroundMessageHandlers[message.action];
      if (handler) {
        handler(message, sender, sendResponse);
        return true; // Keep the message channel open for async response
      }
      
      logger.warn('Messaging', `No handler for message: ${message.action}`);
      sendResponse({ error: 'No handler for this message type' });
    } catch (error) {
      logger.error('Messaging', 'Error handling message', error);
      sendResponse({ error: error.message });
    }
    
    return true; // Keep the message channel open for async response
  },
  
  /**
   * Initialize popup/content script messaging
   */
  initClient() {
    this.port = null;
    this.connectionAttempts = 0;
    this.MAX_RECONNECT_ATTEMPTS = 3;
    
    // Setup disconnection handler when page is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.port) {
        this.disconnect();
      }
    });
    
    logger.info('Messaging', 'Client messaging initialized');
    return this.connectToBackground();
  },
  
  /**
   * Connect to the background script
   * @returns {Promise<boolean>} - True if connection succeeded
   */
  connectToBackground() {
    if (this.connectionAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
      logger.warn('Messaging', 'Max reconnection attempts reached');
      return Promise.resolve(false);
    }
    
    return new Promise((resolve) => {
      try {
        logger.info('Messaging', 'Connecting to background script');
        this.port = chrome.runtime.connect({ name: 'popup' });
        
        this.port.onDisconnect.addListener(() => {
          const error = chrome.runtime.lastError;
          logger.info('Messaging', 'Disconnected from background', error ? error.message : '');
          
          this.port = null;
          
          // Only reconnect if not hidden
          if (document.visibilityState !== 'hidden') {
            this.connectionAttempts++;
            setTimeout(() => {
              this.connectToBackground().then(resolve);
            }, 1000);
          } else {
            resolve(false);
          }
        });
        
        // Setup message handling
        this.port.onMessage.addListener(this.handleClientMessage.bind(this));
        
        logger.info('Messaging', 'Connection established');
        this.connectionAttempts = 0;
        resolve(true);
      } catch (error) {
        logger.error('Messaging', 'Connection error', error);
        this.connectionAttempts++;
        resolve(false);
      }
    });
  },
  
  /**
   * Disconnect from the background script
   */
  disconnect() {
    if (this.port) {
      try {
        logger.info('Messaging', 'Manually disconnecting from background');
        this.port.disconnect();
        this.port = null;
      } catch (e) {
        logger.error('Messaging', 'Error during disconnect', e);
      }
    }
  },
  
  /**
   * Handle messages in client
   * @param {Object} message - The message received
   */
  handleClientMessage(message) {
    logger.info('Messaging', 'Message received', message);
    
    // Let specific handlers deal with this
    if (this.clientMessageHandlers[message.type]) {
      this.clientMessageHandlers[message.type](message);
    }
  },
  
  /**
   * Send a message to the background script
   * @param {Object} message - The message to send
   * @returns {Promise<any>} - The response from the background
   */
  sendToBackground(message) {
    logger.info('Messaging', 'Sending message to background', message);
    
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          logger.warn('Messaging', 'Error sending message', chrome.runtime.lastError);
          reject(chrome.runtime.lastError);
        } else {
          logger.info('Messaging', 'Response received', response);
          resolve(response);
        }
      });
    });
  },
  
  /**
   * Send a message through a port
   * @param {chrome.runtime.Port} port - The port to send through
   * @param {Object} message - The message to send
   */
  sendToPort(port, message) {
    try {
      port.postMessage(message);
    } catch (error) {
      logger.error('Messaging', `Error sending to ${port.name}`, error);
    }
  },
  
  /**
   * Send a message to all connected clients
   * @param {Object} message - The message to send
   */
  broadcast(message) {
    this.connections.forEach((port) => {
      this.sendToPort(port, message);
    });
  },
  
  /**
   * Specific handlers for port messages
   */
  portMessageHandlers: {},
  
  /**
   * Specific handlers for background messages
   */
  backgroundMessageHandlers: {},
  
  /**
   * Specific handlers for client messages
   */
  clientMessageHandlers: {},
  
  /**
   * Register message handlers
   * @param {string} type - The type of handler ('port', 'background', or 'client')
   * @param {string} action - The message action/type to handle
   * @param {Function} handler - The handler function
   */
  registerHandler(type, action, handler) {
    switch (type) {
      case 'port':
        this.portMessageHandlers[action] = handler;
        break;
      case 'background':
        this.backgroundMessageHandlers[action] = handler;
        break;
      case 'client':
        this.clientMessageHandlers[action] = handler;
        break;
      default:
        logger.error('Messaging', `Unknown handler type: ${type}`);
    }
  }
}; 