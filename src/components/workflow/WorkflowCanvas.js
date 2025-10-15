/**
 * WorkflowCanvas - Main canvas for building workflows
 * Handles node positioning, dragging, and connections
 */

import { TextInputNode } from './nodes/TextInputNode.js';
import { Sora2VideoNode } from './nodes/Sora2VideoNode.js';
import { Sora2ImageToVideoNode } from './nodes/Sora2ImageToVideoNode.js';
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

    // Canvas transform state
    this.zoom = 1.0;
    this.panOffset = { x: 0, y: 0 };
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };

    this.nodeRegistry = {
      'TextInput': TextInputNode,
      'Video': VideoNode,
      'Sora2Video': Sora2VideoNode,
      'Sora2ImageToVideo': Sora2ImageToVideoNode,
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
          <svg class="workflow-canvas-svg" id="workflow-svg"></svg>
          <div class="workflow-canvas-nodes" id="workflow-nodes"></div>
        </div>
        <div class="workflow-canvas-controls">
          <button class="canvas-control-btn" id="zoom-in" title="Zoom In">+</button>
          <button class="canvas-control-btn" id="zoom-reset" title="Reset Zoom">100%</button>
          <button class="canvas-control-btn" id="zoom-out" title="Zoom Out">−</button>
        </div>
      </div>
    `;

    this.canvas = this.container.querySelector('#workflow-canvas');
    this.svgLayer = this.container.querySelector('#workflow-svg');
    this.nodesLayer = this.container.querySelector('#workflow-nodes');

    // Initialize zoom controls
    this.zoomInBtn = this.container.querySelector('#zoom-in');
    this.zoomOutBtn = this.container.querySelector('#zoom-out');
    this.zoomResetBtn = this.container.querySelector('#zoom-reset');

    // Attach zoom control listeners
    this.zoomInBtn.addEventListener('click', () => this.zoomIn());
    this.zoomOutBtn.addEventListener('click', () => this.zoomOut());
    this.zoomResetBtn.addEventListener('click', () => this.resetZoom());
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

    // Mouse wheel for zoom
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.05 : 0.05;
      this.setZoom(this.zoom + delta, e.clientX, e.clientY);
    }, { passive: false });

    // Mouse down for panning
    this.canvas.addEventListener('mousedown', (e) => {
      // Pan with: middle mouse, shift+click, or left-click on empty canvas
      const isEmptyCanvas = e.target === this.canvas || e.target === this.nodesLayer || e.target === this.svgLayer;

      if (e.button === 1 || (e.button === 0 && e.shiftKey) || (e.button === 0 && isEmptyCanvas)) {
        e.preventDefault();
        this.isPanning = true;
        this.panStart = { x: e.clientX - this.panOffset.x, y: e.clientY - this.panOffset.y };
        this.canvas.style.cursor = 'grabbing';
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
   * Handle mouse move - update dragging, connecting, or panning
   */
  handleMouseMove(event) {
    // Handle canvas panning
    if (this.isPanning) {
      this.panOffset = {
        x: event.clientX - this.panStart.x,
        y: event.clientY - this.panStart.y
      };
      this.updateCanvasTransform();
      return;
    }

    // Handle node dragging
    if (this.draggingNode) {
      const canvasRect = this.canvas.getBoundingClientRect();
      const x = (event.clientX - canvasRect.left - this.panOffset.x) / this.zoom - this.dragOffset.x;
      const y = (event.clientY - canvasRect.top - this.panOffset.y) / this.zoom - this.dragOffset.y;

      this.draggingNode.setPosition(x, y);
      this.redrawConnections();
    }

    // Handle connection drawing
    if (this.connectingFrom && this.tempConnection) {
      const fromRect = this.connectingFrom.portElement.getBoundingClientRect();
      const canvasRect = this.canvas.getBoundingClientRect();

      const startX = (fromRect.right - canvasRect.left - this.panOffset.x) / this.zoom;
      const startY = (fromRect.top + fromRect.height / 2 - canvasRect.top - this.panOffset.y) / this.zoom;
      const endX = (event.clientX - canvasRect.left - this.panOffset.x) / this.zoom;
      const endY = (event.clientY - canvasRect.top - this.panOffset.y) / this.zoom;

      const path = this.createConnectionPath(startX, startY, endX, endY);
      this.tempConnection.setAttribute('d', path);
    }
  }

  /**
   * Handle mouse up - end dragging, panning, or complete connection
   */
  handleMouseUp(event) {
    // End canvas panning
    if (this.isPanning) {
      this.isPanning = false;
      this.canvas.style.cursor = '';
    }

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

      // Get port positions relative to their nodes
      const fromPortIndex = parseInt(fromPort.dataset.portIndex);
      const toPortIndex = parseInt(toPort.dataset.portIndex);

      // Calculate port positions: node position + port offset
      // Ports are at the bottom corners, vertically stacked
      const nodeWidth = 280;
      const nodeMaxHeight = 600; // Max height of node
      const portHeight = 32; // Height per port (includes gap)

      // Output ports are on the bottom-right corner, stacked vertically
      const startX = fromNode.position.x + nodeWidth;
      const startY = fromNode.position.y + nodeMaxHeight - (fromPortIndex * portHeight) - 16;

      // Input ports are on the bottom-left corner, stacked vertically
      const endX = toNode.position.x;
      const endY = toNode.position.y + nodeMaxHeight - (toPortIndex * portHeight) - 16;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'workflow-connection');
      path.setAttribute('stroke', '#10b981');
      path.setAttribute('stroke-width', '3');
      path.setAttribute('fill', 'none');
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

  /**
   * Zoom in
   */
  zoomIn() {
    this.setZoom(this.zoom + 0.1);
  }

  /**
   * Zoom out
   */
  zoomOut() {
    this.setZoom(this.zoom - 0.1);
  }

  /**
   * Reset zoom to 100%
   */
  resetZoom() {
    this.zoom = 1.0;
    this.panOffset = { x: 0, y: 0 };
    this.updateCanvasTransform();
    this.zoomResetBtn.textContent = '100%';
  }

  /**
   * Set zoom level
   */
  setZoom(newZoom, centerX, centerY) {
    // Clamp zoom between 0.1 and 3.0
    newZoom = Math.max(0.1, Math.min(3.0, newZoom));

    // If centering around a point (for mouse wheel zoom)
    if (centerX !== undefined && centerY !== undefined) {
      const canvasRect = this.canvas.getBoundingClientRect();
      const mouseX = centerX - canvasRect.left;
      const mouseY = centerY - canvasRect.top;

      // Adjust pan offset to zoom around mouse position
      const oldZoom = this.zoom;
      const zoomRatio = newZoom / oldZoom;

      this.panOffset.x = mouseX - (mouseX - this.panOffset.x) * zoomRatio;
      this.panOffset.y = mouseY - (mouseY - this.panOffset.y) * zoomRatio;
    }

    this.zoom = newZoom;
    this.updateCanvasTransform();

    // Update zoom display
    this.zoomResetBtn.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  /**
   * Update canvas transform (zoom and pan)
   */
  updateCanvasTransform() {
    const transform = `translate(${this.panOffset.x}px, ${this.panOffset.y}px) scale(${this.zoom})`;
    this.nodesLayer.style.transform = transform;
    this.svgLayer.style.transform = transform;
    this.svgLayer.style.transformOrigin = '0 0';
    this.nodesLayer.style.transformOrigin = '0 0';
    this.redrawConnections();
  }
}
