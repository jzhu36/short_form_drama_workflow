/**
 * VideoList Component
 * Displays a list of available videos from Sora API
 */

export class VideoList {
  constructor(containerId, onVideoSelect) {
    this.container = document.getElementById(containerId);
    this.onVideoSelect = onVideoSelect;
    this.videos = [];
    this.listElement = null;
    this.loadingElement = null;
  }

  /**
   * Initialize the component
   */
  initialize() {
    this.render();
    console.log('VideoList component initialized');
  }

  /**
   * Render the video list container
   */
  render() {
    this.container.innerHTML = `
      <div class="video-list-header">
        <h3>Available Videos</h3>
        <button id="refresh-videos-btn" class="btn-small">Refresh</button>
      </div>
      <div id="video-list-loading" class="video-list-loading" style="display: none;">
        <p>Loading videos...</p>
      </div>
      <div id="video-list-items" class="video-list-items"></div>
    `;

    this.listElement = document.getElementById('video-list-items');
    this.loadingElement = document.getElementById('video-list-loading');

    // Add refresh button handler
    document.getElementById('refresh-videos-btn').addEventListener('click', () => {
      if (this.onRefresh) {
        this.onRefresh();
      }
    });
  }

  /**
   * Set refresh callback
   */
  setRefreshCallback(callback) {
    this.onRefresh = callback;
  }

  /**
   * Show loading state
   */
  showLoading() {
    this.loadingElement.style.display = 'block';
    this.listElement.innerHTML = '';
  }

  /**
   * Hide loading state
   */
  hideLoading() {
    this.loadingElement.style.display = 'none';
  }

  /**
   * Update the video list
   * @param {Array} videos - Array of video objects from API
   */
  updateVideos(videos) {
    this.videos = videos;
    this.hideLoading();

    if (!videos || videos.length === 0) {
      this.listElement.innerHTML = '<p class="no-videos">No videos available</p>';
      return;
    }

    this.listElement.innerHTML = videos.map((video, index) => {
      const status = video.status || 'unknown';
      const statusClass = this.getStatusClass(status);
      const prompt = video.prompt || 'No prompt';
      const createdAt = video.created_at ? new Date(video.created_at * 1000).toLocaleString() : 'Unknown';
      const thumbnail = video.thumbnail_url || '';

      return `
        <div class="video-list-item ${statusClass}" data-index="${index}" data-video-id="${video.id}">
          ${thumbnail ? `<img src="${thumbnail}" alt="Thumbnail" class="video-thumbnail">` : '<div class="video-thumbnail-placeholder">📹</div>'}
          <div class="video-info">
            <div class="video-prompt">${this.escapeHtml(prompt.substring(0, 50))}${prompt.length > 50 ? '...' : ''}</div>
            <div class="video-meta">
              <span class="video-status ${statusClass}">${status}</span>
              <span class="video-date">${createdAt}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Add click handlers
    this.listElement.querySelectorAll('.video-list-item').forEach(item => {
      item.addEventListener('click', () => {
        const index = parseInt(item.dataset.index);
        const video = this.videos[index];
        if (this.onVideoSelect && video.status === 'completed') {
          this.onVideoSelect(video);
        }
      });
    });
  }

  /**
   * Get CSS class for status
   */
  getStatusClass(status) {
    const statusMap = {
      'completed': 'status-completed',
      'processing': 'status-processing',
      'pending': 'status-pending',
      'failed': 'status-failed',
      'error': 'status-error'
    };
    return statusMap[status] || 'status-unknown';
  }

  /**
   * Show error message
   */
  showError(message) {
    this.hideLoading();
    this.listElement.innerHTML = `<p class="video-list-error">${this.escapeHtml(message)}</p>`;
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
   * Clear the list
   */
  clear() {
    this.videos = [];
    this.listElement.innerHTML = '';
  }
}
