/**
 * WorkflowEngine - Executes workflows with topological sorting
 */

export class WorkflowEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.executionResults = new Map(); // nodeId -> output values
    this.onProgress = null;
  }

  /**
   * Execute the workflow
   * @param {Object} soraClient - Sora2Client instance for video generation
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} Execution results
   */
  async execute(soraClient, onProgress = null) {
    this.onProgress = onProgress;
    this.executionResults.clear();

    try {
      // Validate workflow
      const validation = this.validateWorkflow();
      if (!validation.valid) {
        throw new Error(`Workflow validation failed: ${validation.errors.join(', ')}`);
      }

      this.logProgress('info', 'Starting workflow execution...');

      // Get execution order via topological sort
      const executionOrder = this.topologicalSort();
      this.logProgress('info', `Execution order: ${executionOrder.map(n => n.getDisplayName()).join(' → ')}`);

      // Execute nodes in order
      for (const node of executionOrder) {
        await this.executeNode(node, soraClient);
      }

      this.logProgress('success', 'Workflow execution completed!');

      return {
        success: true,
        results: Object.fromEntries(this.executionResults)
      };
    } catch (error) {
      this.logProgress('error', `Workflow execution failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute a single node
   */
  async executeNode(node, soraClient) {
    try {
      this.logProgress('info', `Executing: ${node.getDisplayName()} (${node.id})`);

      // Gather inputs from connected nodes
      const inputs = this.gatherInputs(node);

      // Execute the node
      let outputs;
      if (node.type === 'Sora2Video') {
        // Special handling for Sora2Video - needs soraClient and progress callback
        outputs = await node.execute(inputs, soraClient, (n, progress) => {
          this.logProgress('info', `${node.getDisplayName()}: ${progress.message || progress.stage}`);

          // Update node visual status
          if (node.updateStatusDisplay) {
            node.updateStatusDisplay();
          }
        });
      } else {
        // Regular node execution
        outputs = await node.execute(inputs);
      }

      // Store outputs
      this.executionResults.set(node.id, outputs);

      this.logProgress('success', `✓ ${node.getDisplayName()} completed`);

      return outputs;
    } catch (error) {
      this.logProgress('error', `✗ ${node.getDisplayName()} failed: ${error.message}`);
      throw new Error(`Node execution failed (${node.getDisplayName()}): ${error.message}`);
    }
  }

  /**
   * Gather inputs for a node from connected outputs
   */
  gatherInputs(node) {
    const inputs = {};

    node.inputs.forEach(input => {
      // Find connections to this input
      const connection = this.canvas.connections.find(conn =>
        conn.to.nodeId === node.id && conn.to.portId === input.id
      );

      if (connection) {
        // Get output from connected node
        const sourceNode = this.canvas.nodes.find(n => n.id === connection.from.nodeId);
        if (sourceNode) {
          const sourceOutputs = this.executionResults.get(sourceNode.id);
          if (sourceOutputs) {
            // Map output to input by name (e.g., "text" -> "prompt")
            // For now, we'll use the first output value
            const outputKey = Object.keys(sourceOutputs)[0];
            inputs[input.name.toLowerCase()] = sourceOutputs[outputKey];
          }
        }
      }
    });

    return inputs;
  }

  /**
   * Perform topological sort to determine execution order
   * @returns {Array} Nodes in execution order
   */
  topologicalSort() {
    const visited = new Set();
    const temp = new Set();
    const order = [];

    const visit = (node) => {
      if (temp.has(node.id)) {
        throw new Error('Workflow contains a cycle!');
      }
      if (visited.has(node.id)) {
        return;
      }

      temp.add(node.id);

      // Visit all nodes that this node depends on (inputs)
      const incomingConnections = this.canvas.connections.filter(conn =>
        conn.to.nodeId === node.id
      );

      incomingConnections.forEach(conn => {
        const sourceNode = this.canvas.nodes.find(n => n.id === conn.from.nodeId);
        if (sourceNode) {
          visit(sourceNode);
        }
      });

      temp.delete(node.id);
      visited.add(node.id);
      order.push(node);
    };

    // Visit all nodes
    this.canvas.nodes.forEach(node => {
      if (!visited.has(node.id)) {
        visit(node);
      }
    });

    return order;
  }

  /**
   * Validate the workflow before execution
   */
  validateWorkflow() {
    const errors = [];

    // Check if there are any nodes
    if (this.canvas.nodes.length === 0) {
      errors.push('Workflow is empty');
    }

    // Validate each node
    this.canvas.nodes.forEach(node => {
      const nodeValidation = node.validate();
      if (!nodeValidation.valid) {
        errors.push(`${node.getDisplayName()}: ${nodeValidation.errors.join(', ')}`);
      }

      // Check required inputs are connected
      node.inputs.forEach(input => {
        if (input.required) {
          const isConnected = this.canvas.connections.some(conn =>
            conn.to.nodeId === node.id && conn.to.portId === input.id
          );

          if (!isConnected) {
            errors.push(`${node.getDisplayName()}: Required input "${input.name}" is not connected`);
          }
        }
      });
    });

    // Check for cycles
    try {
      this.topologicalSort();
    } catch (error) {
      errors.push(error.message);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Log progress message
   */
  logProgress(type, message) {
    if (this.onProgress) {
      this.onProgress({ type, message });
    }
    console.log(`[WorkflowEngine] ${type.toUpperCase()}: ${message}`);
  }

  /**
   * Get execution results
   */
  getResults() {
    return Object.fromEntries(this.executionResults);
  }

  /**
   * Get output of a specific node
   */
  getNodeOutput(nodeId) {
    return this.executionResults.get(nodeId);
  }
}
