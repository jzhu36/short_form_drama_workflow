/**
 * IndexedDB Service
 * Handles blob storage for videos and images
 */

export class IndexedDBService {
  constructor(dbName = 'AssetManagerDB', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  /**
   * Initialize the database
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error('Failed to open IndexedDB'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains('uploadedAssets')) {
          db.createObjectStore('uploadedAssets', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('generatedAssets')) {
          db.createObjectStore('generatedAssets', { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Save an asset (uploaded or generated)
   */
  async saveAsset(storeName, asset) {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(asset);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to save asset to ${storeName}`));
    });
  }

  /**
   * Get an asset by ID
   */
  async getAsset(storeName, id) {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to get asset from ${storeName}`));
    });
  }

  /**
   * Get all assets from a store
   */
  async getAllAssets(storeName) {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(new Error(`Failed to get assets from ${storeName}`));
    });
  }

  /**
   * Delete an asset
   */
  async deleteAsset(storeName, id) {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete asset from ${storeName}`));
    });
  }

  /**
   * Clear all assets from a store
   */
  async clearStore(storeName) {
    if (!this.db) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to clear ${storeName}`));
    });
  }

  /**
   * Close the database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}

// Export a singleton instance
export const indexedDBService = new IndexedDBService();
