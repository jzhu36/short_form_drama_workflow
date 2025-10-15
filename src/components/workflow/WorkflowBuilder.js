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
    this.canvas.assetManager = this.assetManager; // Pass asset manager reference
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

      // Add video results from generator nodes to asset manager (exclude pass-through nodes)
      if (this.assetManager) {
        const generatorNodeTypes = ['Sora2Video', 'VideoStitcher']; // Only these nodes generate new videos

        const generatedVideos = [];
        for (const [nodeId, output] of this.engine.executionResults.entries()) {
          if (output.video) {
            // Find the node that produced this output
            const node = this.canvas.nodes.find(n => n.id === nodeId);
            if (node && generatorNodeTypes.includes(node.type)) {
              generatedVideos.push({
                video: output.video,
                metadata: output.metadata,
                nodeType: node.type
              });
            }
          }
        }

        if (generatedVideos.length > 0) {
          for (const videoData of generatedVideos) {
            await this.assetManager.addGeneratedAsset(videoData.video, {
              prompt: videoData.metadata?.prompt || `Generated by ${videoData.nodeType}`,
              provider: videoData.metadata?.provider || videoData.nodeType,
              model: videoData.metadata?.model || '',
              resolution: videoData.metadata?.resolution || videoData.metadata?.size || '',
              duration: videoData.metadata?.duration || '',
              generatedAt: new Date().toISOString()
            });
          }
          this.updateStatus('success', `${generatedVideos.length} video(s) added to Asset Manager!`);
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
  async saveWorkflow() {
    try {
      const workflowData = this.canvas.toJSON();
      const workflowName = prompt('Enter workflow name:', 'My Workflow');

      if (!workflowName) return;

      // Get execution outputs
      const outputs = {};
      if (this.engine && this.engine.executionResults) {
        for (const [nodeId, result] of this.engine.executionResults.entries()) {
          // Convert video blobs to base64 for storage (only if small enough)
          if (result.video && result.video.size < 50 * 1024 * 1024) { // Limit to 50MB
            outputs[nodeId] = {
              metadata: result.metadata || {},
              hasVideo: true
            };
          }
        }
      }

      // Get assets data (just references, actual blobs are in IndexedDB)
      let assetsData = null;
      if (this.assetManager) {
        assetsData = {
          uploadedCount: this.assetManager.uploadedAssets.length,
          generatedCount: this.assetManager.generatedAssets.length
        };
      }

      const savedWorkflows = JSON.parse(localStorage.getItem('workflows') || '{}');
      savedWorkflows[workflowName] = {
        ...workflowData,
        name: workflowName,
        savedAt: new Date().toISOString(),
        outputs: outputs,
        assets: assetsData
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

      // Build a detailed list with info
      const workflowList = workflowNames.map(name => {
        const wf = savedWorkflows[name];
        const nodeCount = wf.nodes?.length || 0;
        const date = wf.savedAt ? new Date(wf.savedAt).toLocaleDateString() : 'Unknown';
        const outputCount = wf.outputs ? Object.keys(wf.outputs).length : 0;
        const assetInfo = wf.assets ? ` | Assets: ${wf.assets.uploadedCount}↑/${wf.assets.generatedCount}🎬` : '';
        return `${name} (${nodeCount} nodes, ${outputCount} outputs${assetInfo}, saved: ${date})`;
      }).join('\n');

      const workflowName = prompt(
        `Select workflow to load:\n\n${workflowList}\n\nEnter name:`
      );

      if (!workflowName || !savedWorkflows[workflowName]) {
        return;
      }

      const workflow = savedWorkflows[workflowName];

      // Load the workflow graph
      this.canvas.fromJSON(workflow);

      // Restore execution outputs if available
      if (workflow.outputs && Object.keys(workflow.outputs).length > 0) {
        // Clear existing results
        this.engine.executionResults.clear();

        // Note: We only saved metadata, not the actual video blobs
        // The workflow will need to be re-executed to generate videos again
        console.log(`Loaded workflow with ${Object.keys(workflow.outputs).length} previous outputs (metadata only)`);
      }

      // Show info about outputs and assets
      let infoMessage = `Workflow "${workflowName}" loaded!`;
      if (workflow.outputs && Object.keys(workflow.outputs).length > 0) {
        infoMessage += `\n\nThis workflow had ${Object.keys(workflow.outputs).length} output(s) when saved.`;
        infoMessage += `\nNote: Output videos were not saved (too large). Re-run the workflow to regenerate them.`;
      }
      if (workflow.assets) {
        infoMessage += `\n\nAssets at save time: ${workflow.assets.uploadedCount} uploaded, ${workflow.assets.generatedCount} generated.`;
        infoMessage += `\nCurrent assets: ${this.assetManager?.uploadedAssets.length || 0} uploaded, ${this.assetManager?.generatedAssets.length || 0} generated.`;
        infoMessage += `\nNote: Assets are stored in browser IndexedDB and persist across sessions.`;
      }

      this.updateStatus('success', `Workflow "${workflowName}" loaded!`);

      if (workflow.outputs || workflow.assets) {
        setTimeout(() => alert(infoMessage), 100);
      }
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
