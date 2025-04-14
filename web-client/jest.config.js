/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jest-environment-jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'], // Optional setup file
  moduleNameMapper: {
    // Handle module aliases (like @/components)
    '^@/(.*)$': '<rootDir>/$1',
  },
  transform: {
    // Use ts-jest for ts/tsx files
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.json', // Use the project's tsconfig
      },
    ],
  },
}; 