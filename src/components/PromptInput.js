/**
 * PromptInput Component
 * Handles prompt input and video generation triggering
 */

export class PromptInput {
  constructor(containerId, onGenerate) {
    this.container = document.getElementById(containerId);
    this.onGenerate = onGenerate;
    this.input = null;
    this.generateBtn = null;
    this.statusElement = null;
    this.isGenerating = false;
  }

  /**
   * Initialize the component
   */
  initialize() {
    this.input = document.getElementById('prompt-input');
    this.generateBtn = document.getElementById('generate-btn');
    this.statusElement = document.getElementById('prompt-status');

    // Add event listener to generate button
    this.generateBtn.addEventListener('click', () => this.handleGenerate());

    // Add Enter key handler (Ctrl+Enter to submit)
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        this.handleGenerate();
      }
    });

    console.log('PromptInput component initialized');
  }

  /**
   * Handle video generation
   */
  async handleGenerate() {
    const prompt = this.input.value.trim();

    if (!prompt) {
      this.showStatus('Please enter a prompt', 'error');
      return;
    }

    if (this.isGenerating) {
      this.showStatus('Generation already in progress...', 'warning');
      return;
    }

    this.isGenerating = true;
    this.generateBtn.disabled = true;
    this.generateBtn.textContent = 'Generating...';

    try {
      // Call the onGenerate callback
      if (this.onGenerate) {
        await this.onGenerate(prompt);
      }
    } catch (error) {
      console.error('Generation error:', error);
      this.showStatus(`Error: ${error.message}`, 'error');
    } finally {
      this.isGenerating = false;
      this.generateBtn.disabled = false;
      this.generateBtn.textContent = 'Generate Video';
    }
  }

  /**
   * Show status message
   * @param {string} message - Status message
   * @param {string} type - Message type (info, success, error, warning)
   */
  showStatus(message, type = 'info') {
    this.statusElement.textContent = message;
    this.statusElement.className = `prompt-status ${type}`;

    // Auto-clear success messages after 5 seconds
    if (type === 'success') {
      setTimeout(() => {
        this.statusElement.textContent = '';
        this.statusElement.className = 'prompt-status';
      }, 5000);
    }
  }

  /**
   * Update generation progress
   * @param {Object} progress - Progress object from Sora2Client
   */
  updateProgress(progress) {
    const { stage, message, status } = progress;

    let displayMessage = message;
    if (status && status.status) {
      displayMessage = `${message} (${status.status})`;
    }

    this.showStatus(displayMessage, 'info');
  }

  /**
   * Clear the input
   */
  clearInput() {
    this.input.value = '';
  }

  /**
   * Get current prompt text
   */
  getPrompt() {
    return this.input.value.trim();
  }

  /**
   * Set prompt text
   */
  setPrompt(text) {
    this.input.value = text;
  }
}
