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
   * Save workflow to backend
   */
  async saveWorkflow() {
    try {
      const workflowData = this.canvas.toJSON();
      const workflowName = prompt('Enter workflow name:', 'My Workflow');

      if (!workflowName) return;

      this.updateStatus('info', 'Saving workflow...');

      // Prepare workflow data
      const workflowPayload = {
        name: workflowName,
        description: '',
        status: 'saved',
        definition: workflowData
      };

      // Save to backend
      const response = await fetch('http://localhost:5001/api/workflows', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(workflowPayload)
      });

      if (!response.ok) {
        throw new Error(`Failed to save workflow: ${response.statusText}`);
      }

      const result = await response.json();
      const workflowId = result.workflow_id;

      // Associate videos with workflow nodes
      if (this.engine && this.engine.executionResults) {
        for (const [nodeId, result] of this.engine.executionResults.entries()) {
          if (result.video && result.metadata?.job_id) {
            const node = this.canvas.nodes.find(n => n.id === nodeId);
            if (node) {
              try {
                await fetch(`http://localhost:5001/api/workflows/${workflowId}/videos`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    video_id: result.metadata.job_id,
                    node_id: nodeId,
                    node_type: node.type,
                    role: 'output'
                  })
                });
              } catch (err) {
                console.warn(`Failed to associate video for node ${nodeId}:`, err);
              }
            }
          }
        }
      }

      this.updateStatus('success', `Workflow "${workflowName}" saved!`);

      // Also save to localStorage as backup
      const savedWorkflows = JSON.parse(localStorage.getItem('workflows') || '{}');
      savedWorkflows[workflowName] = {
        ...workflowData,
        name: workflowName,
        workflowId: workflowId,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem('workflows', JSON.stringify(savedWorkflows));

    } catch (error) {
      alert(`Failed to save workflow: ${error.message}`);
      this.updateStatus('error', 'Failed to save workflow');
    }
  }

  /**
   * Load workflow from backend
   */
  async loadWorkflow() {
    try {
      this.updateStatus('info', 'Loading workflows...');

      // Fetch workflows from backend
      const response = await fetch('http://localhost:5001/api/workflows?status=saved');

      if (!response.ok) {
        throw new Error(`Failed to fetch workflows: ${response.statusText}`);
      }

      const data = await response.json();
      const workflows = data.workflows;

      if (workflows.length === 0) {
        alert('No saved workflows found.');
        this.updateStatus('info', 'No workflows found');
        return;
      }

      // Build a detailed list with info
      const workflowList = workflows.map(wf => {
        const nodeCount = wf.definition?.nodes?.length || 0;
        const date = wf.updated_at ? new Date(wf.updated_at).toLocaleDateString() : 'Unknown';
        const videoCount = wf.videos?.length || 0;
        return `${wf.name} (${nodeCount} nodes, ${videoCount} videos, saved: ${date})`;
      }).join('\n');

      const workflowName = prompt(
        `Select workflow to load:\n\n${workflowList}\n\nEnter name:`
      );

      if (!workflowName) {
        this.updateStatus('info', 'Load cancelled');
        return;
      }

      // Find the selected workflow
      const selectedWorkflow = workflows.find(wf => wf.name === workflowName);
      if (!selectedWorkflow) {
        alert('Workflow not found');
        return;
      }

      this.updateStatus('info', `Loading workflow "${workflowName}"...`);

      // Fetch full workflow details including videos
      const detailResponse = await fetch(`http://localhost:5001/api/workflows/${selectedWorkflow.id}`);

      if (!detailResponse.ok) {
        throw new Error(`Failed to fetch workflow details: ${detailResponse.statusText}`);
      }

      const detailData = await detailResponse.json();
      const workflow = detailData.workflow;

      // Load the workflow graph
      this.canvas.fromJSON(workflow.definition);

      // Restore associated videos if available
      if (workflow.videos && workflow.videos.length > 0) {
        this.updateStatus('info', `Restoring ${workflow.videos.length} video(s)...`);

        // Clear existing results
        this.engine.executionResults.clear();

        // Download and restore videos
        for (const videoAssoc of workflow.videos) {
          try {
            // Fetch the video blob from backend
            const videoResponse = await fetch(`http://localhost:5001/api/videos/${videoAssoc.video_id}/download`);

            if (videoResponse.ok) {
              const videoBlob = await videoResponse.blob();

              // Find the node and restore its output
              const node = this.canvas.nodes.find(n => n.id === videoAssoc.node_id);
              if (node) {
                // Store in execution results
                this.engine.executionResults.set(videoAssoc.node_id, {
                  video: videoBlob,
                  metadata: {
                    job_id: videoAssoc.video_id,
                    restored: true,
                    ...videoAssoc
                  }
                });

                // Also update the node's display if it has a method for that
                if (node.type === 'VideoStitcher' && typeof node.updateConfigDisplay === 'function') {
                  node.stitchedVideoBlob = videoBlob;
                  node.stitchedVideo = {
                    job_id: videoAssoc.video_id,
                    ...videoAssoc
                  };
                  node.updateConfigDisplay();
                }
              }
            }
          } catch (err) {
            console.warn(`Failed to restore video ${videoAssoc.video_id}:`, err);
          }
        }
      }

      // Show info message
      let infoMessage = `Workflow "${workflowName}" loaded!`;
      if (workflow.videos && workflow.videos.length > 0) {
        infoMessage += `\n\n${workflow.videos.length} video(s) restored from backend.`;
        infoMessage += `\nYou can view them in the node outputs or re-run the workflow to generate new videos.`;
      } else {
        infoMessage += `\n\nNo videos associated with this workflow. Run the workflow to generate videos.`;
      }

      this.updateStatus('success', `Workflow "${workflowName}" loaded!`);
      setTimeout(() => alert(infoMessage), 100);

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
