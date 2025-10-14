/**
 * WorkflowBuilder - Main container component for workflow builder
 * Integrates canvas, palette, and execution engine
 */

import { WorkflowCanvas } from './WorkflowCanvas.js';
import { ComponentPalette } from './ComponentPalette.js';
import { WorkflowEngine } from './WorkflowEngine.js';

export class WorkflowBuilder {
  constructor(containerId, soraClient, assetManager = null) {
    this.containerId = containerId;
    this.soraClient = soraClient;
    this.assetManager = assetManager;
    this.container = null;

    this.canvas = null;
    this.palette = null;
    this.engine = null;

    this.isExecuting = false;
  }

  /**
   * Initialize the workflow builder
   */
  initialize() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      throw new Error(`Container #${this.containerId} not found`);
    }

    this.render();
    this.initializeComponents();
  }

  /**
   * Render the main HTML structure
   */
  render() {
    this.container.innerHTML = `
      <div class="workflow-builder">
        <div class="workflow-builder-toolbar">
          <div class="workflow-builder-toolbar-left">
            <button class="btn btn-small" id="workflow-clear">
              Clear
            </button>
            <button class="btn btn-small" id="workflow-save">
              Save
            </button>
            <button class="btn btn-small" id="workflow-load">
              Load
            </button>
          </div>
          <div class="workflow-builder-toolbar-center">
            <h2>Workflow Builder</h2>
          </div>
          <div class="workflow-builder-toolbar-right">
            <button class="btn btn-primary" id="workflow-run">
              ▶ Run Workflow
            </button>
          </div>
        </div>

        <div class="workflow-builder-content">
          <div class="workflow-builder-sidebar" id="workflow-palette"></div>
          <div class="workflow-builder-main" id="workflow-canvas"></div>
        </div>

        <div class="workflow-builder-status" id="workflow-status">
          <div class="workflow-status-content">
            <div class="workflow-status-message">Ready</div>
          </div>
        </div>
      </div>
    `;

    this.attachToolbarListeners();
  }

  /**
   * Initialize child components
   */
  initializeComponents() {
    // Initialize canvas
    this.canvas = new WorkflowCanvas('workflow-canvas');
    this.canvas.initialize();

    // Initialize palette
    this.palette = new ComponentPalette('workflow-palette', this.canvas);
    this.palette.initialize();

    // Initialize engine
    this.engine = new WorkflowEngine(this.canvas);
  }

  /**
   * Attach toolbar event listeners
   */
  attachToolbarListeners() {
    const runBtn = this.container.querySelector('#workflow-run');
    const clearBtn = this.container.querySelector('#workflow-clear');
    const saveBtn = this.container.querySelector('#workflow-save');
    const loadBtn = this.container.querySelector('#workflow-load');

    runBtn.addEventListener('click', () => this.runWorkflow());
    clearBtn.addEventListener('click', () => this.clearWorkflow());
    saveBtn.addEventListener('click', () => this.saveWorkflow());
    loadBtn.addEventListener('click', () => this.loadWorkflow());
  }

  /**
   * Run the workflow
   */
  async runWorkflow() {
    if (this.isExecuting) {
      alert('Workflow is already executing!');
      return;
    }

    // Validate workflow
    const validation = this.engine.validateWorkflow();
    if (!validation.valid) {
      alert(`Workflow validation failed:\n\n${validation.errors.join('\n')}`);
      return;
    }

    this.isExecuting = true;
    this.updateStatus('info', 'Executing workflow...');

    const runBtn = this.container.querySelector('#workflow-run');
    runBtn.disabled = true;
    runBtn.textContent = '⏳ Running...';

    try {
      const results = await this.engine.execute(this.soraClient, (progress) => {
        this.updateStatus(progress.type, progress.message);
      });

      this.updateStatus('success', 'Workflow completed successfully!');

      // Add ALL video results to asset manager
      if (this.assetManager) {
        const allVideoOutputs = Array.from(this.engine.executionResults.values())
          .filter(output => output.video);

        if (allVideoOutputs.length > 0) {
          for (const videoOutput of allVideoOutputs) {
            await this.assetManager.addGeneratedAsset(videoOutput.video, {
              prompt: videoOutput.metadata?.prompt || '',
              provider: videoOutput.metadata?.provider || 'Unknown',
              model: videoOutput.metadata?.model || '',
              resolution: videoOutput.metadata?.resolution || videoOutput.metadata?.size || '',
              duration: videoOutput.metadata?.duration || '',
              generatedAt: new Date().toISOString()
            });
          }
          this.updateStatus('success', `${allVideoOutputs.length} video(s) added to Asset Manager!`);
        }
      }

      // Show results summary
      setTimeout(() => {
        const videoCount = Array.from(this.engine.executionResults.values())
          .filter(output => output.video).length;
        alert(`Workflow completed!\n\nGenerated ${videoCount} video(s).`);
      }, 500);

    } catch (error) {
      this.updateStatus('error', `Execution failed: ${error.message}`);
      alert(`Workflow execution failed:\n\n${error.message}`);
    } finally {
      this.isExecuting = false;
      runBtn.disabled = false;
      runBtn.textContent = '▶ Run Workflow';
    }
  }

  /**
   * Clear the workflow
   */
  clearWorkflow() {
    if (confirm('Clear the entire workflow? This cannot be undone.')) {
      this.canvas.clear();
      this.updateStatus('info', 'Workflow cleared');
    }
  }

  /**
   * Save workflow to localStorage
   */
  saveWorkflow() {
    try {
      const workflowData = this.canvas.toJSON();
      const workflowName = prompt('Enter workflow name:', 'My Workflow');

      if (!workflowName) return;

      const savedWorkflows = JSON.parse(localStorage.getItem('workflows') || '{}');
      savedWorkflows[workflowName] = {
        ...workflowData,
        name: workflowName,
        savedAt: new Date().toISOString()
      };

      localStorage.setItem('workflows', JSON.stringify(savedWorkflows));
      this.updateStatus('success', `Workflow "${workflowName}" saved!`);
    } catch (error) {
      alert(`Failed to save workflow: ${error.message}`);
      this.updateStatus('error', 'Failed to save workflow');
    }
  }

  /**
   * Load workflow from localStorage
   */
  loadWorkflow() {
    try {
      const savedWorkflows = JSON.parse(localStorage.getItem('workflows') || '{}');
      const workflowNames = Object.keys(savedWorkflows);

      if (workflowNames.length === 0) {
        alert('No saved workflows found.');
        return;
      }

      const workflowName = prompt(
        `Select workflow to load:\n\n${workflowNames.join('\n')}\n\nEnter name:`
      );

      if (!workflowName || !savedWorkflows[workflowName]) {
        return;
      }

      this.canvas.fromJSON(savedWorkflows[workflowName]);
      this.updateStatus('success', `Workflow "${workflowName}" loaded!`);
    } catch (error) {
      alert(`Failed to load workflow: ${error.message}`);
      this.updateStatus('error', 'Failed to load workflow');
    }
  }

  /**
   * Update status display
   */
  updateStatus(type, message) {
    const statusDiv = this.container.querySelector('.workflow-status-message');
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.className = `workflow-status-message status-${type}`;
    }
  }

  /**
   * Show the workflow builder
   */
  show() {
    if (this.container) {
      this.container.style.display = 'block';
    }
  }

  /**
   * Hide the workflow builder
   */
  hide() {
    if (this.container) {
      this.container.style.display = 'none';
    }
  }
}
