/**
 * WorkflowCanvas - Main canvas for building workflows
 * Handles node positioning, dragging, and connections
 */

import { TextInputNode } from './nodes/TextInputNode.js';
import { Sora2VideoNode } from './nodes/Sora2VideoNode.js';
import { PromptGeneratorNode } from './nodes/PromptGeneratorNode.js';
import { VideoStitcherNode } from './nodes/VideoStitcherNode.js';
import { VideoNode } from './nodes/VideoNode.js';

export class WorkflowCanvas {
  constructor(containerId) {
    this.containerId = containerId;
    this.container = null;
    this.canvas = null;
    this.svgLayer = null;

    this.nodes = [];
    this.connections = [];
    this.selectedNode = null;
    this.draggingNode = null;
    this.dragOffset = { x: 0, y: 0 };

    // Connection drawing state
    this.connectingFrom = null;
    this.tempConnection = null;

    this.nodeRegistry = {
      'TextInput': TextInputNode,
      'Video': VideoNode,
      'Sora2Video': Sora2VideoNode,
      'PromptGenerator': PromptGeneratorNode,
      'VideoStitcher': VideoStitcherNode
    };
  }

  /**
   * Initialize the canvas
   */
  initialize() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      throw new Error(`Container #${this.containerId} not found`);
    }

    this.render();
    this.attachEventListeners();
  }

  /**
   * Render the canvas HTML structure
   */
  render() {
    this.container.innerHTML = `
      <div class="workflow-canvas-wrapper">
        <div class="workflow-canvas" id="workflow-canvas">
          <svg class="workflow-canvas-svg" id="workflow-svg">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="10"
                      refX="9" refY="3" orient="auto">
                <polygon points="0 0, 10 3, 0 6" fill="#6b7280" />
              </marker>
            </defs>
          </svg>
          <div class="workflow-canvas-nodes" id="workflow-nodes"></div>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#workflow-canvas');
    this.svgLayer = this.container.querySelector('#workflow-svg');
    this.nodesLayer = this.container.querySelector('#workflow-nodes');
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Canvas click to deselect
    this.canvas.addEventListener('click', (e) => {
      if (e.target === this.canvas || e.target === this.nodesLayer) {
        this.deselectAll();
      }
    });

    // Mouse move for dragging
    document.addEventListener('mousemove', (e) => {
      this.handleMouseMove(e);
    });

    // Mouse up to end dragging
    document.addEventListener('mouseup', (e) => {
      this.handleMouseUp(e);
    });

    // Drag and drop support for assets
    this.canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      this.canvas.classList.add('drag-over');
    });

    this.canvas.addEventListener('dragleave', (e) => {
      if (e.target === this.canvas) {
        this.canvas.classList.remove('drag-over');
      }
    });

    this.canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.canvas.classList.remove('drag-over');
      this.handleAssetDrop(e);
    });
  }

  /**
   * Add a new node to the canvas
   */
  addNode(type, position, config = null) {
    const NodeClass = this.nodeRegistry[type];
    if (!NodeClass) {
      console.error(`Unknown node type: ${type}`);
      return null;
    }

    const node = new NodeClass(null, position);

    // Set initial config if provided
    if (config) {
      node.config = { ...node.config, ...config };
    }

    this.nodes.push(node);

    // Set port change callback
    node.onPortsChanged = (n) => this.cleanupInvalidConnections(n);

    // Render the node with callbacks
    const callbacks = {
      onNodeMouseDown: (n, e) => this.handleNodeMouseDown(n, e),
      onNodeDoubleClick: (n, e) => this.handleNodeDoubleClick(n, e),
      onNodeDelete: (n, e) => this.handleNodeDelete(n, e),
      onPortMouseDown: (n, port, e) => this.handlePortMouseDown(n, port, e)
    };

    node.setRenderCallbacks(callbacks);
    const element = node.render(callbacks);

    this.nodesLayer.appendChild(element);

    // Update display to show config
    if (config) {
      node.updateConfigDisplay();
    }

    return node;
  }

  /**
   * Remove a node from the canvas
   */
  removeNode(node) {
    // Remove connections to/from this node
    this.connections = this.connections.filter(conn => {
      if (conn.from.nodeId === node.id || conn.to.nodeId === node.id) {
        return false;
      }
      return true;
    });

    // Remove node
    const index = this.nodes.findIndex(n => n.id === node.id);
    if (index >= 0) {
      this.nodes.splice(index, 1);
    }

    // Remove element
    if (node.element && node.element.parentNode) {
      node.element.parentNode.removeChild(node.element);
    }

    this.redrawConnections();
  }

  /**
   * Handle node mouse down - start dragging
   */
  handleNodeMouseDown(node, event) {
    event.stopPropagation();

    this.deselectAll();
    node.setSelected(true);
    this.selectedNode = node;

    this.draggingNode = node;
    const canvasRect = this.canvas.getBoundingClientRect();

    this.dragOffset = {
      x: event.clientX - canvasRect.left - node.position.x,
      y: event.clientY - canvasRect.top - node.position.y
    };
  }

  /**
   * Handle node double click - open config
   */
  async handleNodeDoubleClick(node, event) {
    event.stopPropagation();
    await node.openConfig();
    // Optionally update node display after config change
  }

  /**
   * Handle node delete - remove node
   */
  handleNodeDelete(node, event) {
    event.stopPropagation();
    if (confirm(`Delete node "${node.getDisplayName()}"?`)) {
      this.removeNode(node);
    }
  }

  /**
   * Handle port mouse down - start connection
   */
  handlePortMouseDown(node, portElement, event) {
    event.stopPropagation();

    const portType = portElement.dataset.portType;
    const portId = portElement.dataset.portId;

    if (portType === 'output') {
      // Start connection from output
      this.connectingFrom = {
        node: node,
        portElement: portElement,
        portId: portId,
        type: 'output'
      };

      // Create temp connection line
      this.tempConnection = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      this.tempConnection.setAttribute('class', 'workflow-connection-temp');
      this.tempConnection.setAttribute('stroke', '#6b7280');
      this.tempConnection.setAttribute('stroke-width', '2');
      this.tempConnection.setAttribute('fill', 'none');
      this.svgLayer.appendChild(this.tempConnection);
    }
  }

  /**
   * Handle mouse move - update dragging or connecting
   */
  handleMouseMove(event) {
    // Handle node dragging
    if (this.draggingNode) {
      const canvasRect = this.canvas.getBoundingClientRect();
      const x = event.clientX - canvasRect.left - this.dragOffset.x;
      const y = event.clientY - canvasRect.top - this.dragOffset.y;

      this.draggingNode.setPosition(x, y);
      this.redrawConnections();
    }

    // Handle connection drawing
    if (this.connectingFrom && this.tempConnection) {
      const fromRect = this.connectingFrom.portElement.getBoundingClientRect();
      const canvasRect = this.canvas.getBoundingClientRect();

      const startX = fromRect.right - canvasRect.left;
      const startY = fromRect.top + fromRect.height / 2 - canvasRect.top;
      const endX = event.clientX - canvasRect.left;
      const endY = event.clientY - canvasRect.top;

      const path = this.createConnectionPath(startX, startY, endX, endY);
      this.tempConnection.setAttribute('d', path);
    }
  }

  /**
   * Handle mouse up - end dragging or complete connection
   */
  handleMouseUp(event) {
    // End node dragging
    if (this.draggingNode) {
      this.draggingNode = null;
      this.dragOffset = { x: 0, y: 0 };
    }

    // End connection drawing
    if (this.connectingFrom) {
      // Check if mouse is over an input port
      let element = document.elementFromPoint(event.clientX, event.clientY);

      // Try to find the port element (might be on dot or label)
      let portElement = null;
      if (element) {
        if (element.classList.contains('workflow-node-port')) {
          portElement = element;
        } else {
          portElement = element.closest('.workflow-node-port');
        }
      }

      if (portElement) {
        const portType = portElement.dataset.portType;
        const targetNodeId = portElement.closest('.workflow-node').dataset.nodeId;
        const targetNode = this.nodes.find(n => n.id === targetNodeId);

        if (portType === 'input' && targetNode) {
          // Create connection
          this.createConnection(
            this.connectingFrom.node,
            this.connectingFrom.portId,
            targetNode,
            portElement.dataset.portId
          );
        }
      }

      // Clean up temp connection
      if (this.tempConnection && this.tempConnection.parentNode) {
        this.tempConnection.parentNode.removeChild(this.tempConnection);
      }
      this.connectingFrom = null;
      this.tempConnection = null;
    }
  }

  /**
   * Create a connection between two nodes
   */
  createConnection(fromNode, fromPortId, toNode, toPortId) {
    // Check if connection already exists
    const exists = this.connections.find(conn =>
      conn.from.nodeId === fromNode.id &&
      conn.from.portId === fromPortId &&
      conn.to.nodeId === toNode.id &&
      conn.to.portId === toPortId
    );

    if (exists) return;

    const connection = {
      id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      from: { nodeId: fromNode.id, portId: fromPortId },
      to: { nodeId: toNode.id, portId: toPortId }
    };

    this.connections.push(connection);
    this.redrawConnections();
  }

  /**
   * Remove a connection
   */
  removeConnection(connection) {
    const index = this.connections.findIndex(c => c.id === connection.id);
    if (index >= 0) {
      this.connections.splice(index, 1);
      this.redrawConnections();
    }
  }

  /**
   * Redraw all connections
   */
  redrawConnections() {
    // Clear existing connection paths (except temp)
    const paths = this.svgLayer.querySelectorAll('path:not(.workflow-connection-temp)');
    paths.forEach(path => path.remove());

    // Draw each connection
    this.connections.forEach(conn => {
      const fromNode = this.nodes.find(n => n.id === conn.from.nodeId);
      const toNode = this.nodes.find(n => n.id === conn.to.nodeId);

      if (!fromNode || !toNode) return;

      const fromPort = fromNode.element.querySelector(`[data-port-id="${conn.from.portId}"]`);
      const toPort = toNode.element.querySelector(`[data-port-id="${conn.to.portId}"]`);

      if (!fromPort || !toPort) return;

      const canvasRect = this.canvas.getBoundingClientRect();
      const fromRect = fromPort.getBoundingClientRect();
      const toRect = toPort.getBoundingClientRect();

      const startX = fromRect.right - canvasRect.left;
      const startY = fromRect.top + fromRect.height / 2 - canvasRect.top;
      const endX = toRect.left - canvasRect.left;
      const endY = toRect.top + toRect.height / 2 - canvasRect.top;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'workflow-connection');
      path.setAttribute('stroke', '#6b7280');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', 'none');
      path.setAttribute('marker-end', 'url(#arrowhead)');
      path.setAttribute('d', this.createConnectionPath(startX, startY, endX, endY));
      path.dataset.connectionId = conn.id;

      // Click to delete connection
      path.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Delete this connection?')) {
          this.removeConnection(conn);
        }
      });

      this.svgLayer.appendChild(path);
    });
  }

  /**
   * Create a bezier curve path for connection
   */
  createConnectionPath(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1);
    const controlOffset = Math.min(dx * 0.5, 100);

    return `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;
  }

  /**
   * Deselect all nodes
   */
  deselectAll() {
    this.nodes.forEach(node => node.setSelected(false));
    this.selectedNode = null;
  }

  /**
   * Clear the canvas
   */
  clear() {
    this.nodes.forEach(node => {
      if (node.element && node.element.parentNode) {
        node.element.parentNode.removeChild(node.element);
      }
    });
    this.nodes = [];
    this.connections = [];
    this.redrawConnections();
  }

  /**
   * Get workflow data (for serialization)
   */
  toJSON() {
    return {
      nodes: this.nodes.map(n => n.toJSON()),
      connections: this.connections.map(c => ({ ...c }))
    };
  }

  /**
   * Load workflow data (from serialization)
   */
  fromJSON(data) {
    this.clear();

    // Recreate nodes
    data.nodes.forEach(nodeData => {
      const NodeClass = this.nodeRegistry[nodeData.type];
      if (NodeClass) {
        const node = new NodeClass();
        node.fromJSON(nodeData);
        this.nodes.push(node);

        const callbacks = {
          onNodeMouseDown: (n, e) => this.handleNodeMouseDown(n, e),
          onNodeDoubleClick: (n, e) => this.handleNodeDoubleClick(n, e),
          onNodeDelete: (n, e) => this.handleNodeDelete(n, e),
          onPortMouseDown: (n, port, e) => this.handlePortMouseDown(n, port, e)
        };

        node.setRenderCallbacks(callbacks);
        const element = node.render(callbacks);

        this.nodesLayer.appendChild(element);
      }
    });

    // Recreate connections
    this.connections = data.connections || [];
    this.redrawConnections();
  }

  /**
   * Handle asset drop from asset manager
   */
  handleAssetDrop(event) {
    // Check if this is an asset drag
    const isAssetDrag = event.dataTransfer.getData('assetDrag');
    if (!isAssetDrag) return;

    const assetId = event.dataTransfer.getData('assetId');
    const assetCategory = event.dataTransfer.getData('assetCategory');

    if (!assetId || !this.assetManager) return;

    // Get the asset from asset manager
    const asset = this.assetManager.getAsset(assetId, assetCategory);
    if (!asset || asset.type !== 'video') {
      console.warn('Only video assets can be dropped on the canvas');
      return;
    }

    // Calculate drop position relative to canvas
    const canvasRect = this.canvas.getBoundingClientRect();
    const position = {
      x: event.clientX - canvasRect.left - 100, // Center the node on cursor
      y: event.clientY - canvasRect.top - 50
    };

    // Create a Video node with the asset's info
    let videoPath = '';
    let videoName = asset.name;

    if (assetCategory === 'generated') {
      // For generated videos, we need to get the job ID or use a stored reference
      // The asset might have metadata with job_id
      if (asset.jobId) {
        videoPath = asset.jobId;
      } else {
        // Try to extract from metadata or use a temp reference
        videoName = asset.name || (asset.prompt ? asset.prompt.substring(0, 30) + '...' : 'Generated Video');
      }
    }

    // Create Video node with configuration
    const videoNode = this.addNode('Video', position, {
      video_name: videoName,
      video_path: videoPath,
      asset_id: assetId,
      asset_category: assetCategory
    });

    if (videoNode) {
      // Store the asset blob in the node for immediate use
      videoNode.videoBlob = asset.blob;
      videoNode.videoMetadata = {
        duration: asset.duration || 0,
        resolution: asset.resolution || 'Unknown',
        size: asset.blob ? asset.blob.size : 0,
        provider: asset.provider,
        prompt: asset.prompt
      };

      // Update the node display to show the video preview
      videoNode.updateConfigDisplay();

      console.log(`Created Video node from asset: ${videoName}`);
    }
  }

  /**
   * Clean up invalid connections after port changes
   * Removes connections to ports that no longer exist
   */
  cleanupInvalidConnections(node) {
    const validInputIds = new Set(node.inputs.map(i => i.id));
    const validOutputIds = new Set(node.outputs.map(o => o.id));

    // Remove connections that reference non-existent ports
    this.connections = this.connections.filter(conn => {
      // Check if connection involves this node
      if (conn.from.nodeId === node.id) {
        return validOutputIds.has(conn.from.portId);
      }
      if (conn.to.nodeId === node.id) {
        return validInputIds.has(conn.to.portId);
      }
      return true;
    });

    this.redrawConnections();
  }
}
