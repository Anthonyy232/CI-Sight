import {jest} from '@jest/globals';

// Mock axios globally
jest.mock('axios');

// Mock logger to avoid console output in tests
jest.mock('./src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));