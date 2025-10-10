/**
 * Test setup file for Vitest
 */

// Mock IndexedDB for testing
import { beforeAll, afterAll, afterEach } from 'vitest';

// Setup before all tests
beforeAll(() => {
  // Mock window.indexedDB if not available
  if (typeof window !== 'undefined' && !window.indexedDB) {
    // Basic mock for IndexedDB
    window.indexedDB = {
      open: () => ({
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      }),
    };
  }
});

// Cleanup after each test
afterEach(() => {
  // Clear any mocks or test data
  localStorage.clear();
});

// Cleanup after all tests
afterAll(() => {
  // Final cleanup
});
