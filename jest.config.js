/** @type {import('jest').Config} */
module.exports = {
  transform: {
    "^.+\\.[t|j]sx?$": "babel-jest"
  },
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx', 'node'],
  testEnvironment: 'jsdom',
  transformIgnorePatterns: [
    "/node_modules/(?!node-fetch).+\\.js$"
  ],
  setupFiles: ['./tests/setup.js']
}; 