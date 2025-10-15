/**
 * AssetManager Component
 * Manages uploaded and generated assets (images and videos)
 */

import { indexedDBService } from '../services/IndexedDBService.js';

export class AssetManager {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = null;
    this.uploadedAssets = [];
    this.generatedAssets = [];
    this.onAssetSelect = null;
    this.onAssetDrag = null; // Callback for drag operations
    this.dbService = indexedDBService;
  }

  /**
   * Initialize the component
   */
  async initialize() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      throw new Error(`Container #${this.containerId} not found`);
    }

    // Initialize IndexedDB
    await this.dbService.initialize();

    this.render();
    this.attachEventListeners();
    await this.loadAssetsFromStorage();
  }

  /**
   * Render the asset manager UI
   */
  render() {
    this.container.innerHTML = `
      <div class="asset-manager">
        <div class="asset-manager-header">
          <h3>Asset Manager</h3>
        </div>

        <!-- Uploaded Assets Section -->
        <div class="asset-section">
          <div class="asset-section-header">
            <h4>📁 Uploaded Assets</h4>
            <button class="btn-icon" id="upload-asset-btn" title="Upload Asset">
              ➕
            </button>
          </div>
          <div class="asset-list" id="uploaded-assets-list">
            <div class="asset-empty">No uploaded assets</div>
          </div>
        </div>

        <!-- Generated Assets Section -->
        <div class="asset-section">
          <div class="asset-section-header">
            <h4>🎬 Generated Assets</h4>
            <button class="btn-icon" id="refresh-generated-btn" title="Refresh">
              🔄
            </button>
          </div>
          <div class="asset-list" id="generated-assets-list">
            <div class="asset-empty">No generated videos</div>
          </div>
        </div>
      </div>

      <!-- Hidden file input -->
      <input type="file" id="asset-file-input" accept="image/*,video/*" multiple style="display: none;">
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    const uploadBtn = this.container.querySelector('#upload-asset-btn');
    const refreshBtn = this.container.querySelector('#refresh-generated-btn');
    const fileInput = this.container.querySelector('#asset-file-input');

    uploadBtn.addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
      this.handleFileUpload(e.target.files);
      fileInput.value = ''; // Reset input
    });

    refreshBtn.addEventListener('click', () => {
      this.refreshGeneratedAssets();
    });
  }

  /**
   * Handle file upload
   */
  async handleFileUpload(files) {
    if (!files || files.length === 0) return;

    const assetsToAdd = [];
    const invalidFiles = [];

    // Process all files first
    for (const file of files) {
      if (!this.isValidFile(file)) {
        invalidFiles.push(file.name);
        continue;
      }

      const asset = {
        id: this.generateId(),
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 'video',
        size: file.size,
        uploadedAt: new Date().toISOString(),
        blob: file
      };

      assetsToAdd.push(asset);
    }

    // Show errors for invalid files
    if (invalidFiles.length > 0) {
      alert(`Invalid file type(s): ${invalidFiles.join(', ')}. Only images and videos are supported.`);
    }

    // Add all valid assets at once
    if (assetsToAdd.length > 0) {
      this.uploadedAssets.push(...assetsToAdd);
      await this.saveToStorage();
      this.renderUploadedAssets();
    }
  }

  /**
   * Validate file type
   */
  isValidFile(file) {
    return file.type.startsWith('image/') || file.type.startsWith('video/');
  }

  /**
   * Add a generated video asset
   */
  async addGeneratedAsset(videoBlob, metadata = {}) {
    const asset = {
      id: this.generateId(),
      name: metadata.prompt ? `${metadata.prompt.substring(0, 30)}...` : 'Generated Video',
      type: 'video',
      generatedAt: metadata.generatedAt || new Date().toISOString(),
      prompt: metadata.prompt || '',
      provider: metadata.provider || 'Unknown',
      model: metadata.model || '',
      resolution: metadata.resolution || metadata.size || '',
      duration: metadata.duration || '',
      blob: videoBlob
    };

    this.generatedAssets.unshift(asset); // Add to beginning
    await this.saveToStorage();
    this.renderGeneratedAssets();
  }

  /**
   * Render uploaded assets
   */
  renderUploadedAssets() {
    const listContainer = this.container.querySelector('#uploaded-assets-list');

    if (this.uploadedAssets.length === 0) {
      listContainer.innerHTML = '<div class="asset-empty">No uploaded assets</div>';
      return;
    }

    listContainer.innerHTML = this.uploadedAssets.map(asset => this.createAssetCard(asset, 'uploaded')).join('');
    this.attachAssetListeners('uploaded');
  }

  /**
   * Render generated assets
   */
  renderGeneratedAssets() {
    const listContainer = this.container.querySelector('#generated-assets-list');

    if (this.generatedAssets.length === 0) {
      listContainer.innerHTML = '<div class="asset-empty">No generated videos</div>';
      return;
    }

    listContainer.innerHTML = this.generatedAssets.map(asset => this.createAssetCard(asset, 'generated')).join('');
    this.attachAssetListeners('generated');
  }

  /**
   * Create asset card HTML
   */
  createAssetCard(asset, category) {
    const isVideo = asset.type === 'video';
    const thumbnailUrl = asset.blob ? URL.createObjectURL(asset.blob) : '';
    const date = new Date(asset.uploadedAt || asset.generatedAt).toLocaleString();
    const sizeStr = asset.size ? this.formatFileSize(asset.size) : '';

    if (category === 'uploaded') {
      return `
        <div class="asset-card" data-id="${asset.id}" data-category="${category}" draggable="${isVideo}">
          <div class="asset-thumbnail">
            ${isVideo ?
              `<video src="${thumbnailUrl}" muted></video>` :
              `<img src="${thumbnailUrl}" alt="${asset.name}">`
            }
            <div class="asset-type-badge">${isVideo ? '🎬' : '🖼️'}</div>
          </div>
          <div class="asset-info">
            <div class="asset-name" title="${asset.name}">${asset.name}</div>
            <div class="asset-meta">
              <span>${date}</span>
              ${sizeStr ? `<span>${sizeStr}</span>` : ''}
            </div>
          </div>
          <div class="asset-actions">
            <button class="btn-icon-small asset-delete" data-id="${asset.id}" data-category="${category}" title="Delete">
              🗑️
            </button>
          </div>
        </div>
      `;
    } else {
      // Generated assets with more metadata
      return `
        <div class="asset-card" data-id="${asset.id}" data-category="${category}" draggable="true">
          <div class="asset-thumbnail">
            <video src="${thumbnailUrl}" muted></video>
            <div class="asset-type-badge">🎬</div>
          </div>
          <div class="asset-info">
            <div class="asset-name" title="${asset.prompt}">${asset.name}</div>
            <div class="asset-meta">
              <div class="asset-meta-row">
                <span class="asset-meta-label">Time:</span>
                <span>${date}</span>
              </div>
              <div class="asset-meta-row">
                <span class="asset-meta-label">Provider:</span>
                <span>${asset.provider}</span>
              </div>
              ${asset.model ? `
                <div class="asset-meta-row">
                  <span class="asset-meta-label">Model:</span>
                  <span>${asset.model}</span>
                </div>
              ` : ''}
              ${asset.resolution ? `
                <div class="asset-meta-row">
                  <span class="asset-meta-label">Resolution:</span>
                  <span>${asset.resolution}</span>
                </div>
              ` : ''}
              ${asset.prompt ? `
                <div class="asset-meta-row asset-prompt">
                  <span class="asset-meta-label">Prompt:</span>
                  <span>"${asset.prompt.substring(0, 50)}${asset.prompt.length > 50 ? '...' : ''}"</span>
                </div>
              ` : ''}
            </div>
          </div>
          <div class="asset-actions">
            <button class="btn-icon-small asset-download" data-id="${asset.id}" data-category="${category}" title="Download">
              ⬇️
            </button>
            <button class="btn-icon-small asset-delete" data-id="${asset.id}" data-category="${category}" title="Delete">
              🗑️
            </button>
          </div>
        </div>
      `;
    }
  }

  /**
   * Attach listeners to asset cards
   */
  attachAssetListeners(category) {
    const selector = category === 'uploaded' ? '#uploaded-assets-list' : '#generated-assets-list';
    const listContainer = this.container.querySelector(selector);

    // Click on card to select
    listContainer.querySelectorAll('.asset-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.asset-actions')) return; // Ignore clicks on action buttons

        const id = card.dataset.id;
        const category = card.dataset.category;
        this.selectAsset(id, category);
      });

      // Double-click on video asset to show full info
      card.addEventListener('dblclick', (e) => {
        if (e.target.closest('.asset-actions')) return; // Ignore clicks on action buttons

        const id = card.dataset.id;
        const category = card.dataset.category;
        const assets = category === 'uploaded' ? this.uploadedAssets : this.generatedAssets;
        const asset = assets.find(a => a.id === id);

        if (asset && asset.type === 'video') {
          this.showAssetDetailDialog(asset, category);
        }
      });

      // Drag start event for video assets
      if (card.draggable) {
        card.addEventListener('dragstart', (e) => {
          const id = card.dataset.id;
          const category = card.dataset.category;
          const assets = category === 'uploaded' ? this.uploadedAssets : this.generatedAssets;
          const asset = assets.find(a => a.id === id);

          if (asset) {
            // Store asset data for the drop handler
            e.dataTransfer.setData('assetDrag', 'true');
            e.dataTransfer.setData('assetId', id);
            e.dataTransfer.setData('assetCategory', category);
            e.dataTransfer.effectAllowed = 'copy';
            card.classList.add('dragging');

            // Trigger callback if set
            if (this.onAssetDrag) {
              this.onAssetDrag(asset, category);
            }
          }
        });

        card.addEventListener('dragend', (e) => {
          card.classList.remove('dragging');
        });
      }
    });

    // Delete buttons
    listContainer.querySelectorAll('.asset-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const category = btn.dataset.category;
        await this.deleteAsset(id, category);
      });
    });

    // Download buttons (for generated assets)
    listContainer.querySelectorAll('.asset-download').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const category = btn.dataset.category;
        this.downloadAsset(id, category);
      });
    });
  }

  /**
   * Select an asset
   */
  selectAsset(id, category) {
    const assets = category === 'uploaded' ? this.uploadedAssets : this.generatedAssets;
    const asset = assets.find(a => a.id === id);

    if (asset && this.onAssetSelect) {
      this.onAssetSelect(asset, category);
    }

    // Visual feedback
    this.container.querySelectorAll('.asset-card').forEach(card => {
      card.classList.remove('selected');
    });
    this.container.querySelector(`[data-id="${id}"]`)?.classList.add('selected');
  }

  /**
   * Delete an asset
   */
  async deleteAsset(id, category) {
    if (!confirm('Delete this asset?')) return;

    const storeName = category === 'uploaded' ? 'uploadedAssets' : 'generatedAssets';

    if (category === 'uploaded') {
      this.uploadedAssets = this.uploadedAssets.filter(a => a.id !== id);
      this.renderUploadedAssets();
    } else {
      this.generatedAssets = this.generatedAssets.filter(a => a.id !== id);
      this.renderGeneratedAssets();
    }

    // Delete from IndexedDB
    await this.dbService.deleteAsset(storeName, id);
  }

  /**
   * Download an asset
   */
  downloadAsset(id, category) {
    const assets = category === 'uploaded' ? this.uploadedAssets : this.generatedAssets;
    const asset = assets.find(a => a.id === id);

    if (!asset || !asset.blob) return;

    const url = URL.createObjectURL(asset.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = asset.name || `asset-${id}.mp4`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Refresh generated assets
   */
  async refreshGeneratedAssets() {
    // This could fetch from an API in the future
    this.renderGeneratedAssets();
  }

  /**
   * Save assets to IndexedDB
   */
  async saveToStorage() {
    try {
      // Save uploaded assets to IndexedDB
      for (const asset of this.uploadedAssets) {
        await this.dbService.saveAsset('uploadedAssets', asset);
      }

      // Save generated assets to IndexedDB
      for (const asset of this.generatedAssets) {
        await this.dbService.saveAsset('generatedAssets', asset);
      }
    } catch (error) {
      console.error('Failed to save assets to IndexedDB:', error);
    }
  }

  /**
   * Load assets from IndexedDB
   */
  async loadAssetsFromStorage() {
    try {
      // Load uploaded assets from IndexedDB
      this.uploadedAssets = await this.dbService.getAllAssets('uploadedAssets');

      // Load generated assets from IndexedDB
      this.generatedAssets = await this.dbService.getAllAssets('generatedAssets');

      // Render both
      this.renderUploadedAssets();
      this.renderGeneratedAssets();
    } catch (error) {
      console.error('Failed to load assets from IndexedDB:', error);
    }
  }

  /**
   * Set callback for asset selection
   */
  setOnAssetSelect(callback) {
    this.onAssetSelect = callback;
  }

  /**
   * Set callback for asset drag
   */
  setOnAssetDrag(callback) {
    this.onAssetDrag = callback;
  }

  /**
   * Get asset by ID and category
   */
  getAsset(id, category) {
    const assets = category === 'uploaded' ? this.uploadedAssets : this.generatedAssets;
    return assets.find(a => a.id === id);
  }

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `asset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all assets
   */
  async clearAll() {
    if (!confirm('Clear all assets? This cannot be undone.')) return;

    this.uploadedAssets = [];
    this.generatedAssets = [];

    // Clear from IndexedDB
    await this.dbService.clearStore('uploadedAssets');
    await this.dbService.clearStore('generatedAssets');

    this.renderUploadedAssets();
    this.renderGeneratedAssets();
  }

  /**
   * Show asset detail dialog with full information and playable video
   */
  showAssetDetailDialog(asset, category) {
    const dialog = document.createElement('div');
    dialog.className = 'asset-detail-dialog';

    const videoUrl = asset.blob ? URL.createObjectURL(asset.blob) : '';
    const date = new Date(asset.uploadedAt || asset.generatedAt).toLocaleString();

    let metadataHTML = '';
    if (category === 'generated') {
      metadataHTML = `
        <div class="asset-detail-section">
          <h4>Metadata</h4>
          <div class="asset-detail-meta">
            <div class="asset-detail-meta-row">
              <span class="label">Provider:</span>
              <span class="value">${asset.provider || 'Unknown'}</span>
            </div>
            ${asset.model ? `
              <div class="asset-detail-meta-row">
                <span class="label">Model:</span>
                <span class="value">${asset.model}</span>
              </div>
            ` : ''}
            ${asset.resolution ? `
              <div class="asset-detail-meta-row">
                <span class="label">Resolution:</span>
                <span class="value">${asset.resolution}</span>
              </div>
            ` : ''}
            ${asset.duration ? `
              <div class="asset-detail-meta-row">
                <span class="label">Duration:</span>
                <span class="value">${asset.duration}</span>
              </div>
            ` : ''}
          </div>
        </div>
        ${asset.prompt ? `
          <div class="asset-detail-section">
            <h4>Prompt</h4>
            <div class="asset-detail-prompt">${asset.prompt}</div>
          </div>
        ` : ''}
      `;
    }

    dialog.innerHTML = `
      <div class="asset-detail-content">
        <div class="asset-detail-header">
          <h3>${asset.name}</h3>
          <button class="asset-detail-close">&times;</button>
        </div>
        <div class="asset-detail-body">
          <div class="asset-detail-section">
            <h4>Video Preview</h4>
            <div class="asset-detail-video">
              <video controls autoplay>
                <source src="${videoUrl}" type="video/mp4">
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
          <div class="asset-detail-section">
            <h4>Information</h4>
            <div class="asset-detail-meta">
              <div class="asset-detail-meta-row">
                <span class="label">Category:</span>
                <span class="value">${category === 'uploaded' ? 'Uploaded' : 'Generated'}</span>
              </div>
              <div class="asset-detail-meta-row">
                <span class="label">Date:</span>
                <span class="value">${date}</span>
              </div>
              ${asset.size ? `
                <div class="asset-detail-meta-row">
                  <span class="label">Size:</span>
                  <span class="value">${this.formatFileSize(asset.size)}</span>
                </div>
              ` : ''}
            </div>
          </div>
          ${metadataHTML}
        </div>
        <div class="asset-detail-footer">
          <button class="btn btn-primary" id="asset-detail-download">Download</button>
          <button class="btn" id="asset-detail-close-btn">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    // Close handlers
    const closeDialog = () => {
      URL.revokeObjectURL(videoUrl);
      document.body.removeChild(dialog);
    };

    dialog.querySelector('.asset-detail-close').addEventListener('click', closeDialog);
    dialog.querySelector('#asset-detail-close-btn').addEventListener('click', closeDialog);
    dialog.addEventListener('click', (e) => {
      if (e.target === dialog) closeDialog();
    });

    // Download handler
    dialog.querySelector('#asset-detail-download').addEventListener('click', () => {
      this.downloadAsset(asset.id, category);
    });

    // ESC key to close
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeDialog();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }
}
