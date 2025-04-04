/**
 * Jest Configuration for noteRAG Chrome Extension
 */
module.exports = {
  // Use jsdom for browser-like environment
  testEnvironment: 'jsdom',
  
  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  
  // Mock all CSS imports
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/tests/mocks/styleMock.js'
  },
  
  // Transform ES modules
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Do not transform node_modules except for specific packages
  transformIgnorePatterns: [
    '/node_modules/(?!@babel)',
  ],
  
  // Test file patterns
  testMatch: [
    '**/__tests__/**/*.js',
    '**/?(*.)+(spec|test).js'
  ],
  
  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/pages/Background/index.js',
    '!**/node_modules/**'
  ],
  
  // Other settings
  verbose: true
}; 