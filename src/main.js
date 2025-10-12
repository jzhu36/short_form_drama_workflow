/**
 * Main application entry point
 * Wires together all components for the Sora video generation workflow
 */

import { Sora2Client } from './services/Sora2Client.js';
import { StorageService } from './services/StorageService.js';
import { PromptInput } from './components/PromptInput.js';
import { VideoViewer } from './components/VideoViewer.js';
import { VideoList } from './components/VideoList.js';
import { debugPanel } from './components/DebugPanel.js';

// Global instances
let soraClient;
let storageService;
let promptInput;
let videoViewer;
let videoList;

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

    // Initialize components
    videoViewer = new VideoViewer('video-panel');
    videoViewer.initialize();

    videoList = new VideoList('video-list-container', handleVideoSelect);
    videoList.initialize();
    videoList.setRefreshCallback(loadVideoList);

    promptInput = new PromptInput('prompt-panel', handleVideoGeneration);
    promptInput.initialize();

    // Load video list on startup
    await loadVideoList();

    console.log('Application initialized successfully!');
    debugPanel.logSuccess('Application initialized successfully!');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    debugPanel.logError('Application initialization failed', error);
    alert(`Initialization failed: ${error.message}`);
  }
}

/**
 * Handle video generation flow
 * @param {string} prompt - The user's prompt
 */
async function handleVideoGeneration(prompt) {
  console.log('Starting video generation for prompt:', prompt);
  debugPanel.logInfo('Starting video generation workflow', { prompt });

  try {
    // Show loading state
    videoViewer.showLoading('Initializing video generation...');

    // Generate and download video with progress updates
    const result = await soraClient.generateAndDownload(
      prompt,
      (progress) => {
        // Update UI based on progress
        const { stage, message, status } = progress;

        // Update prompt status
        promptInput.updateProgress(progress);

        // Update video viewer status
        if (stage === 'generating') {
          videoViewer.showLoading('Starting video generation...');
        } else if (stage === 'polling') {
          videoViewer.showLoading(message);
        } else if (stage === 'downloading') {
          videoViewer.showLoading('Downloading video...');
        } else if (stage === 'error') {
          videoViewer.showError(message);
        }
      }
    );

    // Save video to storage
    debugPanel.logInfo('Saving video and prompt to storage...');
    const videoId = await storageService.saveVideo({
      prompt: prompt,
      soraVideoId: result.metadata.videoId,
      videoBlob: result.videoBlob,
      videoUrl: result.metadata.url,
      generatedAt: result.metadata.generatedAt
    });

    // Save prompt to history
    await storageService.savePrompt(prompt, videoId);

    // Load video in viewer
    videoViewer.loadVideo(result.videoBlob, {
      ...result.metadata,
      id: videoId
    });

    // Update status
    promptInput.showStatus('Video generated successfully!', 'success');

    console.log('Video generation complete! Video ID:', videoId);
    debugPanel.logSuccess('Video generation workflow complete!', { videoId });

    // Refresh video list to show the new video
    await loadVideoList();
  } catch (error) {
    console.error('Video generation failed:', error);
    debugPanel.logError('Video generation workflow failed', error);
    videoViewer.showError(`Generation failed: ${error.message}`);
    promptInput.showStatus(`Error: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Load video list from API
 */
async function loadVideoList() {
  try {
    debugPanel.logInfo('Loading video list...');
    videoList.showLoading();

    const videos = await soraClient.listVideos();
    videoList.updateVideos(videos);
  } catch (error) {
    console.error('Failed to load videos:', error);
    debugPanel.logError('Failed to load video list', error);
    videoList.showError(`Failed to load videos: ${error.message}`);
  }
}

/**
 * Handle video selection from list
 * @param {Object} video - Selected video object
 */
async function handleVideoSelect(video) {
  try {
    debugPanel.logInfo('Loading selected video', { id: video.id });

    // Check if video has output URL
    if (!video.output?.url) {
      videoViewer.showError('Video URL not available');
      return;
    }

    videoViewer.showLoading('Loading video...');

    // Download the video
    const videoBlob = await soraClient.downloadVideo(video.output.url);

    // Display in viewer
    videoViewer.loadVideo(videoBlob, {
      videoId: video.id,
      prompt: video.prompt,
      url: video.output.url
    });

    debugPanel.logSuccess('Video loaded successfully', { id: video.id });
  } catch (error) {
    console.error('Failed to load video:', error);
    debugPanel.logError('Failed to load selected video', error);
    videoViewer.showError(`Failed to load video: ${error.message}`);
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
