/**
 * StorageService - IndexedDB wrapper for storing assets and videos
 */

export class StorageService {
  constructor(debugPanel = null) {
    this.dbName = 'SoraVideoApp';
    this.version = 1;
    this.db = null;
    this.debug = debugPanel;
  }

  /**
   * Initialize the IndexedDB database
   */
  async initialize() {
    this.debug?.logInfo('Initializing IndexedDB...');

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        this.debug?.logError('Failed to open database');
        reject(new Error('Failed to open database'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('StorageService initialized successfully');
        this.debug?.logSuccess('IndexedDB initialized successfully');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        this.debug?.logInfo('Creating IndexedDB schema...');

        // Create Assets store
        if (!db.objectStoreNames.contains('assets')) {
          const assetsStore = db.createObjectStore('assets', { keyPath: 'id', autoIncrement: true });
          assetsStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
          assetsStore.createIndex('fileType', 'fileType', { unique: false });
        }

        // Create Videos store
        if (!db.objectStoreNames.contains('videos')) {
          const videosStore = db.createObjectStore('videos', { keyPath: 'id', autoIncrement: true });
          videosStore.createIndex('generatedAt', 'generatedAt', { unique: false });
          videosStore.createIndex('soraVideoId', 'soraVideoId', { unique: false });
        }

        // Create Prompts store
        if (!db.objectStoreNames.contains('prompts')) {
          const promptsStore = db.createObjectStore('prompts', { keyPath: 'id', autoIncrement: true });
          promptsStore.createIndex('createdAt', 'createdAt', { unique: false });
        }

        console.log('Database schema created');
        this.debug?.logSuccess('IndexedDB schema created');
      };
    });
  }

  /**
   * Save a video to the database
   * @param {Object} videoData - Video data object
   * @returns {Promise<number>} The ID of the saved video
   */
  async saveVideo(videoData) {
    this.debug?.logInfo('Saving video to IndexedDB...', { soraVideoId: videoData.soraVideoId });

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['videos'], 'readwrite');
      const store = transaction.objectStore('videos');

      const video = {
        ...videoData,
        generatedAt: videoData.generatedAt || new Date().toISOString()
      };

      const request = store.add(video);

      request.onsuccess = () => {
        console.log('Video saved with ID:', request.result);
        this.debug?.logSuccess(`Video saved to IndexedDB with ID: ${request.result}`);
        resolve(request.result);
      };

      request.onerror = () => {
        this.debug?.logError('Failed to save video to IndexedDB');
        reject(new Error('Failed to save video'));
      };
    });
  }

  /**
   * Get a video by ID
   * @param {number} id - The video ID
   * @returns {Promise<Object>} The video object
   */
  async getVideo(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['videos'], 'readonly');
      const store = transaction.objectStore('videos');
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get video'));
      };
    });
  }

  /**
   * Get all videos
   * @returns {Promise<Array>} Array of video objects
   */
  async getAllVideos() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['videos'], 'readonly');
      const store = transaction.objectStore('videos');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get videos'));
      };
    });
  }

  /**
   * Save a prompt to the database
   * @param {string} promptText - The prompt text
   * @param {number} videoId - Associated video ID (optional)
   * @returns {Promise<number>} The ID of the saved prompt
   */
  async savePrompt(promptText, videoId = null) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['prompts'], 'readwrite');
      const store = transaction.objectStore('prompts');

      const prompt = {
        text: promptText,
        createdAt: new Date().toISOString(),
        videoId
      };

      const request = store.add(prompt);

      request.onsuccess = () => {
        console.log('Prompt saved with ID:', request.result);
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to save prompt'));
      };
    });
  }

  /**
   * Get all prompts
   * @returns {Promise<Array>} Array of prompt objects
   */
  async getAllPrompts() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['prompts'], 'readonly');
      const store = transaction.objectStore('prompts');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get prompts'));
      };
    });
  }

  /**
   * Save an asset to the database
   * @param {Object} assetData - Asset data object
   * @returns {Promise<number>} The ID of the saved asset
   */
  async saveAsset(assetData) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['assets'], 'readwrite');
      const store = transaction.objectStore('assets');

      const asset = {
        ...assetData,
        uploadedAt: assetData.uploadedAt || new Date().toISOString()
      };

      const request = store.add(asset);

      request.onsuccess = () => {
        console.log('Asset saved with ID:', request.result);
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to save asset'));
      };
    });
  }

  /**
   * Get all assets
   * @returns {Promise<Array>} Array of asset objects
   */
  async getAllAssets() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['assets'], 'readonly');
      const store = transaction.objectStore('assets');
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error('Failed to get assets'));
      };
    });
  }

  /**
   * Delete a video by ID
   * @param {number} id - The video ID
   */
  async deleteVideo(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['videos'], 'readwrite');
      const store = transaction.objectStore('videos');
      const request = store.delete(id);

      request.onsuccess = () => {
        console.log('Video deleted:', id);
        resolve();
      };

      request.onerror = () => {
        reject(new Error('Failed to delete video'));
      };
    });
  }
}
