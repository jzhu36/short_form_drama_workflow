# Video Generation Backend Service

Python Flask service that wraps OpenAI Sora-2 and Google Veo 3 APIs for video generation.

## Features

- **Dual Provider Support**: OpenAI Sora-2 and Google Veo 3
- **Job-based Architecture**: Async video generation with status polling
- **RESTful API**: Simple HTTP endpoints for the web frontend
- **Video Storage**: Automatic download and storage of generated videos

## Setup

### 1. Install Dependencies

```bash
cd backend
pip install -r ../requirements.txt
```

Or use the startup script which handles this automatically:

```bash
./start_backend.sh
```

### 2. Configure API Keys

Create a `.env` file in the project root or in the `ai-short-drama` directory:

```bash
# For OpenAI Sora-2
OPENAI_API_KEY=your_openai_api_key_here

# For Google Veo 3
GEMINI_API_KEY=your_gemini_api_key_here
```

**Note**: The backend imports `video_generator.py` from the `ai-short-drama` project, so make sure that project exists at `/Users/junmingz/claude_projects/ai-short-drama`.

## Running the Service

### Option 1: Using the startup script (recommended)

```bash
cd backend
./start_backend.sh
```

### Option 2: Manual start

```bash
cd backend
python video_service.py
```

The service will start on `http://localhost:5001`.

## API Endpoints

### Generate Video

```http
POST /api/videos/generate
Content-Type: application/json

{
  "prompt": "A serene mountain landscape at sunset",
  "provider": "google",  // or "openai"
  "settings": {
    // For Google Veo 3:
    "model": "veo-3.0-generate-001",
    "aspect_ratio": "16:9"

    // For OpenAI Sora-2:
    // "seconds": "8",
    // "size": "720x1280"
  }
}
```

Response:
```json
{
  "job_id": "uuid-here",
  "status": "pending",
  "message": "Video generation started"
}
```

### Check Job Status

```http
GET /api/videos/{job_id}/status
```

Response:
```json
{
  "id": "uuid-here",
  "status": "completed",  // pending, processing, completed, failed
  "progress": 100,
  "video_url": "/api/videos/{job_id}/download",
  "prompt": "Original prompt",
  "provider": "google",
  "created_at": "2025-10-12T...",
  "completed_at": "2025-10-12T..."
}
```

### Download Video

```http
GET /api/videos/{job_id}/download
```

Returns video file (video/mp4).

### List All Jobs

```http
GET /api/videos/list
```

Response:
```json
{
  "jobs": [...],
  "total": 5
}
```

### Delete Job

```http
DELETE /api/videos/{job_id}
```

Deletes job and associated video file.

## Provider Details

### OpenAI Sora-2

- **Duration**: 4, 8, or 12 seconds
- **Sizes**: 720x1280 (vertical), 1280x720 (horizontal), 1024x1792, 1792x1024
- **Requirements**: Organization verification required
- **API Key**: Set `OPENAI_API_KEY` in `.env`

### Google Veo 3

- **Duration**: Fixed 8 seconds
- **Models**:
  - `veo-3.0-generate-001` (High quality + audio)
  - `veo-3.0-fast-generate-001` (Faster generation)
- **Aspect Ratios**: 16:9 (widescreen), 9:16 (portrait), 1:1 (square)
- **API Key**: Set `GEMINI_API_KEY` in `.env`

## Architecture

The backend uses:

1. **Flask**: Web framework
2. **Threading**: Background job processing (use Celery/RQ for production)
3. **video_generator.py**: Core video generation logic from `ai-short-drama` project
4. **In-memory job storage**: Simple dict (use Redis/database for production)

## Production Considerations

For production deployment, consider:

- [ ] Replace threading with Celery/RQ for background jobs
- [ ] Use Redis or database for job state persistence
- [ ] Add authentication/authorization
- [ ] Implement rate limiting
- [ ] Add video storage to S3/GCS instead of local filesystem
- [ ] Use proper logging and monitoring
- [ ] Add input validation and sanitization
- [ ] Handle concurrent requests properly
- [ ] Implement job cleanup/expiration

## Troubleshooting

### Backend won't start

1. Check Python version (3.8+)
2. Verify all dependencies installed: `pip install -r requirements.txt`
3. Check if port 5001 is available

### Video generation fails

1. Verify API keys in `.env` file
2. Check API key permissions
3. For OpenAI: Ensure organization is verified
4. Check backend logs for detailed errors

### Cannot import video_generator

The backend imports from `ai-short-drama` project. Update the path in `video_service.py` line 16:

```python
sys.path.insert(0, '/path/to/your/ai-short-drama')
```
