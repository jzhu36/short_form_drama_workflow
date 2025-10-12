/**
 * TextInputNode - Text input component for workflows
 * Provides a configurable text value as output
 */

import { BaseNode } from './BaseNode.js';

export class TextInputNode extends BaseNode {
  constructor(id, position) {
    super(id, 'TextInput', position);
    this.config = {
      text: ''
    };
    this.initialize();
  }

  defineInputs() {
    // Text input has no inputs
    return [];
  }

  defineOutputs() {
    return [
      {
        id: `${this.id}-output-0`,
        name: 'Text',
        type: 'text'
      }
    ];
  }

  getDisplayName() {
    return 'Text Input';
  }

  getIcon() {
    return '📝';
  }

  getColor() {
    return '#10b981'; // Green
  }

  /**
   * Get config summary for display
   */
  getConfigSummary() {
    if (!this.config.text || this.config.text.trim() === '') {
      return '<div class="config-empty">⚠️ Not configured</div>';
    }

    const preview = this.config.text.length > 50
      ? this.config.text.substring(0, 50) + '...'
      : this.config.text;

    return `
      <div class="config-preview">
        <div class="config-preview-label">Text:</div>
        <div class="config-preview-value">"${preview}"</div>
      </div>
    `;
  }

  /**
   * Open configuration dialog for text input
   */
  async openConfig() {
    return new Promise((resolve) => {
      const dialog = this.createConfigDialog();
      document.body.appendChild(dialog);

      const textarea = dialog.querySelector('textarea');
      const saveBtn = dialog.querySelector('.btn-save');
      const cancelBtn = dialog.querySelector('.btn-cancel');

      textarea.value = this.config.text || '';
      textarea.focus();

      const close = (save) => {
        if (save) {
          this.config.text = textarea.value;
          this.updateConfigDisplay();
        }
        document.body.removeChild(dialog);
        resolve(this.config);
      };

      saveBtn.addEventListener('click', () => close(true));
      cancelBtn.addEventListener('click', () => close(false));

      // Close on Escape
      dialog.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') close(false);
      });

      // Close on backdrop click
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
          <h3>📝 Configure Text Input</h3>
        </div>
        <div class="workflow-config-body">
          <label>
            <span class="workflow-config-label">Text Value:</span>
            <textarea
              class="workflow-config-textarea"
              placeholder="Enter text to pass to connected nodes..."
              rows="6"
            ></textarea>
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
    if (!this.config.text || this.config.text.trim() === '') {
      return {
        valid: false,
        errors: ['Text value is required']
      };
    }
    return { valid: true, errors: [] };
  }

  /**
   * Execute the node - returns the configured text
   */
  async execute(inputs = {}) {
    const validation = this.validate();
    if (!validation.valid) {
      throw new Error(`TextInput validation failed: ${validation.errors.join(', ')}`);
    }

    return {
      text: this.config.text
    };
  }
}
