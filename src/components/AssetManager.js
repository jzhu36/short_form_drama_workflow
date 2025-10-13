/**
 * AssetManager Component
 * Manages uploaded and generated assets (images and videos)
 */

export class AssetManager {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = null;
    this.uploadedAssets = [];
    this.generatedAssets = [];
    this.onAssetSelect = null;
  }

  /**
   * Initialize the component
   */
  initialize() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      throw new Error(`Container #${this.containerId} not found`);
    }

    this.render();
    this.attachEventListeners();
    this.loadAssetsFromStorage();
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
    for (const file of files) {
      if (!this.isValidFile(file)) {
        alert(`Invalid file type: ${file.name}. Only images and videos are supported.`);
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

      this.uploadedAssets.push(asset);
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
        <div class="asset-card" data-id="${asset.id}" data-category="${category}">
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
        <div class="asset-card" data-id="${asset.id}" data-category="${category}">
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

    if (category === 'uploaded') {
      this.uploadedAssets = this.uploadedAssets.filter(a => a.id !== id);
      this.renderUploadedAssets();
    } else {
      this.generatedAssets = this.generatedAssets.filter(a => a.id !== id);
      this.renderGeneratedAssets();
    }

    await this.saveToStorage();
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
   * Save assets to localStorage
   */
  async saveToStorage() {
    try {
      // Store metadata only (blobs can't be stored in localStorage)
      const uploadedMeta = this.uploadedAssets.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        size: a.size,
        uploadedAt: a.uploadedAt
      }));

      const generatedMeta = this.generatedAssets.map(a => ({
        id: a.id,
        name: a.name,
        type: a.type,
        generatedAt: a.generatedAt,
        prompt: a.prompt,
        provider: a.provider,
        model: a.model,
        resolution: a.resolution,
        duration: a.duration
      }));

      localStorage.setItem('uploadedAssetsMeta', JSON.stringify(uploadedMeta));
      localStorage.setItem('generatedAssetsMeta', JSON.stringify(generatedMeta));
    } catch (error) {
      console.error('Failed to save assets to storage:', error);
    }
  }

  /**
   * Load assets from localStorage
   */
  async loadAssetsFromStorage() {
    try {
      const uploadedMeta = JSON.parse(localStorage.getItem('uploadedAssetsMeta') || '[]');
      const generatedMeta = JSON.parse(localStorage.getItem('generatedAssetsMeta') || '[]');

      // Note: We can't restore the actual blobs from localStorage
      // In a production app, you'd use IndexedDB or fetch from a server

      this.renderUploadedAssets();
      this.renderGeneratedAssets();
    } catch (error) {
      console.error('Failed to load assets from storage:', error);
    }
  }

  /**
   * Set callback for asset selection
   */
  setOnAssetSelect(callback) {
    this.onAssetSelect = callback;
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
  clearAll() {
    if (!confirm('Clear all assets? This cannot be undone.')) return;

    this.uploadedAssets = [];
    this.generatedAssets = [];
    this.saveToStorage();
    this.renderUploadedAssets();
    this.renderGeneratedAssets();
  }
}
