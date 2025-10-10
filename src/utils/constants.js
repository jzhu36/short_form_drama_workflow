/**
 * Application constants
 */

export const APP_NAME = 'Short Form Drama Workflow';
export const APP_VERSION = '0.1.0';

// File upload constraints
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// Generation status
export const STATUS = {
  IDLE: 'idle',
  GENERATING: 'generating',
  COMPLETE: 'complete',
  ERROR: 'error',
};

// Storage keys
export const STORAGE_KEYS = {
  ASSETS: 'sfdf_assets',
  VIDEOS: 'sfdf_videos',
  PROMPTS: 'sfdf_prompts',
  CONFIG: 'sfdf_config',
};

// IndexedDB configuration
export const DB_NAME = 'ShortFormDramaDB';
export const DB_VERSION = 1;
export const STORES = {
  ASSETS: 'assets',
  VIDEOS: 'videos',
  PROMPTS: 'prompts',
};
