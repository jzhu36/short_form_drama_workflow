import { describe, it, expect } from 'vitest';
import {
  APP_NAME,
  APP_VERSION,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_VIDEO_TYPES,
  MAX_FILE_SIZE,
  STATUS,
  STORAGE_KEYS,
  DB_NAME,
  DB_VERSION,
  STORES,
} from '../../src/utils/constants.js';

describe('Constants', () => {
  describe('App Information', () => {
    it('should have correct app name', () => {
      expect(APP_NAME).toBe('Short Form Drama Workflow');
    });

    it('should have correct app version', () => {
      expect(APP_VERSION).toBe('0.1.0');
    });
  });

  describe('File Type Constraints', () => {
    it('should define allowed image types', () => {
      expect(ALLOWED_IMAGE_TYPES).toBeInstanceOf(Array);
      expect(ALLOWED_IMAGE_TYPES).toContain('image/jpeg');
      expect(ALLOWED_IMAGE_TYPES).toContain('image/png');
      expect(ALLOWED_IMAGE_TYPES.length).toBeGreaterThan(0);
    });

    it('should define allowed video types', () => {
      expect(ALLOWED_VIDEO_TYPES).toBeInstanceOf(Array);
      expect(ALLOWED_VIDEO_TYPES).toContain('video/mp4');
      expect(ALLOWED_VIDEO_TYPES.length).toBeGreaterThan(0);
    });

    it('should have reasonable max file size', () => {
      expect(MAX_FILE_SIZE).toBeGreaterThan(0);
      expect(MAX_FILE_SIZE).toBe(100 * 1024 * 1024); // 100MB
    });
  });

  describe('Status Constants', () => {
    it('should define all required statuses', () => {
      expect(STATUS.IDLE).toBe('idle');
      expect(STATUS.GENERATING).toBe('generating');
      expect(STATUS.COMPLETE).toBe('complete');
      expect(STATUS.ERROR).toBe('error');
    });

    it('should have unique status values', () => {
      const values = Object.values(STATUS);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe('Storage Keys', () => {
    it('should define all storage keys', () => {
      expect(STORAGE_KEYS.ASSETS).toBeDefined();
      expect(STORAGE_KEYS.VIDEOS).toBeDefined();
      expect(STORAGE_KEYS.PROMPTS).toBeDefined();
      expect(STORAGE_KEYS.CONFIG).toBeDefined();
    });

    it('should have unique storage keys', () => {
      const values = Object.values(STORAGE_KEYS);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe('IndexedDB Configuration', () => {
    it('should have database name', () => {
      expect(DB_NAME).toBe('ShortFormDramaDB');
    });

    it('should have database version', () => {
      expect(DB_VERSION).toBe(1);
      expect(DB_VERSION).toBeGreaterThan(0);
    });

    it('should define all required stores', () => {
      expect(STORES.ASSETS).toBe('assets');
      expect(STORES.VIDEOS).toBe('videos');
      expect(STORES.PROMPTS).toBe('prompts');
    });
  });
});
