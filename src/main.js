/**
 * Main application entry point
 * Wires together all components for the Sora video generation workflow
 */

import { Sora2Client } from './services/Sora2Client.js';
import { StorageService } from './services/StorageService.js';
import { debugPanel } from './components/DebugPanel.js';
import { WorkflowBuilder } from './components/workflow/WorkflowBuilder.js';
import { AssetManager } from './components/AssetManager.js';

// Global instances
let soraClient;
let storageService;
let workflowBuilder;
let assetManager;

/**
 * Initialize the application
 */
async function initializeApp() {
  console.log('Short Form Drama Workflow - Initializing...');

  try {
    // Initialize debug panel first
    debugPanel.initialize();
    debugPanel.logInfo('Application starting...');

    // Initialize services with debug panel
    soraClient = new Sora2Client(debugPanel);
    await soraClient.initialize();

    storageService = new StorageService(debugPanel);
    await storageService.initialize();

    // Initialize asset manager
    assetManager = new AssetManager('asset-manager-container');
    assetManager.initialize();

    // Set up asset selection callback
    assetManager.setOnAssetSelect((asset, category) => {
      console.log('Asset selected:', asset, category);
      debugPanel.logInfo('Asset selected', { asset, category });
    });

    // Initialize workflow builder (main interface)
    workflowBuilder = new WorkflowBuilder('workflow-builder-container', soraClient, assetManager);
    workflowBuilder.initialize();

    console.log('Application initialized successfully!');
    debugPanel.logSuccess('Application initialized successfully!');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    debugPanel.logError('Application initialization failed', error);
    alert(`Initialization failed: ${error.message}`);
  }
}


// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
