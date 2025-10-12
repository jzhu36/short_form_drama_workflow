/**
 * VideoViewer Component
 * Handles video playback and download functionality
 */

export class VideoViewer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.videoPlayer = null;
    this.statusElement = null;
    this.downloadBtn = null;
    this.currentVideoBlob = null;
    this.currentVideoUrl = null;
  }

  /**
   * Initialize the component
   */
  initialize() {
    this.videoPlayer = document.getElementById('video-player');
    this.statusElement = document.getElementById('video-status');
    this.downloadBtn = document.getElementById('download-btn');

    // Add download button handler
    this.downloadBtn.addEventListener('click', () => this.downloadVideo());

    console.log('VideoViewer component initialized');
  }

  /**
   * Load and display a video
   * @param {Blob} videoBlob - The video blob to display
   * @param {Object} metadata - Video metadata (optional)
   */
  loadVideo(videoBlob, metadata = {}) {
    // Revoke previous object URL to free memory
    if (this.currentVideoUrl) {
      URL.revokeObjectURL(this.currentVideoUrl);
    }

    this.currentVideoBlob = videoBlob;
    this.currentVideoUrl = URL.createObjectURL(videoBlob);

    // Update video source
    this.videoPlayer.src = this.currentVideoUrl;
    this.videoPlayer.style.display = 'block';
    this.statusElement.style.display = 'none';

    // Enable download button
    this.downloadBtn.disabled = false;

    // Store metadata
    this.currentMetadata = metadata;

    console.log('Video loaded successfully');
  }

  /**
   * Show status message
   * @param {string} message - Status message
   * @param {string} type - Message type (info, loading, error)
   */
  showStatus(message, type = 'info') {
    this.statusElement.textContent = message;
    this.statusElement.className = `video-status ${type}`;
    this.statusElement.style.display = 'block';
    this.videoPlayer.style.display = 'none';
    this.downloadBtn.disabled = true;
  }

  /**
   * Download the current video
   */
  downloadVideo() {
    if (!this.currentVideoBlob) {
      console.warn('No video to download');
      return;
    }

    const filename = this.generateFilename();
    const url = this.currentVideoUrl;

    // Create temporary anchor element for download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    console.log('Video download triggered:', filename);
  }

  /**
   * Generate filename for download
   */
  generateFilename() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const prompt = this.currentMetadata?.prompt || 'video';
    const cleanPrompt = prompt.slice(0, 30).replace(/[^a-zA-Z0-9]/g, '_');
    return `sora_${cleanPrompt}_${timestamp}.mp4`;
  }

  /**
   * Clear the video player
   */
  clear() {
    if (this.currentVideoUrl) {
      URL.revokeObjectURL(this.currentVideoUrl);
      this.currentVideoUrl = null;
    }

    this.currentVideoBlob = null;
    this.videoPlayer.src = '';
    this.videoPlayer.style.display = 'none';
    this.downloadBtn.disabled = true;
    this.showStatus('No video loaded', 'info');
  }

  /**
   * Show error
   */
  showError(message) {
    this.showStatus(message, 'error');
  }

  /**
   * Show loading state
   */
  showLoading(message = 'Loading video...') {
    this.showStatus(message, 'loading');
  }
}
