/**
 * Jest Configuration for noteRAG Chrome Extension
 */
module.exports = {
  // Use jsdom for browser-like environment
  testEnvironment: 'jsdom',
  
  // Setup files to run before tests
  setupFilesAfterEnv: ['<rootDir>/test/setupTests.js'],
  
  // Mock all CSS imports
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': '<rootDir>/test/__mocks__/styleMock.js',
    '\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$': '<rootDir>/test/__mocks__/fileMock.js'
  },
  
  // Transform ES modules
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // Do not transform node_modules except for specific packages
  transformIgnorePatterns: [
    '[/\\\\]node_modules[/\\\\].+\\.(js|jsx)$',
    '^.+\\.module\\.(css|sass|scss)$'
  ],
  
  // Test file patterns
  testMatch: [
    '<rootDir>/test/**/*.{js,jsx}',
    '<rootDir>/src/**/__tests__/**/*.{js,jsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx}'
  ],
  
  // Coverage settings
  collectCoverageFrom: ['src/**/*.{js,jsx}', '!src/**/*.d.ts'],
  
  // Other settings
  verbose: true,
  
  resetMocks: true
}; 