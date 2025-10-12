#!/usr/bin/env python3
"""
Video Generation Service - Flask Backend
Wraps the video_generator.py implementation for web API access
"""

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import os
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path
import logging

# Import video generator from ai-short-drama project
sys.path.insert(0, '/Users/junmingz/claude_projects/ai-short-drama')
from video_generator import VideoGenerator, download_video, download_with_curl

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for web client

# Video storage directory
VIDEO_DIR = Path(__file__).parent / 'videos'
VIDEO_DIR.mkdir(exist_ok=True)

# In-memory job tracking (replace with Redis/DB in production)
jobs = {}


class VideoGenerationJob:
    """Track video generation job status"""

    def __init__(self, job_id, prompt, provider, settings):
        self.job_id = job_id
        self.prompt = prompt
        self.provider = provider
        self.settings = settings
        self.status = 'pending'  # pending, processing, completed, failed
        self.progress = 0
        self.error = None
        self.video_id = None  # Provider's video/operation ID
        self.video_path = None
        self.video_url = None
        self.created_at = datetime.utcnow().isoformat()
        self.completed_at = None

    def to_dict(self):
        return {
            'id': self.job_id,
            'prompt': self.prompt,
            'provider': self.provider,
            'settings': self.settings,
            'status': self.status,
            'progress': self.progress,
            'error': self.error,
            'video_id': self.video_id,
            'video_url': self.video_url,
            'created_at': self.created_at,
            'completed_at': self.completed_at
        }


@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'video-generation'})


@app.route('/api/videos/generate', methods=['POST'])
def generate_video():
    """
    Generate a video from a text prompt

    Request body:
    {
        "prompt": "A serene mountain landscape",
        "provider": "openai" | "google",
        "settings": {
            // OpenAI specific
            "seconds": "8",
            "size": "720x1280",

            // Google specific
            "model": "veo-3.0-generate-001",
            "aspect_ratio": "16:9"
        }
    }
    """
    try:
        data = request.get_json()
        prompt = data.get('prompt')
        provider = data.get('provider', 'google')
        settings = data.get('settings', {})

        if not prompt:
            return jsonify({'error': 'Prompt is required'}), 400

        # Create job
        job_id = str(uuid.uuid4())
        job = VideoGenerationJob(job_id, prompt, provider, settings)
        jobs[job_id] = job

        logger.info(f"Created job {job_id} for prompt: {prompt[:50]}...")

        # Start generation in background (in production, use Celery/RQ)
        import threading
        thread = threading.Thread(target=_generate_video_async, args=(job_id,))
        thread.start()

        return jsonify({
            'job_id': job_id,
            'status': 'pending',
            'message': 'Video generation started'
        }), 202

    except Exception as e:
        logger.error(f"Failed to start generation: {str(e)}")
        return jsonify({'error': str(e)}), 500


def _generate_video_async(job_id):
    """Background task to generate video"""
    job = jobs.get(job_id)
    if not job:
        return

    try:
        job.status = 'processing'
        job.progress = 10

        # Initialize video generator
        logger.info(f"Job {job_id}: Initializing {job.provider} generator")
        generator = VideoGenerator(provider=job.provider)

        job.progress = 20

        # Generate video
        logger.info(f"Job {job_id}: Starting generation")
        result = generator.generate(job.prompt, **job.settings)

        if not result['success']:
            job.status = 'failed'
            job.error = result.get('error', 'Unknown error')
            logger.error(f"Job {job_id}: Generation failed - {job.error}")
            return

        job.progress = 80
        job.video_id = result.get('job_id') or result.get('operation_name')

        # Download video
        logger.info(f"Job {job_id}: Downloading video")
        video_filename = f"{job_id}.mp4"
        video_path = VIDEO_DIR / video_filename

        download_success = False

        if job.provider == 'openai':
            # OpenAI download
            from video_generator import download_openai_video
            download_success = download_openai_video(job.video_id, str(video_path))

        elif job.provider == 'google':
            # Google download
            if result.get('video_object'):
                download_success = download_video(result['video_object'], str(video_path))
            elif result.get('video_uri'):
                download_success = download_with_curl(result['video_uri'], str(video_path))

        if not download_success or not video_path.exists():
            job.status = 'failed'
            job.error = 'Failed to download video'
            logger.error(f"Job {job_id}: Download failed")
            return

        # Success
        job.status = 'completed'
        job.progress = 100
        job.video_path = str(video_path)
        job.video_url = f"/api/videos/{job_id}/download"
        job.completed_at = datetime.utcnow().isoformat()

        logger.info(f"Job {job_id}: Completed successfully")

    except Exception as e:
        job.status = 'failed'
        job.error = str(e)
        logger.error(f"Job {job_id}: Exception - {str(e)}")


@app.route('/api/videos/<job_id>/status', methods=['GET'])
def get_job_status(job_id):
    """Get status of a video generation job"""
    job = jobs.get(job_id)

    if not job:
        return jsonify({'error': 'Job not found'}), 404

    return jsonify(job.to_dict())


@app.route('/api/videos/<job_id>/download', methods=['GET'])
def download_video_file(job_id):
    """Download the generated video file"""
    job = jobs.get(job_id)

    if not job:
        return jsonify({'error': 'Job not found'}), 404

    if job.status != 'completed':
        return jsonify({'error': f'Job status: {job.status}'}), 400

    if not job.video_path or not Path(job.video_path).exists():
        return jsonify({'error': 'Video file not found'}), 404

    return send_file(
        job.video_path,
        mimetype='video/mp4',
        as_attachment=True,
        download_name=f'video_{job_id}.mp4'
    )


@app.route('/api/videos/list', methods=['GET'])
def list_jobs():
    """List all video generation jobs"""
    # Sort by created_at descending
    sorted_jobs = sorted(
        jobs.values(),
        key=lambda j: j.created_at,
        reverse=True
    )

    return jsonify({
        'jobs': [job.to_dict() for job in sorted_jobs],
        'total': len(jobs)
    })


@app.route('/api/videos/<job_id>', methods=['DELETE'])
def delete_job(job_id):
    """Delete a job and its video file"""
    job = jobs.get(job_id)

    if not job:
        return jsonify({'error': 'Job not found'}), 404

    # Delete video file if exists
    if job.video_path and Path(job.video_path).exists():
        Path(job.video_path).unlink()

    # Remove from jobs
    del jobs[job_id]

    return jsonify({'message': 'Job deleted successfully'})


if __name__ == '__main__':
    logger.info("Starting Video Generation Service...")
    logger.info(f"Video storage directory: {VIDEO_DIR}")
    app.run(host='0.0.0.0', port=5001, debug=True)
