/**
 * DebugPanel Component
 * Displays debug logs, API requests, and responses
 */

export class DebugPanel {
  constructor() {
    this.isOpen = false;
    this.logs = [];
    this.maxLogs = 100;
    this.panel = null;
    this.logContainer = null;
    this.toggleBtn = null;
  }

  /**
   * Initialize the debug panel
   */
  initialize() {
    this.createPanel();
    this.createToggleButton();
    console.log('DebugPanel initialized');
  }

  /**
   * Create the debug panel element
   */
  createPanel() {
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.className = 'debug-panel';
    panel.innerHTML = `
      <div class="debug-header">
        <h3>Debug Console</h3>
        <div class="debug-actions">
          <button id="debug-clear" class="debug-btn">Clear</button>
          <button id="debug-close" class="debug-btn">Close</button>
        </div>
      </div>
      <div id="debug-logs" class="debug-logs"></div>
    `;

    document.body.appendChild(panel);
    this.panel = panel;
    this.logContainer = document.getElementById('debug-logs');

    // Add event listeners
    document.getElementById('debug-clear').addEventListener('click', () => this.clearLogs());
    document.getElementById('debug-close').addEventListener('click', () => this.toggle());
  }

  /**
   * Create the toggle button
   */
  createToggleButton() {
    const btn = document.createElement('button');
    btn.id = 'debug-toggle';
    btn.className = 'debug-toggle';
    btn.innerHTML = '🐛';
    btn.title = 'Toggle Debug Panel';
    btn.addEventListener('click', () => this.toggle());

    document.body.appendChild(btn);
    this.toggleBtn = btn;
  }

  /**
   * Toggle panel visibility
   */
  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.panel.classList.add('open');
      this.toggleBtn.classList.add('active');
    } else {
      this.panel.classList.remove('open');
      this.toggleBtn.classList.remove('active');
    }
  }

  /**
   * Log a message
   * @param {string} type - Log type (info, success, error, request, response)
   * @param {string} message - Log message
   * @param {Object} data - Additional data to log
   */
  log(type, message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = {
      timestamp,
      type,
      message,
      data
    };

    this.logs.push(logEntry);

    // Keep only last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    this.renderLog(logEntry);

    // Auto-scroll to bottom
    this.logContainer.scrollTop = this.logContainer.scrollHeight;
  }

  /**
   * Render a log entry
   */
  renderLog(logEntry) {
    const logElement = document.createElement('div');
    logElement.className = `debug-log-entry ${logEntry.type}`;

    let dataHtml = '';
    if (logEntry.data) {
      const dataStr = typeof logEntry.data === 'string'
        ? logEntry.data
        : JSON.stringify(logEntry.data, null, 2);
      dataHtml = `<pre class="debug-data">${this.escapeHtml(dataStr)}</pre>`;
    }

    logElement.innerHTML = `
      <div class="debug-log-header">
        <span class="debug-timestamp">[${logEntry.timestamp}]</span>
        <span class="debug-type">${logEntry.type.toUpperCase()}</span>
        <span class="debug-message">${this.escapeHtml(logEntry.message)}</span>
      </div>
      ${dataHtml}
    `;

    this.logContainer.appendChild(logElement);
  }

  /**
   * Clear all logs
   */
  clearLogs() {
    this.logs = [];
    this.logContainer.innerHTML = '';
    this.log('info', 'Logs cleared');
  }

  /**
   * Log API request
   */
  logRequest(method, url, body = null) {
    this.log('request', `${method} ${url}`, body);
  }

  /**
   * Log API response
   */
  logResponse(status, url, data = null) {
    const type = status >= 200 && status < 300 ? 'response' : 'error';
    this.log(type, `Response ${status} from ${url}`, data);
  }

  /**
   * Log error
   */
  logError(message, error = null) {
    this.log('error', message, error ? error.toString() : null);
  }

  /**
   * Log success
   */
  logSuccess(message, data = null) {
    this.log('success', message, data);
  }

  /**
   * Log info
   */
  logInfo(message, data = null) {
    this.log('info', message, data);
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get all logs
   */
  getLogs() {
    return this.logs;
  }

  /**
   * Export logs as JSON
   */
  exportLogs() {
    const dataStr = JSON.stringify(this.logs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportFileDefaultName = `debug-logs-${Date.now()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }
}

// Create a singleton instance
export const debugPanel = new DebugPanel();
