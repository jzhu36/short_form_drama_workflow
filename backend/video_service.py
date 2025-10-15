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

# Import prompt generator
from prompt_generator import PromptGenerator

# Import video stitcher
from video_stitcher import VideoStitcher

# Import media manager
from media_manager import MediaManager
from video_metadata import VideoMetadataExtractor

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for web client

# Video storage directory
VIDEO_DIR = Path(__file__).parent / 'videos'
VIDEO_DIR.mkdir(exist_ok=True)

# Initialize Media Manager
media_manager = MediaManager(
    db_path=str(Path(__file__).parent / 'media.db'),
    video_dir=str(VIDEO_DIR)
)
metadata_extractor = VideoMetadataExtractor()

# In-memory job tracking (legacy - will be replaced by MediaManager)
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

        # Extract metadata
        try:
            video_metadata = metadata_extractor.extract_metadata(str(video_path))
        except Exception as e:
            logger.warning(f"Job {job_id}: Failed to extract metadata - {str(e)}")
            video_metadata = {
                'size_bytes': video_path.stat().st_size,
                'duration_seconds': None,
                'resolution': None,
                'aspect_ratio': None,
                'codec': None,
                'fps': None
            }

        # Add to media manager
        try:
            result = media_manager.add_video(
                video_id=job_id,
                name=f"Generated: {job.prompt[:50]}",
                file_path=str(video_path),
                size_bytes=video_metadata['size_bytes'],
                source_type='generated',
                duration_seconds=video_metadata.get('duration_seconds'),
                resolution=video_metadata.get('resolution'),
                aspect_ratio=video_metadata.get('aspect_ratio'),
                codec=video_metadata.get('codec'),
                fps=video_metadata.get('fps')
            )

            # Add generation details
            media_manager.add_generation_details(
                video_id=job_id,
                provider=job.provider,
                prompt=job.prompt,
                model=job.settings.get('model'),
                generation_params=job.settings,
                job_id=job.video_id,
                status='completed',
                completed_at=datetime.utcnow().isoformat()
            )

            logger.info(f"Job {job_id}: Added to MediaManager (duplicate: {result.get('is_duplicate', False)})")
        except Exception as e:
            logger.error(f"Job {job_id}: Failed to add to MediaManager - {str(e)}")

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


@app.route('/api/videos/upload', methods=['POST'])
def upload_video():
    """
    Upload a video file temporarily for use in stitching

    Expects multipart/form-data with a 'video' file field

    Response:
    {
        "success": true,
        "job_id": "uploaded_job_id",
        "filename": "uploaded_video.mp4",
        "size": 12345678
    }
    """
    try:
        # Check if video file is present
        if 'video' not in request.files:
            return jsonify({'error': 'No video file provided'}), 400

        video_file = request.files['video']

        if video_file.filename == '':
            return jsonify({'error': 'No video file selected'}), 400

        # Generate job ID for this upload
        job_id = str(uuid.uuid4())

        # Save video to disk
        video_filename = f"{job_id}.mp4"
        video_path = VIDEO_DIR / video_filename
        video_file.save(str(video_path))

        # Get file size
        file_size = video_path.stat().st_size

        # Extract metadata
        try:
            video_metadata = metadata_extractor.extract_metadata(str(video_path))
        except Exception as e:
            logger.warning(f"Failed to extract metadata for uploaded video - {str(e)}")
            video_metadata = {
                'size_bytes': file_size,
                'duration_seconds': None,
                'resolution': None,
                'aspect_ratio': None,
                'codec': None,
                'fps': None
            }

        # Add to media manager with deduplication
        try:
            result = media_manager.add_video(
                video_id=job_id,
                name=video_file.filename or "Uploaded video",
                file_path=str(video_path),
                size_bytes=video_metadata['size_bytes'],
                source_type='uploaded',
                duration_seconds=video_metadata.get('duration_seconds'),
                resolution=video_metadata.get('resolution'),
                aspect_ratio=video_metadata.get('aspect_ratio'),
                codec=video_metadata.get('codec'),
                fps=video_metadata.get('fps')
            )

            # If duplicate detected, use the existing video ID
            if result.get('is_duplicate'):
                actual_video_id = result['original_id']
                logger.info(f"Duplicate video detected, using existing ID: {actual_video_id}")

                # Delete the newly uploaded file since it's a duplicate
                if video_path.exists():
                    video_path.unlink()

                # Get the existing video info
                existing_video = media_manager.get_video(actual_video_id)
                if existing_video:
                    video_path = Path(existing_video['file_path'])
                    job_id = actual_video_id
            else:
                logger.info(f"Video uploaded and added to MediaManager: {video_filename}")
        except Exception as e:
            logger.error(f"Failed to add uploaded video to MediaManager - {str(e)}")

        # Create a job entry for the uploaded video
        uploaded_job = VideoGenerationJob(
            job_id,
            "Uploaded video",
            "upload",
            {}
        )
        uploaded_job.status = 'completed'
        uploaded_job.progress = 100
        uploaded_job.video_path = str(video_path)
        uploaded_job.video_url = f"/api/videos/{job_id}/download"
        uploaded_job.completed_at = datetime.utcnow().isoformat()

        jobs[job_id] = uploaded_job

        logger.info(f"Video upload processed: {video_filename} ({file_size} bytes)")

        return jsonify({
            'success': True,
            'job_id': job_id,
            'filename': video_path.name,
            'size': file_size,
            'is_duplicate': result.get('is_duplicate', False) if 'result' in locals() else False
        })

    except Exception as e:
        logger.error(f"Failed to upload video: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/prompts/generate', methods=['POST'])
def generate_prompts():
    """
    Generate multiple prompts using GPT API

    Request body:
    {
        "system_prompt": "You are an expert film director...",
        "user_prompt": "Generate prompts for...",
        "prompt_count": 5,
        "temperature": 0.7,  // optional
        "max_tokens": 2000   // optional
    }

    Response:
    {
        "prompts": ["prompt 1", "prompt 2", ...],
        "count": 5,
        "success": true
    }
    """
    try:
        data = request.get_json()

        # Extract required parameters
        system_prompt = data.get('system_prompt')
        user_prompt = data.get('user_prompt')
        prompt_count = data.get('prompt_count')

        # Validate required parameters
        if not system_prompt:
            return jsonify({'error': 'system_prompt is required'}), 400
        if not user_prompt:
            return jsonify({'error': 'user_prompt is required'}), 400
        if not prompt_count:
            return jsonify({'error': 'prompt_count is required'}), 400

        # Extract optional parameters
        temperature = data.get('temperature')
        max_tokens = data.get('max_tokens')

        logger.info(f"Generating {prompt_count} prompts with GPT")

        # Initialize prompt generator (will use OPENAI_API_KEY from env)
        generator = PromptGenerator()

        # Generate prompts
        prompts = generator.generate_prompts(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            prompt_count=prompt_count,
            temperature=temperature,
            max_tokens=max_tokens
        )

        logger.info(f"Successfully generated {len(prompts)} prompts")

        return jsonify({
            'success': True,
            'prompts': prompts,
            'count': len(prompts)
        })

    except ValueError as e:
        # Validation errors from PromptGenerator
        logger.error(f"Validation error: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 400

    except Exception as e:
        logger.error(f"Failed to generate prompts: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/prompts/generate-episodes', methods=['POST'])
def generate_episode_prompts():
    """
    Generate episode prompts for short form drama

    Convenience endpoint with pre-configured system prompt for film directors.

    Request body:
    {
        "outline": "Story outline text...",
        "episode_count": 10,
        "temperature": 0.7  // optional
    }

    Response:
    {
        "prompts": ["episode 1 prompt", "episode 2 prompt", ...],
        "count": 10,
        "success": true
    }
    """
    try:
        data = request.get_json()

        # Extract parameters
        outline = data.get('outline')
        episode_count = data.get('episode_count')
        temperature = data.get('temperature')

        # Validate required parameters
        if not outline:
            return jsonify({'error': 'outline is required'}), 400
        if not episode_count:
            return jsonify({'error': 'episode_count is required'}), 400

        logger.info(f"Generating {episode_count} episode prompts")

        # Initialize prompt generator
        generator = PromptGenerator()

        # Generate episode prompts using convenience method
        prompts = generator.generate_episode_prompts(
            outline=outline,
            episode_count=episode_count,
            temperature=temperature
        )

        logger.info(f"Successfully generated {len(prompts)} episode prompts")

        return jsonify({
            'success': True,
            'prompts': prompts,
            'count': len(prompts)
        })

    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 400

    except Exception as e:
        logger.error(f"Failed to generate episode prompts: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/videos/stitch', methods=['POST'])
def stitch_videos():
    """
    Stitch multiple videos together

    Request body:
    {
        "video_ids": ["job_id1", "job_id2", "job_id3"],  // List of job IDs or file paths
        "normalize": true,  // Optional, default: true
        "target_resolution": "1920x1080"  // Optional
    }

    Response:
    {
        "success": true,
        "job_id": "stitched_job_id",
        "output_path": "/path/to/stitched.mp4",
        "duration": 30.5,
        "size": 12345678,
        "resolution": "1920x1080",
        "input_count": 3
    }
    """
    try:
        data = request.get_json()
        video_ids = data.get('video_ids', [])
        normalize = data.get('normalize', True)
        target_resolution = data.get('target_resolution')

        # Validate input
        if not video_ids or len(video_ids) == 0:
            return jsonify({'error': 'video_ids is required and must not be empty'}), 400

        if len(video_ids) > 100:
            return jsonify({'error': 'Too many videos (max 100)'}), 400

        logger.info(f"Stitching {len(video_ids)} videos together")

        # Resolve video paths from job IDs
        video_paths = []
        for video_id in video_ids:
            # Check if it's a job ID
            job = jobs.get(video_id)
            if job and job.video_path and Path(job.video_path).exists():
                video_paths.append(job.video_path)
            # Check if it's a direct file path
            elif Path(video_id).exists():
                video_paths.append(str(video_id))
            # Check if it's a filename in VIDEO_DIR
            elif (VIDEO_DIR / video_id).exists():
                video_paths.append(str(VIDEO_DIR / video_id))
            else:
                return jsonify({'error': f'Video not found: {video_id}'}), 404

        if len(video_paths) == 0:
            return jsonify({'error': 'No valid video files found'}), 400

        # Initialize video stitcher
        stitcher = VideoStitcher(output_dir=str(VIDEO_DIR))

        # Stitch videos
        result = stitcher.stitch_videos(
            input_videos=video_paths,
            normalize=normalize,
            target_resolution=target_resolution
        )

        # Extract metadata for the stitched video
        stitched_path = result['output_path']
        try:
            video_metadata = metadata_extractor.extract_metadata(stitched_path)
        except Exception as e:
            logger.warning(f"Failed to extract metadata for stitched video - {str(e)}")
            video_metadata = {
                'size_bytes': Path(stitched_path).stat().st_size,
                'duration_seconds': result.get('duration'),
                'resolution': result.get('resolution'),
                'aspect_ratio': None,
                'codec': result.get('codec'),
                'fps': None
            }

        # Create a job entry for the stitched video
        stitched_job_id = str(uuid.uuid4())

        # Add to media manager
        try:
            mm_result = media_manager.add_video(
                video_id=stitched_job_id,
                name=f"Stitched video from {len(video_paths)} inputs",
                file_path=stitched_path,
                size_bytes=video_metadata['size_bytes'],
                source_type='stitched',
                duration_seconds=video_metadata.get('duration_seconds'),
                resolution=video_metadata.get('resolution'),
                aspect_ratio=video_metadata.get('aspect_ratio'),
                codec=video_metadata.get('codec'),
                fps=video_metadata.get('fps'),
                metadata={
                    'input_count': len(video_paths),
                    'input_video_ids': video_ids,
                    'normalize': normalize,
                    'target_resolution': target_resolution
                }
            )
            logger.info(f"Stitched video added to MediaManager: {stitched_job_id}")
        except Exception as e:
            logger.error(f"Failed to add stitched video to MediaManager - {str(e)}")

        # Create legacy job entry
        stitched_job = VideoGenerationJob(
            stitched_job_id,
            f"Stitched video from {len(video_paths)} inputs",
            "stitcher",
            {"input_count": len(video_paths)}
        )
        stitched_job.status = 'completed'
        stitched_job.progress = 100
        stitched_job.video_path = result['output_path']
        stitched_job.video_url = f"/api/videos/{stitched_job_id}/download"
        stitched_job.completed_at = datetime.utcnow().isoformat()

        jobs[stitched_job_id] = stitched_job

        logger.info(f"Successfully stitched videos: {result['output_path']}")

        return jsonify({
            'success': True,
            'job_id': stitched_job_id,
            'output_path': result['output_path'],
            'filename': result['filename'],
            'duration': result['duration'],
            'size': result['size'],
            'resolution': result['resolution'],
            'codec': result['codec'],
            'input_count': result['input_count'],
            'video_url': stitched_job.video_url
        })

    except FileNotFoundError as e:
        logger.error(f"File not found: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 404

    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 400

    except RuntimeError as e:
        logger.error(f"Stitching failed: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500

    except Exception as e:
        logger.error(f"Failed to stitch videos: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/workflows', methods=['POST'])
def create_workflow():
    """
    Create or save a workflow

    Request body:
    {
        "workflow_id": "optional-uuid",  // If not provided, one will be generated
        "name": "My Workflow",
        "description": "Optional description",
        "status": "draft" | "saved",
        "definition": {
            "nodes": [...],
            "connections": [...]
        }
    }
    """
    try:
        data = request.get_json()

        workflow_id = data.get('workflow_id') or str(uuid.uuid4())
        name = data.get('name', 'Untitled Workflow')
        description = data.get('description', '')
        status = data.get('status', 'draft')
        definition = data.get('definition')

        if not definition:
            return jsonify({'error': 'Workflow definition is required'}), 400

        # Check if workflow exists
        existing = media_manager.get_workflow(workflow_id)

        if existing:
            # Update existing workflow
            media_manager.update_workflow(
                workflow_id=workflow_id,
                name=name,
                description=description,
                status=status,
                definition=definition
            )
            logger.info(f"Updated workflow: {workflow_id}")
        else:
            # Create new workflow
            workflow = media_manager.create_workflow(
                workflow_id=workflow_id,
                name=name,
                description=description,
                definition=definition,
                status=status
            )
            logger.info(f"Created workflow: {workflow_id}")

        return jsonify({
            'success': True,
            'workflow_id': workflow_id,
            'status': status
        })

    except Exception as e:
        logger.error(f"Failed to create/update workflow: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/workflows/<workflow_id>', methods=['GET'])
def get_workflow(workflow_id):
    """Get a workflow by ID with associated videos"""
    try:
        workflow = media_manager.get_workflow(workflow_id)

        if not workflow:
            return jsonify({'error': 'Workflow not found'}), 404

        return jsonify({
            'success': True,
            'workflow': workflow
        })

    except Exception as e:
        logger.error(f"Failed to get workflow: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/workflows', methods=['GET'])
def list_workflows():
    """List all workflows with optional status filter"""
    try:
        status = request.args.get('status')  # Optional filter: 'draft' or 'saved'

        workflows = media_manager.list_workflows(status=status)

        return jsonify({
            'success': True,
            'workflows': workflows,
            'count': len(workflows)
        })

    except Exception as e:
        logger.error(f"Failed to list workflows: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/workflows/<workflow_id>', methods=['PUT'])
def update_workflow(workflow_id):
    """
    Update a workflow

    Request body can contain any of:
    {
        "name": "Updated name",
        "description": "Updated description",
        "status": "saved",
        "definition": {...}
    }
    """
    try:
        data = request.get_json()

        # Check if workflow exists
        existing = media_manager.get_workflow(workflow_id)
        if not existing:
            return jsonify({'error': 'Workflow not found'}), 404

        # Update workflow
        media_manager.update_workflow(
            workflow_id=workflow_id,
            name=data.get('name'),
            description=data.get('description'),
            status=data.get('status'),
            definition=data.get('definition')
        )

        logger.info(f"Updated workflow: {workflow_id}")

        return jsonify({
            'success': True,
            'workflow_id': workflow_id
        })

    except Exception as e:
        logger.error(f"Failed to update workflow: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/workflows/<workflow_id>', methods=['DELETE'])
def delete_workflow(workflow_id):
    """Delete a workflow (does not delete associated videos)"""
    try:
        existing = media_manager.get_workflow(workflow_id)
        if not existing:
            return jsonify({'error': 'Workflow not found'}), 404

        media_manager.delete_workflow(workflow_id)

        logger.info(f"Deleted workflow: {workflow_id}")

        return jsonify({
            'success': True,
            'message': 'Workflow deleted successfully'
        })

    except Exception as e:
        logger.error(f"Failed to delete workflow: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500


@app.route('/api/workflows/<workflow_id>/videos', methods=['POST'])
def associate_workflow_video(workflow_id):
    """
    Associate a video with a workflow node

    Request body:
    {
        "video_id": "video-uuid",
        "node_id": "node-id",
        "node_type": "Sora2Video",
        "role": "output" | "input" | "intermediate",
        "execution_id": "optional-execution-id"
    }
    """
    try:
        data = request.get_json()

        video_id = data.get('video_id')
        node_id = data.get('node_id')
        node_type = data.get('node_type')
        role = data.get('role', 'output')
        execution_id = data.get('execution_id')

        if not all([video_id, node_id, node_type]):
            return jsonify({'error': 'video_id, node_id, and node_type are required'}), 400

        media_manager.associate_video_with_workflow(
            workflow_id=workflow_id,
            video_id=video_id,
            node_id=node_id,
            node_type=node_type,
            role=role,
            execution_id=execution_id
        )

        logger.info(f"Associated video {video_id} with workflow {workflow_id} node {node_id}")

        return jsonify({
            'success': True,
            'message': 'Video associated with workflow'
        })

    except Exception as e:
        logger.error(f"Failed to associate video with workflow: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500


if __name__ == '__main__':
    logger.info("Starting Video Generation Service...")
    logger.info(f"Video storage directory: {VIDEO_DIR}")
    app.run(host='0.0.0.0', port=5001, debug=True)
