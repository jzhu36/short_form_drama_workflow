/**
 * Sora2Client - Video Generation API Client
 * Connects to Python backend service that wraps OpenAI Sora-2 and Google Veo 3 APIs
 */

export class Sora2Client {
  constructor(debugPanel = null) {
    this.baseUrl = '/api/videos';
    this.pollingInterval = 3000; // 3 seconds
    this.debug = debugPanel;
  }

  /**
   * Initialize the client (no-op now, but kept for API compatibility)
   */
  async initialize() {
    try {
      this.debug?.logInfo('Initializing Sora2Client...');

      // Check backend health
      const response = await fetch('/health');
      if (response.ok) {
        console.log('Backend service is healthy');
        this.debug?.logSuccess('Sora2Client initialized successfully');
        return true;
      } else {
        throw new Error('Backend service is not responding');
      }
    } catch (error) {
      console.error('Failed to initialize Sora2Client:', error);
      this.debug?.logError('Failed to initialize Sora2Client', error);
      // Don't throw - allow client to continue, backend might start later
      return false;
    }
  }

  /**
   * Generate a video from a text prompt
   * @param {string} prompt - The text prompt for video generation
   * @param {Object} options - Generation options
   * @param {string} options.provider - 'openai' or 'google' (default: 'google')
   * @param {Object} options.settings - Provider-specific settings
   * @returns {Promise<Object>} Response containing job ID
   */
  async generateVideo(prompt, options = {}) {
    const { provider = 'google', settings = {} } = options;

    // Set default settings based on provider
    const defaultSettings = provider === 'openai'
      ? { seconds: '8', size: '720x1280' }
      : { model: 'veo-3.0-generate-001', aspect_ratio: '16:9' };

    const requestBody = {
      prompt,
      provider,
      settings: { ...defaultSettings, ...settings }
    };

    this.debug?.logRequest('POST', `${this.baseUrl}/generate`, requestBody);

    try {
      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.debug?.logResponse(response.status, `${this.baseUrl}/generate`, errorData);
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Video generation started:', data);
      this.debug?.logResponse(response.status, `${this.baseUrl}/generate`, data);
      this.debug?.logSuccess(`Video generation started with job ID: ${data.job_id}`);
      return data;
    } catch (error) {
      console.error('Failed to generate video:', error);
      this.debug?.logError('Failed to generate video', error);
      throw error;
    }
  }

  /**
   * List all video generation jobs
   * @returns {Promise<Array>} Array of job objects
   */
  async listVideos() {
    this.debug?.logRequest('GET', `${this.baseUrl}/list`);

    try {
      const response = await fetch(`${this.baseUrl}/list`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.debug?.logResponse(response.status, `${this.baseUrl}/list`, errorData);
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }

      const data = await response.json();
      this.debug?.logResponse(response.status, `${this.baseUrl}/list`, data);
      this.debug?.logSuccess(`Found ${data.jobs?.length || 0} videos`);

      // Transform to match expected format with output structure
      return (data.jobs || []).map(job => ({
        id: job.id,
        prompt: job.prompt,
        status: job.status,
        provider: job.provider,
        created_at: job.created_at,
        output: job.status === 'completed' ? {
          url: job.video_url
        } : null
      }));
    } catch (error) {
      console.error('Failed to list videos:', error);
      this.debug?.logError('Failed to list videos', error);
      throw error;
    }
  }

  /**
   * Check the status of a video generation job
   * @param {string} jobId - The job ID from generateVideo response
   * @returns {Promise<Object>} Status object
   */
  async checkStatus(jobId) {
    this.debug?.logRequest('GET', `${this.baseUrl}/${jobId}/status`);

    try {
      const response = await fetch(`${this.baseUrl}/${jobId}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.debug?.logResponse(response.status, `${this.baseUrl}/${jobId}/status`, errorData);
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }

      const data = await response.json();
      console.log('Job status:', data);
      this.debug?.logResponse(response.status, `${this.baseUrl}/${jobId}/status`, data);
      this.debug?.logInfo(`Job ${jobId} status: ${data.status} (${data.progress}%)`);
      return data;
    } catch (error) {
      console.error('Failed to check status:', error);
      this.debug?.logError('Failed to check status', error);
      throw error;
    }
  }

  /**
   * Poll for job completion
   * @param {string} jobId - The job ID to poll
   * @param {Function} onProgress - Callback for progress updates
   * @returns {Promise<Object>} Final status object
   */
  async pollUntilComplete(jobId, onProgress = null) {
    const poll = async () => {
      const status = await this.checkStatus(jobId);

      if (onProgress) {
        onProgress(status);
      }

      // Check if job is complete
      if (status.status === 'completed' && status.video_url) {
        return status;
      }

      // Check if job failed
      if (status.status === 'failed') {
        throw new Error(`Video generation failed: ${status.error || 'Unknown error'}`);
      }

      // Continue polling if still processing
      if (status.status === 'pending' || status.status === 'processing') {
        await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
        return poll();
      }

      // Unknown status
      throw new Error(`Unknown status: ${status.status}`);
    };

    return poll();
  }

  /**
   * Download video from URL
   * @param {string} url - The video download URL (relative or absolute)
   * @returns {Promise<Blob>} Video blob
   */
  async downloadVideo(url) {
    this.debug?.logRequest('GET', url);

    try {
      const response = await fetch(url);

      if (!response.ok) {
        this.debug?.logResponse(response.status, url);
        throw new Error(`Failed to download video: ${response.status}`);
      }

      const blob = await response.blob();
      console.log('Video downloaded successfully, size:', blob.size);
      this.debug?.logResponse(response.status, url, { size: blob.size, type: blob.type });
      this.debug?.logSuccess(`Video downloaded successfully (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
      return blob;
    } catch (error) {
      console.error('Failed to download video:', error);
      this.debug?.logError('Failed to download video', error);
      throw error;
    }
  }

  /**
   * Complete workflow: Generate, poll, and download video
   * @param {string} prompt - The text prompt
   * @param {Function} onProgress - Progress callback
   * @param {Object} options - Generation options (provider, settings)
   * @returns {Promise<{videoBlob: Blob, metadata: Object}>}
   */
  async generateAndDownload(prompt, onProgress = null, options = {}) {
    try {
      // Step 1: Generate video
      if (onProgress) onProgress({ stage: 'generating', message: 'Starting video generation...' });
      const generateResponse = await this.generateVideo(prompt, options);
      const jobId = generateResponse.job_id;

      // Step 2: Poll for completion
      if (onProgress) onProgress({ stage: 'polling', message: 'Waiting for video generation...', jobId });
      const completedStatus = await this.pollUntilComplete(jobId, (status) => {
        if (onProgress) {
          const progressMsg = status.progress
            ? `${status.status} (${status.progress}%)`
            : status.status;
          onProgress({
            stage: 'polling',
            message: progressMsg,
            status: status
          });
        }
      });

      // Step 3: Download video
      if (onProgress) onProgress({ stage: 'downloading', message: 'Downloading video...' });
      const videoBlob = await this.downloadVideo(completedStatus.video_url);

      // Step 4: Complete
      if (onProgress) onProgress({ stage: 'complete', message: 'Video ready!' });

      return {
        videoBlob,
        metadata: {
          videoId: completedStatus.video_id || jobId,
          prompt,
          provider: completedStatus.provider,
          url: completedStatus.video_url,
          generatedAt: completedStatus.completed_at || new Date().toISOString()
        }
      };
    } catch (error) {
      if (onProgress) {
        onProgress({
          stage: 'error',
          message: error.message,
          error
        });
      }
      throw error;
    }
  }

  /**
   * Delete a job and its video file
   * @param {string} jobId - The job ID to delete
   * @returns {Promise<boolean>} Success status
   */
  async deleteJob(jobId) {
    this.debug?.logRequest('DELETE', `${this.baseUrl}/${jobId}`);

    try {
      const response = await fetch(`${this.baseUrl}/${jobId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        this.debug?.logResponse(response.status, `${this.baseUrl}/${jobId}`, errorData);
        throw new Error(errorData.error || `API Error: ${response.status}`);
      }

      const data = await response.json();
      this.debug?.logResponse(response.status, `${this.baseUrl}/${jobId}`, data);
      this.debug?.logSuccess(`Job ${jobId} deleted`);
      return true;
    } catch (error) {
      console.error('Failed to delete job:', error);
      this.debug?.logError('Failed to delete job', error);
      throw error;
    }
  }
}
