/**
 * Tests for WorkflowCanvas
 * Tests drag-to-move, deletion, and connection functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkflowCanvas } from '../../src/components/workflow/WorkflowCanvas.js';
import { TextInputNode } from '../../src/components/workflow/nodes/TextInputNode.js';
import { Sora2VideoNode } from '../../src/components/workflow/nodes/Sora2VideoNode.js';

describe('WorkflowCanvas', () => {
  let container;
  let canvas;

  beforeEach(() => {
    // Create a container element
    container = document.createElement('div');
    container.id = 'test-canvas-container';
    document.body.appendChild(container);

    // Initialize canvas
    canvas = new WorkflowCanvas('test-canvas-container');
    canvas.initialize();
  });

  afterEach(() => {
    // Clean up
    document.body.removeChild(container);
  });

  describe('Node Creation', () => {
    it('should create a TextInput node', () => {
      const node = canvas.addNode('TextInput', { x: 100, y: 100 });

      expect(node).toBeDefined();
      expect(node.type).toBe('TextInput');
      expect(node.position.x).toBe(100);
      expect(node.position.y).toBe(100);
      expect(canvas.nodes).toHaveLength(1);
    });

    it('should create a Sora2Video node', () => {
      const node = canvas.addNode('Sora2Video', { x: 200, y: 200 });

      expect(node).toBeDefined();
      expect(node.type).toBe('Sora2Video');
      expect(node.position.x).toBe(200);
      expect(node.position.y).toBe(200);
      expect(canvas.nodes).toHaveLength(1);
    });

    it('should render node element in DOM', () => {
      const node = canvas.addNode('TextInput', { x: 100, y: 100 });

      expect(node.element).toBeDefined();
      expect(node.element.parentNode).toBe(canvas.nodesLayer);
      expect(node.element.classList.contains('workflow-node')).toBe(true);
    });
  });

  describe('Node Dragging (Bug Fix #1)', () => {
    it('should update node position when dragged', () => {
      const node = canvas.addNode('TextInput', { x: 100, y: 100 });

      // Simulate drag start
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 150,
        clientY: 150,
        bubbles: true
      });

      // Mock getBoundingClientRect
      node.element.getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        right: 300,
        bottom: 200
      });

      canvas.canvas.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        right: 800,
        bottom: 600
      });

      canvas.handleNodeMouseDown(node, mouseDownEvent);

      expect(canvas.draggingNode).toBe(node);

      // Simulate drag move
      const mouseMoveEvent = new MouseEvent('mousemove', {
        clientX: 200,
        clientY: 200,
        bubbles: true
      });

      canvas.handleMouseMove(mouseMoveEvent);

      // Node should have moved
      expect(node.position.x).toBeGreaterThan(100);
      expect(node.position.y).toBeGreaterThan(100);

      // Simulate drag end
      const mouseUpEvent = new MouseEvent('mouseup', {
        bubbles: true
      });

      canvas.handleMouseUp(mouseUpEvent);

      expect(canvas.draggingNode).toBeNull();
    });

    it('should maintain correct drag offset during move', () => {
      const node = canvas.addNode('TextInput', { x: 100, y: 100 });

      canvas.canvas.getBoundingClientRect = () => ({
        left: 0,
        top: 0
      });

      // Simulate mousedown at a specific point on the node
      const mouseDownEvent = new MouseEvent('mousedown', {
        clientX: 150, // 50px from node left edge
        clientY: 150  // 50px from node top edge
      });

      canvas.handleNodeMouseDown(node, mouseDownEvent);

      // Drag offset should be calculated correctly
      expect(canvas.dragOffset.x).toBe(50); // clientX - canvasLeft - nodeX = 150 - 0 - 100
      expect(canvas.dragOffset.y).toBe(50);
    });
  });

  describe('Node Deletion (Bug Fix #2)', () => {
    it('should have a delete button in node header', () => {
      const node = canvas.addNode('TextInput', { x: 100, y: 100 });

      const deleteBtn = node.element.querySelector('.workflow-node-delete');
      expect(deleteBtn).toBeDefined();
      expect(deleteBtn).not.toBeNull();
    });

    it('should remove node when delete button is clicked', () => {
      const node = canvas.addNode('TextInput', { x: 100, y: 100 });

      expect(canvas.nodes).toHaveLength(1);

      // Mock confirm dialog
      window.confirm = vi.fn(() => true);

      // Click delete button
      canvas.handleNodeDelete(node, new Event('click'));

      expect(canvas.nodes).toHaveLength(0);
      expect(node.element.parentNode).toBeNull();
    });

    it('should not remove node if deletion is cancelled', () => {
      const node = canvas.addNode('TextInput', { x: 100, y: 100 });

      expect(canvas.nodes).toHaveLength(1);

      // Mock confirm dialog to return false
      window.confirm = vi.fn(() => false);

      canvas.handleNodeDelete(node, new Event('click'));

      expect(canvas.nodes).toHaveLength(1);
    });

    it('should remove connections when node is deleted', () => {
      const node1 = canvas.addNode('TextInput', { x: 100, y: 100 });
      const node2 = canvas.addNode('Sora2Video', { x: 300, y: 100 });

      // Create a connection
      const fromPortId = node1.outputs[0].id;
      const toPortId = node2.inputs[0].id;

      canvas.createConnection(node1, fromPortId, node2, toPortId);

      expect(canvas.connections).toHaveLength(1);

      // Mock confirm dialog
      window.confirm = vi.fn(() => true);

      // Delete first node
      canvas.handleNodeDelete(node1, new Event('click'));

      // Connection should be removed
      expect(canvas.connections).toHaveLength(0);
    });
  });

  describe('Connection Drawing (Bug Fix #3)', () => {
    it('should start connection from output port', () => {
      const node = canvas.addNode('TextInput', { x: 100, y: 100 });
      const outputPort = node.element.querySelector('[data-port-type="output"]');

      expect(outputPort).toBeDefined();

      const mouseDownEvent = new MouseEvent('mousedown', {
        bubbles: true
      });

      canvas.handlePortMouseDown(node, outputPort, mouseDownEvent);

      expect(canvas.connectingFrom).toBeDefined();
      expect(canvas.connectingFrom.node).toBe(node);
      expect(canvas.connectingFrom.type).toBe('output');
      expect(canvas.tempConnection).toBeDefined();
    });

    it('should create connection between output and input ports', () => {
      const node1 = canvas.addNode('TextInput', { x: 100, y: 100 });
      const node2 = canvas.addNode('Sora2Video', { x: 300, y: 100 });

      const fromPortId = node1.outputs[0].id;
      const toPortId = node2.inputs[0].id;

      canvas.createConnection(node1, fromPortId, node2, toPortId);

      expect(canvas.connections).toHaveLength(1);
      expect(canvas.connections[0].from.nodeId).toBe(node1.id);
      expect(canvas.connections[0].from.portId).toBe(fromPortId);
      expect(canvas.connections[0].to.nodeId).toBe(node2.id);
      expect(canvas.connections[0].to.portId).toBe(toPortId);
    });

    it('should not create duplicate connections', () => {
      const node1 = canvas.addNode('TextInput', { x: 100, y: 100 });
      const node2 = canvas.addNode('Sora2Video', { x: 300, y: 100 });

      const fromPortId = node1.outputs[0].id;
      const toPortId = node2.inputs[0].id;

      canvas.createConnection(node1, fromPortId, node2, toPortId);
      canvas.createConnection(node1, fromPortId, node2, toPortId);

      expect(canvas.connections).toHaveLength(1);
    });

    it('should draw SVG path for connection', () => {
      const node1 = canvas.addNode('TextInput', { x: 100, y: 100 });
      const node2 = canvas.addNode('Sora2Video', { x: 300, y: 100 });

      // Mock getBoundingClientRect for ports
      const outputPort = node1.element.querySelector('[data-port-type="output"]');
      const inputPort = node2.element.querySelector('[data-port-type="input"]');

      outputPort.getBoundingClientRect = () => ({
        left: 200,
        top: 110,
        right: 214,
        bottom: 124,
        height: 14
      });

      inputPort.getBoundingClientRect = () => ({
        left: 300,
        top: 110,
        right: 314,
        bottom: 124,
        height: 14
      });

      canvas.canvas.getBoundingClientRect = () => ({
        left: 0,
        top: 0
      });

      const fromPortId = node1.outputs[0].id;
      const toPortId = node2.inputs[0].id;

      canvas.createConnection(node1, fromPortId, node2, toPortId);

      // Check that SVG path was created
      const paths = canvas.svgLayer.querySelectorAll('path.workflow-connection');
      expect(paths).toHaveLength(1);
    });

    it('should update connection when node is dragged', () => {
      const node1 = canvas.addNode('TextInput', { x: 100, y: 100 });
      const node2 = canvas.addNode('Sora2Video', { x: 300, y: 100 });

      const fromPortId = node1.outputs[0].id;
      const toPortId = node2.inputs[0].id;

      canvas.createConnection(node1, fromPortId, node2, toPortId);

      const initialConnections = canvas.connections.length;

      // Move node
      node1.setPosition(150, 150);
      canvas.redrawConnections();

      // Connection should still exist
      expect(canvas.connections).toHaveLength(initialConnections);
    });
  });

  describe('Connection Deletion', () => {
    it('should delete connection when clicked', () => {
      const node1 = canvas.addNode('TextInput', { x: 100, y: 100 });
      const node2 = canvas.addNode('Sora2Video', { x: 300, y: 100 });

      const fromPortId = node1.outputs[0].id;
      const toPortId = node2.inputs[0].id;

      canvas.createConnection(node1, fromPortId, node2, toPortId);

      expect(canvas.connections).toHaveLength(1);

      // Mock confirm dialog
      window.confirm = vi.fn(() => true);

      const connection = canvas.connections[0];
      canvas.removeConnection(connection);

      expect(canvas.connections).toHaveLength(0);
    });
  });

  describe('Serialization', () => {
    it('should serialize workflow to JSON', () => {
      const node1 = canvas.addNode('TextInput', { x: 100, y: 100 });
      const node2 = canvas.addNode('Sora2Video', { x: 300, y: 100 });

      const fromPortId = node1.outputs[0].id;
      const toPortId = node2.inputs[0].id;

      canvas.createConnection(node1, fromPortId, node2, toPortId);

      const json = canvas.toJSON();

      expect(json.nodes).toHaveLength(2);
      expect(json.connections).toHaveLength(1);
    });

    it('should deserialize workflow from JSON', () => {
      const node1 = canvas.addNode('TextInput', { x: 100, y: 100 });
      const node2 = canvas.addNode('Sora2Video', { x: 300, y: 100 });

      const fromPortId = node1.outputs[0].id;
      const toPortId = node2.inputs[0].id;

      canvas.createConnection(node1, fromPortId, node2, toPortId);

      const json = canvas.toJSON();

      // Create new canvas
      const newCanvas = new WorkflowCanvas('test-canvas-container');
      newCanvas.initialize();
      newCanvas.fromJSON(json);

      expect(newCanvas.nodes).toHaveLength(2);
      expect(newCanvas.connections).toHaveLength(1);
      expect(newCanvas.nodes[0].position.x).toBe(100);
      expect(newCanvas.nodes[0].position.y).toBe(100);
    });
  });

  describe('Node Selection', () => {
    it('should select node on mousedown', () => {
      const node = canvas.addNode('TextInput', { x: 100, y: 100 });

      expect(node.selected).toBe(false);

      canvas.handleNodeMouseDown(node, new MouseEvent('mousedown'));

      expect(node.selected).toBe(true);
      expect(canvas.selectedNode).toBe(node);
    });

    it('should deselect previous node when selecting new node', () => {
      const node1 = canvas.addNode('TextInput', { x: 100, y: 100 });
      const node2 = canvas.addNode('Sora2Video', { x: 300, y: 100 });

      canvas.handleNodeMouseDown(node1, new MouseEvent('mousedown'));
      expect(node1.selected).toBe(true);

      canvas.handleNodeMouseDown(node2, new MouseEvent('mousedown'));
      expect(node1.selected).toBe(false);
      expect(node2.selected).toBe(true);
    });
  });
});
