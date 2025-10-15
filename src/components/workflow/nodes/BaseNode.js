/**
 * BaseNode - Abstract base class for workflow nodes
 */

export class BaseNode {
  constructor(id, type, position = { x: 0, y: 0 }) {
    this.id = id || `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.type = type;
    this.position = position;
    this.config = {};
    this.inputs = [];
    this.outputs = [];
    this.selected = false;
    this.element = null;
  }

  /**
   * Define node inputs (override in subclass)
   * @returns {Array} Array of input definitions
   */
  defineInputs() {
    return [];
  }

  /**
   * Define node outputs (override in subclass)
   * @returns {Array} Array of output definitions
   */
  defineOutputs() {
    return [];
  }

  /**
   * Get display name for the node
   * @returns {string}
   */
  getDisplayName() {
    return this.type;
  }

  /**
   * Get icon for the node
   * @returns {string} Emoji or icon
   */
  getIcon() {
    return '📦';
  }

  /**
   * Get color scheme for the node
   * @returns {string} CSS color
   */
  getColor() {
    return '#6b7280';
  }

  /**
   * Initialize the node (called after construction)
   */
  initialize() {
    this.inputs = this.defineInputs();
    this.outputs = this.defineOutputs();
  }

  /**
   * Render the node as HTML element
   * @param {Object} callbacks - Event callbacks
   * @returns {HTMLElement}
   */
  render(callbacks = {}) {
    const node = document.createElement('div');
    node.className = 'workflow-node';
    node.dataset.nodeId = this.id;
    node.style.left = `${this.position.x}px`;
    node.style.top = `${this.position.y}px`;

    if (this.selected) {
      node.classList.add('selected');
    }

    // Node header
    const header = document.createElement('div');
    header.className = 'workflow-node-header';
    header.style.backgroundColor = this.getColor();
    header.innerHTML = `
      <span class="workflow-node-icon">${this.getIcon()}</span>
      <span class="workflow-node-title">${this.getDisplayName()}</span>
      <button class="workflow-node-delete" title="Delete node">×</button>
    `;
    node.appendChild(header);

    // Node body
    const body = document.createElement('div');
    body.className = 'workflow-node-body';

    // Config summary
    const configSummary = this.getConfigSummary();
    if (configSummary) {
      const summaryDiv = document.createElement('div');
      summaryDiv.className = 'workflow-node-config-summary';
      summaryDiv.innerHTML = configSummary;
      body.appendChild(summaryDiv);
    }

    node.appendChild(body);

    // Inputs - positioned outside scrollable body
    if (this.inputs.length > 0) {
      const inputsContainer = document.createElement('div');
      inputsContainer.className = 'workflow-node-inputs';

      this.inputs.forEach((input, index) => {
        const inputDiv = document.createElement('div');
        inputDiv.className = 'workflow-node-port workflow-node-input';
        inputDiv.dataset.portId = input.id;
        inputDiv.dataset.portType = 'input';
        inputDiv.dataset.portIndex = index;
        inputDiv.innerHTML = `
          <div class="workflow-node-port-dot"></div>
          <span class="workflow-node-port-label">${input.name}</span>
        `;
        inputsContainer.appendChild(inputDiv);
      });

      node.appendChild(inputsContainer);
    }

    // Outputs - positioned outside scrollable body
    if (this.outputs.length > 0) {
      const outputsContainer = document.createElement('div');
      outputsContainer.className = 'workflow-node-outputs';

      this.outputs.forEach((output, index) => {
        const outputDiv = document.createElement('div');
        outputDiv.className = 'workflow-node-port workflow-node-output';
        outputDiv.dataset.portId = output.id;
        outputDiv.dataset.portType = 'output';
        outputDiv.dataset.portIndex = index;
        outputDiv.innerHTML = `
          <span class="workflow-node-port-label">${output.name}</span>
          <div class="workflow-node-port-dot"></div>
        `;
        outputsContainer.appendChild(outputDiv);
      });

      node.appendChild(outputsContainer);
    }

    // Event listeners
    node.addEventListener('mousedown', (e) => {
      if (e.target.closest('.workflow-node-port')) return;
      if (e.target.closest('.workflow-node-delete')) return;
      if (callbacks.onNodeMouseDown) {
        callbacks.onNodeMouseDown(this, e);
      }
    });

    node.addEventListener('dblclick', (e) => {
      if (e.target.closest('.workflow-node-delete')) return;
      if (callbacks.onNodeDoubleClick) {
        callbacks.onNodeDoubleClick(this, e);
      }
    });

    // Delete button listener
    const deleteBtn = node.querySelector('.workflow-node-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (callbacks.onNodeDelete) {
          callbacks.onNodeDelete(this, e);
        }
      });
    }

    // Port event listeners
    const ports = node.querySelectorAll('.workflow-node-port');
    ports.forEach(port => {
      const portDot = port.querySelector('.workflow-node-port-dot');

      const handlePortInteraction = (e) => {
        e.stopPropagation();
        e.preventDefault();
        if (callbacks.onPortMouseDown) {
          callbacks.onPortMouseDown(this, port, e);
        }
      };

      port.addEventListener('mousedown', handlePortInteraction);
      if (portDot) {
        portDot.addEventListener('mousedown', handlePortInteraction);
      }
    });

    this.element = node;
    return node;
  }

  /**
   * Update node position
   * @param {number} x
   * @param {number} y
   */
  setPosition(x, y) {
    this.position.x = x;
    this.position.y = y;
    if (this.element) {
      this.element.style.left = `${x}px`;
      this.element.style.top = `${y}px`;
    }
  }

  /**
   * Set selection state
   * @param {boolean} selected
   */
  setSelected(selected) {
    this.selected = selected;
    if (this.element) {
      if (selected) {
        this.element.classList.add('selected');
      } else {
        this.element.classList.remove('selected');
      }
    }
  }

  /**
   * Get config summary HTML to display in node body
   * @returns {string|null} HTML string or null
   */
  getConfigSummary() {
    // Override in subclass to show config info
    return null;
  }

  /**
   * Update the config summary display
   */
  updateConfigDisplay() {
    if (!this.element) return;

    const body = this.element.querySelector('.workflow-node-body');
    let summaryDiv = body.querySelector('.workflow-node-config-summary');

    const configSummary = this.getConfigSummary();

    if (configSummary) {
      if (!summaryDiv) {
        summaryDiv = document.createElement('div');
        summaryDiv.className = 'workflow-node-config-summary';
        body.insertBefore(summaryDiv, body.firstChild);
      }
      summaryDiv.innerHTML = configSummary;
    } else if (summaryDiv) {
      summaryDiv.remove();
    }
  }

  /**
   * Update the entire node element (ports and all)
   * This should be called when inputs/outputs change
   * The canvas should handle cleaning up old connections
   */
  updateElement() {
    if (!this.element || !this.element.parentNode) return;

    // Store the callbacks from when we first rendered
    if (!this._renderCallbacks) {
      console.warn('Cannot update element: no stored callbacks');
      return;
    }

    // Get parent and remove old element
    const parent = this.element.parentNode;
    const oldElement = this.element;

    // Re-render with same callbacks
    const newElement = this.render(this._renderCallbacks);

    // Replace in DOM
    parent.replaceChild(newElement, oldElement);
  }

  /**
   * Store render callbacks for later use in updateElement
   */
  setRenderCallbacks(callbacks) {
    this._renderCallbacks = callbacks;
  }

  /**
   * Open configuration dialog
   * @returns {Promise} Resolves with updated config
   */
  async openConfig() {
    // Override in subclass
    return this.config;
  }

  /**
   * Validate node configuration
   * @returns {Object} { valid: boolean, errors: [] }
   */
  validate() {
    return { valid: true, errors: [] };
  }

  /**
   * Execute the node (for workflow execution)
   * @param {Object} inputs - Input values from connected nodes
   * @returns {Promise<Object>} Output values
   */
  async execute(inputs = {}) {
    // Override in subclass
    throw new Error(`Execute method not implemented for ${this.type}`);
  }

  /**
   * Serialize node to JSON
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      type: this.type,
      position: { ...this.position },
      config: { ...this.config },
      inputs: this.inputs.map(i => ({ ...i })),
      outputs: this.outputs.map(o => ({ ...o }))
    };
  }

  /**
   * Deserialize node from JSON
   * @param {Object} data
   */
  fromJSON(data) {
    this.id = data.id;
    this.type = data.type;
    this.position = data.position;
    this.config = data.config;
    if (data.inputs) this.inputs = data.inputs;
    if (data.outputs) this.outputs = data.outputs;
  }
}
