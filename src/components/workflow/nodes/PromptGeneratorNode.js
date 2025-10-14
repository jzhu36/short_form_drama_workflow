/**
 * PromptGeneratorNode - Episode prompt generator for short form drama
 * Generates multiple episode prompts from a story outline using GPT
 */

import { BaseNode } from './BaseNode.js';

export class PromptGeneratorNode extends BaseNode {
  constructor(id, position) {
    super(id, 'PromptGenerator', position);
    this.config = {
      episode_count: 5
    };
    this.generatedPrompts = null; // Store generated prompts for display
    this.initialize();
  }

  defineInputs() {
    return [
      {
        id: `${this.id}-input-0`,
        name: 'Outline',
        type: 'text',
        required: true
      }
    ];
  }

  defineOutputs() {
    // Create dynamic outputs based on episode count
    const outputs = [];
    for (let i = 0; i < this.config.episode_count; i++) {
      outputs.push({
        id: `${this.id}-output-${i}`,
        name: `Episode ${i + 1}`,
        type: 'text'
      });
    }
    return outputs;
  }

  getDisplayName() {
    return 'Prompt Generator';
  }

  getIcon() {
    return '✨';
  }

  getColor() {
    return '#8b5cf6'; // Purple
  }

  /**
   * Get config summary for display
   */
  getConfigSummary() {
    let summary = `
      <div class="config-preview">
        <div class="config-section">
          <div class="config-section-title">⚙️ Configuration</div>
          <div class="config-preview-label">Episodes:</div>
          <div class="config-preview-value">${this.config.episode_count}</div>
        </div>
    `;

    // Show generated prompts in separate section if available
    if (this.generatedPrompts && this.generatedPrompts.length > 0) {
      summary += `
        <div class="config-section config-results-section">
          <div class="config-section-title">✅ Generated Prompts (${this.generatedPrompts.length})</div>
          <div class="config-preview-prompts">
      `;
      this.generatedPrompts.forEach((prompt, idx) => {
        const shortPrompt = prompt.length > 60 ? prompt.substring(0, 60) + '...' : prompt;
        summary += `
          <div class="config-preview-prompt-item clickable-prompt" data-prompt-index="${idx}" title="Click to view full prompt">
            <strong>Episode ${idx + 1}:</strong> ${shortPrompt}
          </div>
        `;
      });
      summary += `</div></div>`;
    }

    summary += `</div>`;
    return summary;
  }

  /**
   * Attach event listeners for clickable prompts (called after updating display)
   */
  attachPromptClickHandlers() {
    if (!this.element) return;

    const promptItems = this.element.querySelectorAll('.clickable-prompt');
    promptItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const promptIndex = parseInt(item.dataset.promptIndex);
        if (this.generatedPrompts && this.generatedPrompts[promptIndex]) {
          this.showFullPromptModal(promptIndex);
        }
      });
    });
  }

  /**
   * Show full prompt in a modal dialog
   */
  showFullPromptModal(promptIndex) {
    const prompt = this.generatedPrompts[promptIndex];
    const modal = document.createElement('div');
    modal.className = 'prompt-modal-overlay';
    modal.innerHTML = `
      <div class="prompt-modal-content">
        <div class="prompt-modal-header">
          <h3>Episode ${promptIndex + 1} - Full Prompt</h3>
          <button class="prompt-modal-close" title="Close">✕</button>
        </div>
        <div class="prompt-modal-body">
          <div class="prompt-full-text">${prompt}</div>
        </div>
        <div class="prompt-modal-footer">
          <button class="btn btn-primary prompt-modal-ok">OK</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close handlers
    const closeModal = () => {
      document.body.removeChild(modal);
    };

    const closeBtn = modal.querySelector('.prompt-modal-close');
    const okBtn = modal.querySelector('.prompt-modal-ok');

    closeBtn.addEventListener('click', closeModal);
    okBtn.addEventListener('click', closeModal);

    // Close on overlay click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Close on ESC key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  /**
   * Override updateConfigDisplay to attach click handlers after update
   */
  updateConfigDisplay() {
    super.updateConfigDisplay();
    // Attach click handlers after the DOM is updated
    setTimeout(() => {
      this.attachPromptClickHandlers();
    }, 0);
  }

  /**
   * Open configuration dialog
   */
  async openConfig() {
    return new Promise((resolve) => {
      const dialog = this.createConfigDialog();
      document.body.appendChild(dialog);

      const episodeCountInput = dialog.querySelector('#episode-count');
      const saveBtn = dialog.querySelector('.btn-save');
      const cancelBtn = dialog.querySelector('.btn-cancel');

      episodeCountInput.value = this.config.episode_count || 5;

      const close = (save) => {
        if (save) {
          const oldEpisodeCount = this.config.episode_count;
          this.config.episode_count = parseInt(episodeCountInput.value) || 5;

          // If episode count changed, rebuild outputs
          if (oldEpisodeCount !== this.config.episode_count) {
            this.outputs = this.defineOutputs();
            this.updateElement();
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
          <h3>✨ Configure Prompt Generator</h3>
        </div>
        <div class="workflow-config-body">
          <label>
            <span class="workflow-config-label">Episode Count (1-50):</span>
            <input
              type="number"
              id="episode-count"
              class="workflow-config-input"
              min="1"
              max="50"
              placeholder="5"
            />
          </label>
          <div class="workflow-config-info">
            <strong>About:</strong> This component generates episode prompts for short form drama using GPT.
            Provide a story outline as input, and it will generate detailed prompts for each episode.
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

    if (!this.config.episode_count || this.config.episode_count < 1 || this.config.episode_count > 50) {
      errors.push('Episode count must be between 1 and 50');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Execute the node - calls backend API to generate prompts
   */
  async execute(inputs = {}) {
    // Validate configuration
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`PromptGenerator validation failed: ${validation.errors.join(', ')}`);
    }

    // Check outline input
    const outline = inputs.outline || inputs.text || '';
    if (!outline || outline.trim() === '') {
      throw new Error('Story outline is required');
    }

    try {
      // Call backend API to generate episode prompts
      const response = await fetch('http://localhost:5001/api/prompts/generate-episodes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          outline: outline,
          episode_count: this.config.episode_count
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.prompts || !Array.isArray(data.prompts)) {
        throw new Error('Invalid response from prompt generation API');
      }

      // Store generated prompts for display
      this.generatedPrompts = data.prompts;
      this.updateConfigDisplay();

      // Build output object with episode prompts
      const outputs = {};
      data.prompts.forEach((prompt, index) => {
        outputs[`episode_${index + 1}`] = prompt;
      });

      return outputs;

    } catch (error) {
      throw new Error(`Failed to generate prompts: ${error.message}`);
    }
  }
}
