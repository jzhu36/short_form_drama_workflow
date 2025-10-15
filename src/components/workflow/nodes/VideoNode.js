/**
 * VideoNode - Pass-through video node or load from file path
 * Can accept video input and pass it through, or load from configured file path
 */

import { BaseNode } from './BaseNode.js';

export class VideoNode extends BaseNode {
  constructor(id, position) {
    super(id, 'Video', position);
    this.config = {
      video_path: '',  // Path to video file (job ID or filename)
      video_name: ''   // Display name for the video
    };
    this.videoMetadata = null;  // Store video metadata if loaded
    this.videoBlob = null;       // Store video blob for preview
    this.validationError = null; // Store validation error message
    this.initialize();
  }

  defineInputs() {
    return [
      {
        id: `${this.id}-input-0`,
        name: 'Video (optional)',
        type: 'video',
        required: false
      }
    ];
  }

  defineOutputs() {
    return [
      {
        id: `${this.id}-output-0`,
        name: 'Video',
        type: 'video'
      }
    ];
  }

  getDisplayName() {
    if (this.config.video_name) {
      return `Video: ${this.config.video_name}`;
    }
    return 'Video';
  }

  getIcon() {
    return '🎥';
  }

  getColor() {
    return '#059669'; // Green
  }

  /**
   * Get config summary for display
   */
  getConfigSummary() {
    let summary = `
      <div class="config-preview">
        <div class="config-section">
          <div class="config-section-title">⚙️ Configuration</div>
    `;

    if (this.config.video_path) {
      summary += `
          <div class="config-preview-label">Video Source:</div>
          <div class="config-preview-value">${this.config.video_name || 'File'}</div>
          <div class="config-preview-label">Path:</div>
          <div class="config-preview-value" style="font-size: 0.7rem; word-break: break-all;">${this.config.video_path}</div>
      `;
    } else {
      summary += `
          <div class="config-preview-label">Mode:</div>
          <div class="config-preview-value">Pass-through (from input)</div>
      `;
    }

    summary += `
        </div>
    `;

    // Show validation error if present
    if (this.validationError) {
      summary += `
        <div class="config-section config-error-section">
          <div class="config-section-title">⚠️ Error</div>
          <div class="config-error-message">${this.validationError}</div>
        </div>
      `;
    }

    // Show video preview if available
    if (this.videoBlob) {
      const videoUrl = URL.createObjectURL(this.videoBlob);
      summary += `
        <div class="config-section config-results-section">
          <div class="config-section-title">🎥 Video Preview</div>
          <div class="video-preview-container">
            <video class="video-preview" controls>
              <source src="${videoUrl}" type="video/mp4">
            </video>
            <button class="btn-view-fullscreen" data-video-url="${videoUrl}">
              🎬 View Fullscreen
            </button>
          </div>
        </div>
      `;
    }

    // Show video metadata if available
    if (this.videoMetadata) {
      summary += `
        <div class="config-section">
          <div class="config-section-title">📹 Video Info</div>
          <div class="config-preview-label">Duration:</div>
          <div class="config-preview-value">${this.videoMetadata.duration?.toFixed(1)}s</div>
          <div class="config-preview-label">Resolution:</div>
          <div class="config-preview-value">${this.videoMetadata.resolution}</div>
          <div class="config-preview-label">Size:</div>
          <div class="config-preview-value">${this.formatFileSize(this.videoMetadata.size)}</div>
        </div>
      `;
    }

    summary += `</div>`;
    return summary;
  }

  /**
   * Override updateConfigDisplay to attach fullscreen button handler
   */
  updateConfigDisplay() {
    super.updateConfigDisplay();

    // Attach click handler to fullscreen button
    setTimeout(() => {
      if (this.element) {
        const fullscreenBtn = this.element.querySelector('.btn-view-fullscreen');
        if (fullscreenBtn) {
          fullscreenBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const video = this.element.querySelector('.video-preview');
            if (video && video.requestFullscreen) {
              video.requestFullscreen();
            }
          });
        }
      }
    }, 0);
  }

  /**
   * Open configuration dialog
   */
  async openConfig() {
    return new Promise((resolve) => {
      const dialog = this.createConfigDialog();
      document.body.appendChild(dialog);

      const videoPathInput = dialog.querySelector('#video-path');
      const videoNameInput = dialog.querySelector('#video-name');
      const browseBtn = dialog.querySelector('.btn-browse');
      const clearBtn = dialog.querySelector('.btn-clear');
      const saveBtn = dialog.querySelector('.btn-save');
      const cancelBtn = dialog.querySelector('.btn-cancel');

      // Set current values
      videoPathInput.value = this.config.video_path || '';
      videoNameInput.value = this.config.video_name || '';

      // Browse button - show available videos
      browseBtn.addEventListener('click', async () => {
        try {
          // Fetch available videos from backend
          const response = await fetch('http://localhost:5001/api/videos/list');
          if (response.ok) {
            const data = await response.json();
            const videos = data.jobs.filter(job => job.status === 'completed');

            if (videos.length === 0) {
              alert('No videos available. Generate some videos first!');
              return;
            }

            // Show video selection dialog
            const selectedVideo = await this.showVideoSelectionDialog(videos);
            if (selectedVideo) {
              videoPathInput.value = selectedVideo.id;
              videoNameInput.value = selectedVideo.prompt.substring(0, 50) + '...';
            }
          }
        } catch (error) {
          console.error('Failed to fetch videos:', error);
          alert('Failed to load videos. Make sure the backend is running.');
        }
      });

      // Clear button
      clearBtn.addEventListener('click', () => {
        videoPathInput.value = '';
        videoNameInput.value = '';
      });

      const close = async (save) => {
        if (save) {
          const newPath = videoPathInput.value.trim();
          const newName = videoNameInput.value.trim();

          // If path changed, validate and load video
          if (newPath && newPath !== this.config.video_path) {
            // Disable save button and show loading
            saveBtn.disabled = true;
            saveBtn.textContent = 'Loading...';

            try {
              await this.loadAndValidateVideo(newPath);
              this.config.video_path = newPath;
              this.config.video_name = newName;
              this.validationError = null;
            } catch (error) {
              this.validationError = error.message;
              this.videoBlob = null;
              this.videoMetadata = null;
              // Still save the config so user can see the error
              this.config.video_path = newPath;
              this.config.video_name = newName;
            }
          } else {
            // Path didn't change or is empty
            this.config.video_path = newPath;
            this.config.video_name = newName;
            if (!newPath) {
              // Cleared the path
              this.videoBlob = null;
              this.videoMetadata = null;
              this.validationError = null;
            }
          }

          this.updateConfigDisplay();
        }
        document.body.removeChild(dialog);
        resolve(this.config);
      };

      saveBtn.addEventListener('click', () => close(true));
      cancelBtn.addEventListener('click', () => close(false));

      dialog.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close(false);
      });

      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) close(false);
      });
    });
  }

  createConfigDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'workflow-config-dialog';
    dialog.innerHTML = `
      <div class="workflow-config-content">
        <div class="workflow-config-header">
          <h3>🎥 Configure Video Node</h3>
        </div>
        <div class="workflow-config-body">
          <label>
            <span class="workflow-config-label">Video Name (optional):</span>
            <input
              type="text"
              id="video-name"
              class="workflow-config-input"
              placeholder="Display name for this video"
            />
          </label>

          <label>
            <span class="workflow-config-label">Video Path (Job ID or filename):</span>
            <div style="display: flex; gap: 0.5rem;">
              <input
                type="text"
                id="video-path"
                class="workflow-config-input"
                placeholder="Leave empty to use input connection"
                style="flex: 1;"
              />
              <button class="btn btn-browse" type="button">Browse</button>
              <button class="btn btn-clear" type="button">Clear</button>
            </div>
          </label>

          <div class="workflow-config-info">
            <strong>About:</strong> This component passes video through from input to output.
            If no input is connected, it will use the video specified by the path above.
            You can drag videos from the Assets panel directly onto the canvas to create a Video node.
          </div>
        </div>
        <div class="workflow-config-footer">
          <button class="btn btn-cancel">Cancel</button>
          <button class="btn btn-primary btn-save">Save</button>
        </div>
      </div>
    `;
    return dialog;
  }

  /**
   * Show video selection dialog
   */
  async showVideoSelectionDialog(videos) {
    return new Promise((resolve) => {
      const dialog = document.createElement('div');
      dialog.className = 'workflow-config-dialog';
      dialog.innerHTML = `
        <div class="workflow-config-content" style="max-width: 700px;">
          <div class="workflow-config-header">
            <h3>Select Video</h3>
          </div>
          <div class="workflow-config-body" style="max-height: 500px; overflow-y: auto;">
            <div class="video-list">
              ${videos.map(video => `
                <div class="video-item" data-video-id="${video.id}">
                  <div class="video-item-icon">🎬</div>
                  <div class="video-item-info">
                    <div class="video-item-prompt">${video.prompt.substring(0, 100)}...</div>
                    <div class="video-item-meta">
                      <span>Provider: ${video.provider}</span> |
                      <span>Created: ${new Date(video.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
          <div class="workflow-config-footer">
            <button class="btn btn-cancel">Cancel</button>
          </div>
        </div>
      `;

      document.body.appendChild(dialog);

      // Add click handlers to video items
      const videoItems = dialog.querySelectorAll('.video-item');
      videoItems.forEach(item => {
        item.addEventListener('click', () => {
          const videoId = item.dataset.videoId;
          const video = videos.find(v => v.id === videoId);
          document.body.removeChild(dialog);
          resolve(video);
        });
      });

      // Cancel button
      const cancelBtn = dialog.querySelector('.btn-cancel');
      cancelBtn.addEventListener('click', () => {
        document.body.removeChild(dialog);
        resolve(null);
      });

      // ESC key and backdrop click
      dialog.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          document.body.removeChild(dialog);
          resolve(null);
        }
      });

      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) {
          document.body.removeChild(dialog);
          resolve(null);
        }
      });
    });
  }

  /**
   * Load and validate video from path
   */
  async loadAndValidateVideo(videoPath) {
    if (!videoPath) {
      throw new Error('Video path is empty');
    }

    try {
      // Try to download video from backend using job ID or filename
      const videoUrl = `http://localhost:5001/api/videos/${videoPath}/download`;
      const response = await fetch(videoUrl);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Video not found: "${videoPath}". Please check the path or job ID.`);
        } else if (response.status === 400) {
          throw new Error(`Invalid video path: "${videoPath}"`);
        } else {
          throw new Error(`Failed to load video (status ${response.status})`);
        }
      }

      const videoBlob = await response.blob();

      // Validate it's actually a video
      if (!videoBlob.type.startsWith('video/')) {
        throw new Error(`Invalid video file: expected video format, got ${videoBlob.type}`);
      }

      // Store video blob for preview
      this.videoBlob = videoBlob;

      // Try to get metadata from status endpoint
      try {
        const statusResponse = await fetch(`http://localhost:5001/api/videos/${videoPath}/status`);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          this.videoMetadata = {
            duration: 0,  // Not available from status
            resolution: 'Unknown',
            size: videoBlob.size,
            provider: statusData.provider,
            prompt: statusData.prompt
          };
        }
      } catch (e) {
        // Metadata fetch failed, continue without it
        console.warn('Failed to fetch video metadata:', e);
        this.videoMetadata = {
          duration: 0,
          resolution: 'Unknown',
          size: videoBlob.size
        };
      }

      return true;

    } catch (error) {
      // Re-throw with more context
      if (error.message.includes('Failed to fetch')) {
        throw new Error('Cannot connect to video service. Make sure the backend is running.');
      }
      throw error;
    }
  }

  /**
   * Validate configuration
   */
  validate() {
    // Video node is always valid - it either passes through input or uses configured path
    return {
      valid: true,
      errors: []
    };
  }

  /**
   * Execute the node - pass through video or load from path
   */
  async execute(inputs = {}) {
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`Video validation failed: ${validation.errors.join(', ')}`);
    }

    // If there's an input video, pass it through
    if (inputs.video) {
      return {
        video: inputs.video,
        metadata: inputs.metadata || {}
      };
    }

    // Check if we have a pre-loaded blob from asset drag-and-drop
    if (this.videoBlob) {
      return {
        video: this.videoBlob,
        metadata: this.videoMetadata || {}
      };
    }

    // If no input and no pre-loaded blob, check if we have a configured path
    if (!this.config.video_path) {
      throw new Error('No input video and no video path configured');
    }

    try {
      // Download video from backend using job ID or filename
      const videoUrl = `http://localhost:5001/api/videos/${this.config.video_path}/download`;
      const response = await fetch(videoUrl);

      if (!response.ok) {
        throw new Error(`Failed to load video: ${response.status}`);
      }

      const videoBlob = await response.blob();

      // Try to get metadata from status endpoint
      let metadata = {};
      try {
        const statusResponse = await fetch(`http://localhost:5001/api/videos/${this.config.video_path}/status`);
        if (statusResponse.ok) {
          const statusData = await statusResponse.json();
          metadata = {
            job_id: statusData.id,
            provider: statusData.provider,
            prompt: statusData.prompt
          };

          // Store metadata for display
          this.videoMetadata = {
            duration: 0,  // Not available from status
            resolution: 'Unknown',
            size: videoBlob.size
          };
          this.updateConfigDisplay();
        }
      } catch (e) {
        // Metadata fetch failed, continue without it
        console.warn('Failed to fetch video metadata:', e);
      }

      return {
        video: videoBlob,
        metadata: metadata
      };

    } catch (error) {
      throw new Error(`Failed to load video from path: ${error.message}`);
    }
  }

  /**
   * Format file size for display
   */
  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }
}
