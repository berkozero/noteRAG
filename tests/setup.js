// Setup fetch globally for tests
global.fetch = jest.fn();

// Mock chrome API
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  action: {
    setIcon: jest.fn()
  },
  runtime: {
    lastError: null
  }
}; 