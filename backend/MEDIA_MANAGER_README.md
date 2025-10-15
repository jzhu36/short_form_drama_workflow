# Media Manager Documentation

## Overview

The Media Manager is a comprehensive video and workflow management system for the Short Form Drama Workflow application. It provides:

1. **Video Asset Management** - Track all uploaded and generated videos with complete metadata
2. **Deduplication** - Automatically detect and prevent duplicate video storage
3. **Workflow Management** - Save and restore workflows with associated video outputs
4. **Persistent Storage** - SQLite database for reliable data persistence

## Architecture

### Components

1. **MediaManager** (`media_manager.py`)
   - Core management class
   - SQLite database operations
   - Video and workflow CRUD operations

2. **VideoMetadataExtractor** (`video_metadata.py`)
   - FFprobe-based metadata extraction
   - Extracts: duration, resolution, aspect ratio, codec, FPS, bitrate

3. **Database Schema**
   - `videos` - Video files and metadata
   - `video_generation` - Generation details (provider, prompt, model)
   - `workflows` - Workflow definitions and state
   - `workflow_executions` - Execution history
   - `workflow_videos` - Video-workflow associations

## Database Schema

### Videos Table
```sql
CREATE TABLE videos (
    id TEXT PRIMARY KEY,              -- UUID
    name TEXT NOT NULL,                -- Display name
    file_path TEXT NOT NULL UNIQUE,    -- Path to video file
    file_hash TEXT NOT NULL,           -- SHA256 hash for deduplication
    size_bytes INTEGER NOT NULL,       -- File size
    duration_seconds REAL,             -- Video duration
    resolution TEXT,                   -- e.g., '1920x1080'
    aspect_ratio TEXT,                 -- e.g., '16:9'
    codec TEXT,                        -- Video codec
    fps REAL,                          -- Frames per second
    source_type TEXT NOT NULL,         -- 'generated', 'uploaded', 'stitched'
    created_at TIMESTAMP,
    metadata JSON                      -- Additional metadata
);
```

### Workflows Table
```sql
CREATE TABLE workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft',       -- 'draft' or 'saved'
    definition JSON NOT NULL,          -- Workflow graph (nodes, connections)
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    last_executed_at TIMESTAMP
);
```

### Workflow-Video Associations
```sql
CREATE TABLE workflow_videos (
    workflow_id TEXT NOT NULL,
    video_id TEXT NOT NULL,
    node_id TEXT NOT NULL,             -- Which node produced this video
    node_type TEXT NOT NULL,           -- 'Sora2Video', 'VideoStitcher', etc.
    role TEXT NOT NULL,                -- 'output', 'input', 'intermediate'
    execution_id TEXT,
    created_at TIMESTAMP,
    PRIMARY KEY (workflow_id, video_id, node_id)
);
```

## Usage Examples

### 1. Initialize MediaManager

```python
from media_manager import MediaManager
from video_metadata import VideoMetadataExtractor

mm = MediaManager(
    db_path='backend/media.db',
    video_dir='backend/videos'
)
```

### 2. Add a Video with Metadata

```python
# Extract metadata
metadata_extractor = VideoMetadataExtractor()
video_metadata = metadata_extractor.extract_metadata('/path/to/video.mp4')

# Add to database
result = mm.add_video(
    video_id=str(uuid.uuid4()),
    name='My Video',
    file_path='/path/to/video.mp4',
    size_bytes=video_metadata['size_bytes'],
    source_type='uploaded',
    duration_seconds=video_metadata['duration_seconds'],
    resolution=video_metadata['resolution'],
    aspect_ratio=video_metadata['aspect_ratio'],
    codec=video_metadata['codec'],
    fps=video_metadata['fps'],
    metadata={'custom_field': 'value'}
)

# Check if duplicate
if result['is_duplicate']:
    print(f"Video already exists with ID: {result['original_id']}")
    # Use existing video instead of storing duplicate
else:
    print(f"New video added with ID: {result['video_id']}")
```

### 3. Add Generation Details

```python
mm.add_generation_details(
    video_id=video_id,
    provider='openai',
    model='sora-2.0',
    prompt='A serene mountain landscape',
    generation_params={'seconds': 8, 'size': '720x1280'},
    job_id='job-abc123',
    status='completed',
    completed_at=datetime.utcnow().isoformat()
)
```

### 4. Create and Save Workflow

```python
# Create draft workflow
workflow_id = str(uuid.uuid4())
mm.create_workflow(
    workflow_id=workflow_id,
    name='Episode Generation Workflow',
    description='Generates and stitches drama episodes',
    definition={
        'nodes': [
            {'id': 'node1', 'type': 'TextInput'},
            {'id': 'node2', 'type': 'PromptGenerator'},
            {'id': 'node3', 'type': 'Sora2Video'},
            {'id': 'node4', 'type': 'VideoStitcher'}
        ],
        'connections': [
            {'from': 'node1-output-0', 'to': 'node2-input-0'},
            {'from': 'node2-output-0', 'to': 'node3-input-0'},
            {'from': 'node3-output-0', 'to': 'node4-input-0'}
        ]
    },
    status='draft'  # Initially a draft
)

# Associate generated videos with workflow
mm.associate_video_with_workflow(
    workflow_id=workflow_id,
    video_id=video_id,
    node_id='node3',
    node_type='Sora2Video',
    role='output'
)

# Save workflow (change status)
mm.update_workflow(
    workflow_id=workflow_id,
    status='saved'
)
```

### 5. Load Workflow with Videos

```python
# Retrieve workflow
workflow = mm.get_workflow(workflow_id)

print(f"Workflow: {workflow['name']}")
print(f"Status: {workflow['status']}")
print(f"Associated videos: {len(workflow['videos'])}")

for video in workflow['videos']:
    print(f"  - {video['name']} from {video['node_type']} (node: {video['node_id']})")
    print(f"    File: {video['file_path']}")
    print(f"    Resolution: {video['resolution']}")
```

### 6. Track Workflow Execution

```python
# Start execution
execution_id = str(uuid.uuid4())
mm.create_workflow_execution(
    execution_id=execution_id,
    workflow_id=workflow_id,
    status='running'
)

# ... run workflow ...

# Update on completion
mm.update_workflow_execution(
    execution_id=execution_id,
    status='completed',
    execution_data={'total_videos': 5, 'duration': 45.2}
)

# Associate videos with this execution
mm.associate_video_with_workflow(
    workflow_id=workflow_id,
    video_id=new_video_id,
    node_id='node4',
    node_type='VideoStitcher',
    role='output',
    execution_id=execution_id
)
```

### 7. Query Videos

```python
# List all videos
all_videos = mm.list_videos()

# Filter by source type
uploaded_videos = mm.list_videos(source_type='uploaded')
generated_videos = mm.list_videos(source_type='generated')

# Get videos for a specific workflow
workflow_videos = mm.list_videos(workflow_id=workflow_id)

# Get specific video
video = mm.get_video(video_id)
print(f"Video: {video['name']}")
print(f"Duration: {video['duration_seconds']}s")
print(f"Resolution: {video['resolution']}")
if 'generation' in video:
    print(f"Generated by: {video['generation']['provider']}")
    print(f"Prompt: {video['generation']['prompt']}")
```

### 8. Get Statistics

```python
stats = mm.get_workflow_stats()

print(f"Total Storage: {stats['total_storage_bytes']} bytes")
print(f"Videos by source: {stats['videos_by_source']}")
print(f"Workflows by status: {stats['workflows_by_status']}")
```

## Deduplication Strategy

The MediaManager uses **content-based deduplication** with SHA256 hashing:

1. **Calculate hash** - When adding a video, calculate SHA256 hash of file content
2. **Check duplicates** - Query database for existing videos with same hash
3. **Return existing** - If duplicate found, return existing video ID instead of creating new entry
4. **Save storage** - Original file is reused, no duplicate storage

### Benefits:
- ✅ Saves disk space
- ✅ Prevents data duplication
- ✅ Fast lookup with indexed hash
- ✅ Content-based (ignores filename/path)

### Example:
```python
# Upload same video twice
video1 = mm.add_video(video_id='id1', name='Video', file_path='v1.mp4', ...)
# Returns: {'video_id': 'id1', 'is_duplicate': False}

video2 = mm.add_video(video_id='id2', name='Video Copy', file_path='v1.mp4', ...)
# Returns: {'video_id': 'id1', 'is_duplicate': True, 'original_id': 'id1'}

# Both IDs point to same file - no duplicate storage!
```

## Workflow State Management

### Draft vs Saved

- **Draft**: Working workflow, not persisted with videos
  - Can be modified freely
  - Videos not associated yet
  - Lost if browser closed (unless saved)

- **Saved**: Persistent workflow with video associations
  - Videos are associated with nodes
  - Can be loaded later with all outputs
  - Tracked in database

### Workflow Lifecycle

```
1. Create → status='draft'
2. Build workflow graph (add nodes, connections)
3. Execute workflow → generates videos
4. Save → status='saved', associate videos
5. Load → restore graph + videos
6. Re-execute → new execution record
```

## Integration with video_service.py

To integrate MediaManager into your Flask service:

```python
from media_manager import MediaManager
from video_metadata import VideoMetadataExtractor

# Initialize in video_service.py
media_manager = MediaManager(
    db_path='backend/media.db',
    video_dir=str(VIDEO_DIR)
)
metadata_extractor = VideoMetadataExtractor()

# When video is generated
def _generate_video_async(job_id):
    # ... existing generation code ...

    # Extract metadata
    video_metadata = metadata_extractor.extract_metadata(str(video_path))

    # Add to media manager
    result = media_manager.add_video(
        video_id=job_id,
        name=f"Generated: {job.prompt[:50]}",
        file_path=str(video_path),
        size_bytes=video_metadata['size_bytes'],
        source_type='generated',
        duration_seconds=video_metadata['duration_seconds'],
        resolution=video_metadata['resolution'],
        aspect_ratio=video_metadata['aspect_ratio'],
        codec=video_metadata['codec'],
        fps=video_metadata['fps']
    )

    # Add generation details
    media_manager.add_generation_details(
        video_id=job_id,
        provider=job.provider,
        prompt=job.prompt,
        generation_params=job.settings,
        job_id=job.video_id,
        status='completed',
        completed_at=datetime.utcnow().isoformat()
    )
```

## Testing

Run the test suite:

```bash
cd backend
python3 test_media_manager.py
```

Expected output:
```
============================================================
MediaManager Test Suite
============================================================

1. Testing video addition with metadata extraction...
   ✓ Added video: dae2347c-e141-4cdb-9fe7-90d6c870c849
   - Resolution: 1280x720
   - Duration: 00:08
   - Size: 8.65 MB

2. Testing video deduplication...
   ✓ Duplicate detected!
   - New ID: ab3540c9-749e-4e4d-9315-f31f84e18219
   - Redirected to: dae2347c-e141-4cdb-9fe7-90d6c870c849

...
```

## Future Enhancements

1. **Cleanup Policies**
   - Auto-delete videos older than N days
   - Storage quota management
   - Archive old workflows

2. **Cloud Storage**
   - S3/GCS integration for video files
   - CDN for video delivery
   - Thumbnail generation

3. **Advanced Queries**
   - Search videos by prompt
   - Filter by resolution/duration
   - Workflow templates

4. **Migration Tools**
   - Import existing videos
   - Export workflows
   - Backup/restore database

## Troubleshooting

### Database locked
- Close all connections before operations
- Use `conn.close()` in finally blocks

### File hash calculation slow
- Large files may take time to hash
- Consider caching hashes
- Use chunked reading (already implemented)

### Missing FFprobe
```bash
# Install FFmpeg (includes FFprobe)
brew install ffmpeg  # macOS
apt-get install ffmpeg  # Ubuntu
```

## API Reference

See inline documentation in `media_manager.py` for complete API reference.

Key methods:
- `add_video()` - Add video with metadata
- `get_video()` - Retrieve video by ID
- `list_videos()` - Query videos with filters
- `delete_video()` - Remove video
- `create_workflow()` - Create workflow
- `get_workflow()` - Load workflow with videos
- `associate_video_with_workflow()` - Link video to workflow node
- `get_workflow_stats()` - System statistics
