/**
 * Sora2ImageToVideoNode - Image-to-Video generation component for workflows
 * Generates videos from a reference image using OpenAI Sora-2's camera feature
 */

import { BaseNode } from './BaseNode.js';

export class Sora2ImageToVideoNode extends BaseNode {
  constructor(id, position) {
    super(id, 'Sora2ImageToVideo', position);
    this.config = {
      referenceImage: null, // Image file or blob
      referenceImageUrl: null, // Data URL for preview
      settings: {
        seconds: '8',
        size: '720x1280'
      }
    };
    this.status = 'idle'; // idle, running, completed, error
    this.progress = null;
    this.videoBlob = null; // Store generated video
    this.videoMetadata = null;
    this.initialize();
  }

  defineInputs() {
    return [
      {
        id: `${this.id}-input-0`,
        name: 'Prompt',
        type: 'text',
        required: true
      },
      {
        id: `${this.id}-input-1`,
        name: 'Image (optional)',
        type: 'image',
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
    return 'Sora2 Image-to-Video';
  }

  getIcon() {
    return '📸';
  }

  getColor() {
    return '#7c3aed'; // Purple
  }

  /**
   * Get config summary for display
   */
  getConfigSummary() {
    const settings = [];
    settings.push(`Duration: ${this.config.settings.seconds}s`);
    settings.push(`Size: ${this.config.settings.size}`);

    let imagePreview = '';
    if (this.config.referenceImageUrl) {
      imagePreview = `
        <div class="config-preview-section">
          <div class="config-section-title">Reference Image</div>
          <img src="${this.config.referenceImageUrl}"
               style="width: 100%; max-height: 150px; object-fit: contain; border-radius: 4px; background: #f3f4f6;"
               alt="Reference image" />
        </div>
      `;
    } else {
      imagePreview = `
        <div class="config-empty">⚠️ No reference image uploaded</div>
      `;
    }

    let videoPreview = '';
    if (this.videoBlob) {
      const videoUrl = URL.createObjectURL(this.videoBlob);
      videoPreview = `
        <div class="config-preview-section">
          <div class="config-section-title">Generated Video</div>
          <div class="video-preview-container">
            <video class="video-preview" controls>
              <source src="${videoUrl}" type="video/mp4">
            </video>
            <button class="btn-view-fullscreen" onclick="this.parentElement.querySelector('video').requestFullscreen()">
              🎬 View Fullscreen
            </button>
          </div>
        </div>
      `;
    }

    return `
      <div class="config-preview">
        <div class="config-preview-label">OpenAI Sora-2 Camera Feature</div>
        <div class="config-preview-details">${settings.join(' • ')}</div>
        ${imagePreview}
        ${videoPreview}
      </div>
    `;
  }

  /**
   * Open configuration dialog for image upload and settings
   */
  async openConfig() {
    return new Promise((resolve) => {
      const dialog = this.createConfigDialog();
      document.body.appendChild(dialog);

      const imageInput = dialog.querySelector('#reference-image');
      const imagePreview = dialog.querySelector('#image-preview');
      const uploadBtn = dialog.querySelector('#upload-btn');
      const clearBtn = dialog.querySelector('#clear-btn');
      const saveBtn = dialog.querySelector('.btn-save');
      const cancelBtn = dialog.querySelector('.btn-cancel');

      // Set current values
      dialog.querySelector('#openai-seconds').value = this.config.settings.seconds;
      dialog.querySelector('#openai-size').value = this.config.settings.size;

      // Show current image if exists
      if (this.config.referenceImageUrl) {
        imagePreview.src = this.config.referenceImageUrl;
        imagePreview.style.display = 'block';
        clearBtn.style.display = 'inline-block';
      }

      // Handle upload button
      uploadBtn.addEventListener('click', () => {
        imageInput.click();
      });

      // Handle image selection
      imageInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file && file.type.startsWith('image/')) {
          const reader = new FileReader();
          reader.onload = (event) => {
            imagePreview.src = event.target.result;
            imagePreview.style.display = 'block';
            clearBtn.style.display = 'inline-block';
          };
          reader.readAsDataURL(file);
        }
      });

      // Handle clear button
      clearBtn.addEventListener('click', () => {
        imageInput.value = '';
        imagePreview.src = '';
        imagePreview.style.display = 'none';
        clearBtn.style.display = 'none';
      });

      const close = (save) => {
        if (save) {
          // Save reference image
          if (imageInput.files[0]) {
            this.config.referenceImage = imageInput.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
              this.config.referenceImageUrl = event.target.result;
              this.updateConfigDisplay();
            };
            reader.readAsDataURL(imageInput.files[0]);
          } else if (!imagePreview.src) {
            // Image was cleared
            this.config.referenceImage = null;
            this.config.referenceImageUrl = null;
          }

          this.config.settings.seconds = dialog.querySelector('#openai-seconds').value;
          this.config.settings.size = dialog.querySelector('#openai-size').value;
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
          <h3>📸 Configure Sora2 Image-to-Video</h3>
        </div>
        <div class="workflow-config-body">
          <div style="margin-bottom: 1rem;">
            <span class="workflow-config-label">Reference Image (Character/Object):</span>
            <div style="margin-top: 0.5rem; display: flex; gap: 0.5rem; align-items: center;">
              <input type="file" id="reference-image" accept="image/*" style="display: none;" />
              <button type="button" id="upload-btn" class="btn btn-primary" style="flex-shrink: 0;">
                📤 Upload Image
              </button>
              <button type="button" id="clear-btn" class="btn btn-cancel" style="display: none; flex-shrink: 0;">
                ✕ Clear
              </button>
            </div>
            <img id="image-preview" style="display: none; width: 100%; max-height: 200px; object-fit: contain; margin-top: 0.75rem; border-radius: 4px; border: 1px solid #e5e7eb; background: #f9fafb;" />
            <div style="margin-top: 0.5rem; font-size: 0.75rem; color: #6b7280;">
              Upload a photo of a character, person, or object that Sora will use as a reference in the generated video.
            </div>
          </div>

          <label>
            <span class="workflow-config-label">Duration:</span>
            <select id="openai-seconds" class="workflow-config-select">
              <option value="4">4 seconds</option>
              <option value="8">8 seconds</option>
              <option value="12">12 seconds</option>
            </select>
          </label>

          <label>
            <span class="workflow-config-label">Size:</span>
            <select id="openai-size" class="workflow-config-select">
              <option value="720x1280">720x1280 (Vertical)</option>
              <option value="1280x720">1280x720 (Horizontal)</option>
              <option value="1024x1792">1024x1792 (Tall)</option>
              <option value="1792x1024">1792x1024 (Wide)</option>
            </select>
          </label>
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
    // Reference image is optional - Sora can work with just prompts too
    return { valid: true, errors: [] };
  }

  /**
   * Execute the node - generates video from image using Sora2
   */
  async execute(inputs = {}, soraClient = null, onProgress = null) {
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`Sora2ImageToVideo validation failed: ${validation.errors.join(', ')}`);
    }

    // Get prompt from input
    const prompt = inputs.prompt;
    if (!prompt || prompt.trim() === '') {
      throw new Error('Prompt input is required for video generation');
    }

    // Get image input (if provided via connection)
    const inputImage = inputs.image;

    if (!soraClient) {
      throw new Error('Sora2Client is required for video generation');
    }

    this.status = 'running';
    this.progress = 'Starting image-to-video generation...';

    try {
      // Prepare generation options
      const options = {
        provider: 'openai', // Only OpenAI Sora supports image-to-video
        settings: this.config.settings
      };

      // Add reference image if available
      if (inputImage) {
        options.referenceImage = inputImage;
      } else if (this.config.referenceImage) {
        options.referenceImage = this.config.referenceImage;
      }

      // Generate video with progress updates
      const result = await soraClient.generateAndDownload(
        prompt,
        (progress) => {
          this.progress = progress.message || progress.stage;
          if (onProgress) {
            onProgress(this, progress);
          }
        },
        options
      );

      this.status = 'completed';
      this.progress = 'Video generated successfully!';
      this.videoBlob = result.videoBlob;
      this.videoMetadata = result.metadata;
      this.updateConfigDisplay();

      return {
        video: result.videoBlob,
        metadata: result.metadata
      };
    } catch (error) {
      this.status = 'error';
      this.progress = `Error: ${error.message}`;
      throw error;
    }
  }

  /**
   * Update node visual to show execution status
   */
  updateStatusDisplay() {
    if (!this.element) return;

    const body = this.element.querySelector('.workflow-node-body');
    let statusDiv = body.querySelector('.workflow-node-status');

    if (!statusDiv) {
      statusDiv = document.createElement('div');
      statusDiv.className = 'workflow-node-status';
      body.appendChild(statusDiv);
    }

    if (this.status === 'idle') {
      statusDiv.style.display = 'none';
    } else {
      statusDiv.style.display = 'block';
      statusDiv.className = `workflow-node-status status-${this.status}`;
      statusDiv.textContent = this.progress || this.status;
    }
  }

  /**
   * Serialize node to JSON
   */
  toJSON() {
    const json = super.toJSON();
    // Don't serialize the actual image blob, just the URL
    json.config = {
      ...this.config,
      referenceImage: null, // Don't serialize blob
      referenceImageUrl: this.config.referenceImageUrl
    };
    return json;
  }

  /**
   * Deserialize node from JSON
   */
  fromJSON(data) {
    super.fromJSON(data);
    // Image URLs will be restored, but actual blobs need to be re-uploaded
    if (data.config) {
      this.config = {
        ...this.config,
        ...data.config,
        referenceImage: null // Blobs can't be serialized
      };
    }
  }
}
