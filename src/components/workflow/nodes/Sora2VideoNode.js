/**
 * Sora2VideoNode - Video generation component for workflows
 * Generates videos using OpenAI Sora-2 or Google Veo 3 APIs
 */

import { BaseNode } from './BaseNode.js';

export class Sora2VideoNode extends BaseNode {
  constructor(id, position) {
    super(id, 'Sora2Video', position);
    this.config = {
      provider: 'google', // 'google' or 'openai'
      settings: {
        // Google settings
        model: 'veo-3.0-generate-001',
        aspect_ratio: '16:9',
        // OpenAI settings
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
    return 'Sora2 Video';
  }

  getIcon() {
    return '🎬';
  }

  getColor() {
    return '#2563eb'; // Blue
  }

  /**
   * Get config summary for display
   */
  getConfigSummary() {
    const providerName = this.config.provider === 'google' ? 'Google Veo 3' : 'OpenAI Sora-2';
    const settings = [];

    if (this.config.provider === 'google') {
      const model = this.config.settings.model.includes('fast') ? 'Veo 3.0 Fast' : 'Veo 3.0';
      settings.push(`Model: ${model}`);
      settings.push(`Aspect: ${this.config.settings.aspect_ratio}`);
    } else {
      settings.push(`Duration: ${this.config.settings.seconds}s`);
      settings.push(`Size: ${this.config.settings.size}`);
    }

    let videoPreview = '';
    if (this.videoBlob) {
      const videoUrl = URL.createObjectURL(this.videoBlob);
      videoPreview = `
        <div class="video-preview-container">
          <video class="video-preview" controls>
            <source src="${videoUrl}" type="video/mp4">
          </video>
          <button class="btn-download-video" onclick="this.parentElement.querySelector('video').requestFullscreen()">
            🎬 View Fullscreen
          </button>
        </div>
      `;
    }

    return `
      <div class="config-preview">
        <div class="config-preview-label">Provider:</div>
        <div class="config-preview-value">${providerName}</div>
        <div class="config-preview-details">${settings.join(' • ')}</div>
        ${videoPreview}
      </div>
    `;
  }

  /**
   * Open configuration dialog for video generation settings
   */
  async openConfig() {
    return new Promise((resolve) => {
      const dialog = this.createConfigDialog();
      document.body.appendChild(dialog);

      const providerSelect = dialog.querySelector('#provider');
      const googleSettings = dialog.querySelector('.google-settings');
      const openaiSettings = dialog.querySelector('.openai-settings');
      const saveBtn = dialog.querySelector('.btn-save');
      const cancelBtn = dialog.querySelector('.btn-cancel');

      // Set current values
      providerSelect.value = this.config.provider;
      dialog.querySelector('#google-model').value = this.config.settings.model;
      dialog.querySelector('#google-aspect').value = this.config.settings.aspect_ratio;
      dialog.querySelector('#openai-seconds').value = this.config.settings.seconds;
      dialog.querySelector('#openai-size').value = this.config.settings.size;

      // Show/hide settings based on provider
      const updateProviderSettings = () => {
        if (providerSelect.value === 'google') {
          googleSettings.style.display = 'block';
          openaiSettings.style.display = 'none';
        } else {
          googleSettings.style.display = 'none';
          openaiSettings.style.display = 'block';
        }
      };
      updateProviderSettings();
      providerSelect.addEventListener('change', updateProviderSettings);

      const close = (save) => {
        if (save) {
          this.config.provider = providerSelect.value;
          this.config.settings.model = dialog.querySelector('#google-model').value;
          this.config.settings.aspect_ratio = dialog.querySelector('#google-aspect').value;
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
          <h3>🎬 Configure Sora2 Video Generation</h3>
        </div>
        <div class="workflow-config-body">
          <label>
            <span class="workflow-config-label">Provider:</span>
            <select id="provider" class="workflow-config-select">
              <option value="google">Google Veo 3</option>
              <option value="openai">OpenAI Sora-2</option>
            </select>
          </label>

          <div class="google-settings">
            <label>
              <span class="workflow-config-label">Model:</span>
              <select id="google-model" class="workflow-config-select">
                <option value="veo-3.0-generate-001">Veo 3.0 (High Quality + Audio)</option>
                <option value="veo-3.0-fast-generate-001">Veo 3.0 Fast</option>
              </select>
            </label>
            <label>
              <span class="workflow-config-label">Aspect Ratio:</span>
              <select id="google-aspect" class="workflow-config-select">
                <option value="16:9">16:9 (Widescreen)</option>
                <option value="9:16">9:16 (Portrait)</option>
                <option value="1:1">1:1 (Square)</option>
              </select>
            </label>
          </div>

          <div class="openai-settings">
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
    // Check if provider is valid
    if (!['google', 'openai'].includes(this.config.provider)) {
      return {
        valid: false,
        errors: ['Invalid provider selected']
      };
    }
    return { valid: true, errors: [] };
  }

  /**
   * Execute the node - generates video using Sora2Client
   */
  async execute(inputs = {}, soraClient = null, onProgress = null) {
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`Sora2Video validation failed: ${validation.errors.join(', ')}`);
    }

    // Get prompt from input
    const prompt = inputs.prompt;
    if (!prompt || prompt.trim() === '') {
      throw new Error('Prompt input is required for video generation');
    }

    if (!soraClient) {
      throw new Error('Sora2Client is required for video generation');
    }

    this.status = 'running';
    this.progress = 'Starting video generation...';

    try {
      // Generate video with progress updates
      const result = await soraClient.generateAndDownload(
        prompt,
        (progress) => {
          this.progress = progress.message || progress.stage;
          if (onProgress) {
            onProgress(this, progress);
          }
        },
        {
          provider: this.config.provider,
          settings: this.config.settings
        }
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
}
