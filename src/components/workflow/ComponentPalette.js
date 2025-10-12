/**
 * ComponentPalette - Sidebar with draggable workflow components
 */

export class ComponentPalette {
  constructor(containerId, canvas) {
    this.containerId = containerId;
    this.canvas = canvas;
    this.container = null;

    this.components = [
      {
        type: 'TextInput',
        name: 'Text Input',
        icon: '📝',
        description: 'Provides configurable text value',
        color: '#10b981'
      },
      {
        type: 'Sora2Video',
        name: 'Sora2 Video',
        icon: '🎬',
        description: 'Generate video from text prompt',
        color: '#2563eb'
      }
    ];
  }

  /**
   * Initialize the palette
   */
  initialize() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      throw new Error(`Container #${this.containerId} not found`);
    }

    this.render();
  }

  /**
   * Render the palette HTML
   */
  render() {
    this.container.innerHTML = `
      <div class="workflow-palette">
        <div class="workflow-palette-header">
          <h3>Components</h3>
        </div>
        <div class="workflow-palette-items">
          ${this.components.map(comp => this.renderComponent(comp)).join('')}
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  /**
   * Render a single component item
   */
  renderComponent(component) {
    return `
      <div class="workflow-palette-item"
           data-component-type="${component.type}"
           draggable="true">
        <div class="workflow-palette-item-icon" style="background-color: ${component.color};">
          ${component.icon}
        </div>
        <div class="workflow-palette-item-info">
          <div class="workflow-palette-item-name">${component.name}</div>
          <div class="workflow-palette-item-desc">${component.description}</div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners for drag and drop
   */
  attachEventListeners() {
    const items = this.container.querySelectorAll('.workflow-palette-item');

    items.forEach(item => {
      item.addEventListener('dragstart', (e) => {
        const componentType = item.dataset.componentType;
        e.dataTransfer.setData('componentType', componentType);
        e.dataTransfer.effectAllowed = 'copy';
        item.classList.add('dragging');
      });

      item.addEventListener('dragend', (e) => {
        item.classList.remove('dragging');
      });

      // Also support click to add (places at center)
      item.addEventListener('click', (e) => {
        const componentType = item.dataset.componentType;
        const canvasRect = this.canvas.canvas.getBoundingClientRect();
        const centerX = canvasRect.width / 2 - 100;
        const centerY = canvasRect.height / 2 - 50;

        this.canvas.addNode(componentType, { x: centerX, y: centerY });
      });
    });

    // Setup drop zone on canvas
    const canvasElement = this.canvas.canvas;

    canvasElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    canvasElement.addEventListener('drop', (e) => {
      e.preventDefault();
      const componentType = e.dataTransfer.getData('componentType');

      if (componentType) {
        const canvasRect = canvasElement.getBoundingClientRect();
        const x = e.clientX - canvasRect.left - 100; // Offset to center node
        const y = e.clientY - canvasRect.top - 30;

        this.canvas.addNode(componentType, { x, y });
      }
    });
  }
}
