/**
 * VideoStitcherNode - Stitches multiple videos together
 * Takes any number of video inputs and combines them into one output video
 */

import { BaseNode } from './BaseNode.js';

export class VideoStitcherNode extends BaseNode {
  constructor(id, position) {
    super(id, 'VideoStitcher', position);
    this.config = {
      input_count: 2,
      normalize: true,
      target_resolution: 'auto'
    };
    this.stitchedVideo = null; // Store stitched video metadata
    this.stitchedVideoBlob = null; // Store stitched video blob for preview
    this.initialize();
  }

  defineInputs() {
    // Create dynamic inputs based on input count
    const inputs = [];
    for (let i = 0; i < this.config.input_count; i++) {
      inputs.push({
        id: `${this.id}-input-${i}`,
        name: `Video ${i + 1}`,
        type: 'video',
        required: true
      });
    }
    return inputs;
  }

  defineOutputs() {
    return [
      {
        id: `${this.id}-output-0`,
        name: 'Stitched Video',
        type: 'video'
      }
    ];
  }

  getDisplayName() {
    return 'Video Stitcher';
  }

  getIcon() {
    return '🎬';
  }

  getColor() {
    return '#f59e0b'; // Orange
  }

  /**
   * Get config summary for display
   */
  getConfigSummary() {
    let summary = `
      <div class="config-preview">
        <div class="config-section">
          <div class="config-section-title">⚙️ Configuration</div>
          <div class="config-preview-label">Input Videos:</div>
          <div class="config-preview-value">${this.config.input_count}</div>
          <div class="config-preview-label">Normalize:</div>
          <div class="config-preview-value">${this.config.normalize ? 'Yes' : 'No'}</div>
          <div class="config-preview-label">Resolution:</div>
          <div class="config-preview-value">${this.config.target_resolution}</div>
        </div>
    `;

    // Show video preview if available
    if (this.stitchedVideoBlob) {
      const videoUrl = URL.createObjectURL(this.stitchedVideoBlob);
      summary += `
        <div class="config-section config-results-section">
          <div class="config-section-title">🎥 Stitched Video Preview</div>
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

    // Show stitched video info if available
    if (this.stitchedVideo) {
      summary += `
        <div class="config-section">
          <div class="config-section-title">📹 Video Info</div>
          <div class="config-preview-label">Duration:</div>
          <div class="config-preview-value">${this.stitchedVideo.duration?.toFixed(1)}s</div>
          <div class="config-preview-label">Resolution:</div>
          <div class="config-preview-value">${this.stitchedVideo.resolution}</div>
          <div class="config-preview-label">Size:</div>
          <div class="config-preview-value">${this.formatFileSize(this.stitchedVideo.size)}</div>
          <div class="config-preview-label">Input Count:</div>
          <div class="config-preview-value">${this.stitchedVideo.input_count}</div>
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

      const inputCountInput = dialog.querySelector('#input-count');
      const normalizeCheckbox = dialog.querySelector('#normalize');
      const resolutionSelect = dialog.querySelector('#resolution');
      const saveBtn = dialog.querySelector('.btn-save');
      const cancelBtn = dialog.querySelector('.btn-cancel');

      // Set current values
      inputCountInput.value = this.config.input_count || 2;
      normalizeCheckbox.checked = this.config.normalize !== false;
      resolutionSelect.value = this.config.target_resolution || 'auto';

      const close = (save) => {
        if (save) {
          const oldInputCount = this.config.input_count;
          this.config.input_count = parseInt(inputCountInput.value) || 2;
          this.config.normalize = normalizeCheckbox.checked;
          this.config.target_resolution = resolutionSelect.value;

          // If input count changed, rebuild inputs and clean up connections
          if (oldInputCount !== this.config.input_count) {
            this.inputs = this.defineInputs();
            this.updateElement();

            // Trigger port change event so canvas can cleanup invalid connections
            if (this.onPortsChanged) {
              this.onPortsChanged(this);
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
          <h3>🎬 Configure Video Stitcher</h3>
        </div>
        <div class="workflow-config-body">
          <label>
            <span class="workflow-config-label">Number of Input Videos (2-20):</span>
            <input
              type="number"
              id="input-count"
              class="workflow-config-input"
              min="2"
              max="20"
              placeholder="2"
            />
          </label>

          <label class="workflow-config-checkbox-label">
            <input
              type="checkbox"
              id="normalize"
              class="workflow-config-checkbox"
            />
            <span>Normalize videos (recommended for different formats)</span>
          </label>

          <label>
            <span class="workflow-config-label">Target Resolution:</span>
            <select id="resolution" class="workflow-config-select">
              <option value="auto">Auto (from first video)</option>
              <option value="1920x1080">1920x1080 (Full HD)</option>
              <option value="1280x720">1280x720 (HD)</option>
              <option value="720x1280">720x1280 (Vertical HD)</option>
              <option value="1080x1920">1080x1920 (Vertical Full HD)</option>
            </select>
          </label>

          <div class="workflow-config-info">
            <strong>About:</strong> This component stitches multiple videos together in sequence.
            Videos will be played one after another in the order they are connected.
            Normalization ensures all videos have compatible formats.
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
   * Validate configuration
   */
  validate() {
    const errors = [];

    if (!this.config.input_count || this.config.input_count < 2 || this.config.input_count > 20) {
      errors.push('Input count must be between 2 and 20');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Execute the node - calls backend API to stitch videos
   */
  async execute(inputs = {}) {
    // Validate configuration
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`VideoStitcher validation failed: ${validation.errors.join(', ')}`);
    }

    // Collect video inputs (video blobs or job IDs)
    const videoInputs = [];
    for (let i = 0; i < this.config.input_count; i++) {
      const videoKey = `video_${i + 1}`;
      const video = inputs[videoKey];

      if (!video) {
        throw new Error(`Missing video input ${i + 1}`);
      }

      videoInputs.push(video);
    }

    try {
      // Upload videos if they are blobs and get job IDs
      const videoIds = [];

      for (let i = 0; i < videoInputs.length; i++) {
        const video = videoInputs[i];

        // If it's already a job ID (string), use it directly
        if (typeof video === 'string') {
          videoIds.push(video);
        }
        // If it's a video blob, upload it to backend first
        else if (video instanceof Blob) {
          // Upload blob to backend
          const formData = new FormData();
          formData.append('video', video, `video_${i + 1}.mp4`);

          const uploadResponse = await fetch('http://localhost:5001/api/videos/upload', {
            method: 'POST',
            body: formData
          });

          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(errorData.error || `Failed to upload video ${i + 1}: ${uploadResponse.status}`);
          }

          const uploadData = await uploadResponse.json();
          if (!uploadData.success || !uploadData.job_id) {
            throw new Error(`Failed to upload video ${i + 1}: Invalid response`);
          }

          videoIds.push(uploadData.job_id);
        } else if (video.job_id) {
          // If video has a job_id property, use it
          videoIds.push(video.job_id);
        } else {
          throw new Error(`Invalid video input type at position ${i + 1}`);
        }
      }

      // Build request body
      const requestBody = {
        video_ids: videoIds,
        normalize: this.config.normalize
      };

      // Add target resolution if not auto
      if (this.config.target_resolution && this.config.target_resolution !== 'auto') {
        requestBody.target_resolution = this.config.target_resolution;
      }

      // Call backend API to stitch videos
      const response = await fetch('http://localhost:5001/api/videos/stitch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error('Invalid response from video stitcher API');
      }

      // Download the stitched video
      const videoResponse = await fetch(`http://localhost:5001${data.video_url}`);
      if (!videoResponse.ok) {
        throw new Error('Failed to download stitched video');
      }

      const videoBlob = await videoResponse.blob();

      // Store stitched video info and blob for display
      this.stitchedVideo = {
        job_id: data.job_id,
        duration: data.duration,
        size: data.size,
        resolution: data.resolution,
        codec: data.codec,
        input_count: data.input_count,
        video_url: data.video_url
      };
      this.stitchedVideoBlob = videoBlob;

      this.updateConfigDisplay();

      // Return output with video blob and metadata
      return {
        video: videoBlob,
        metadata: {
          job_id: data.job_id,
          duration: data.duration,
          resolution: data.resolution,
          codec: data.codec,
          input_count: data.input_count
        }
      };

    } catch (error) {
      throw new Error(`Failed to stitch videos: ${error.message}`);
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
