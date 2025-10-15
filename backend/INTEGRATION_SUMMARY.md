# Video Management Integration Summary

## Overview

The MediaManager video management infrastructure has been successfully integrated into the Short Form Drama Workflow application. This integration provides persistent storage, deduplication, and workflow management capabilities.

## What Was Integrated

### 1. Backend Video Service (`video_service.py`)

All video-related endpoints now use MediaManager for persistence:

#### **Video Generation Endpoint** (`_generate_video_async`)
- Extracts metadata using FFprobe after video download
- Adds video to MediaManager with metadata (resolution, duration, codec, FPS, etc.)
- Records generation details (provider, prompt, model, parameters)
- Handles metadata extraction failures gracefully

#### **Upload Endpoint** (`upload_video`)
- Extracts metadata from uploaded videos
- **Deduplication**: Checks if video already exists using SHA256 hash
- If duplicate detected, deletes new file and returns existing video ID
- Saves storage space by preventing duplicate uploads

#### **Stitching Endpoint** (`stitch_videos`)
- Extracts metadata from stitched output
- Records input video IDs and stitching parameters in metadata
- Stores as source_type='stitched' for tracking

### 2. Workflow API Endpoints

Five new endpoints for workflow management:

#### **POST /api/workflows**
- Create or update workflow
- Accepts: name, description, status (draft/saved), definition
- Returns: workflow_id

#### **GET /api/workflows/:id**
- Retrieve workflow with associated videos
- Returns: Full workflow definition + array of video associations

#### **GET /api/workflows**
- List all workflows
- Optional status filter (draft or saved)
- Returns: Array of workflows with counts

#### **PUT /api/workflows/:id**
- Update workflow properties
- Accepts: name, description, status, definition

#### **DELETE /api/workflows/:id**
- Delete workflow (preserves videos)

#### **POST /api/workflows/:id/videos**
- Associate video with workflow node
- Records: video_id, node_id, node_type, role (output/input/intermediate)

### 3. Frontend Workflow Integration (`WorkflowBuilder.js`)

#### **Save Workflow** (`saveWorkflow()`)
- Saves workflow definition to backend API
- Associates all generated videos with their source nodes
- Stores workflow_id in localStorage as backup

#### **Load Workflow** (`loadWorkflow()`)
- Fetches workflows from backend
- Displays workflow list with node count, video count, and save date
- Restores workflow graph structure
- **Downloads and restores video blobs** from backend
- Populates execution results for restored videos
- Updates node displays (e.g., VideoStitcher preview)

## Key Features Implemented

### 1. **Complete Metadata Tracking**
All videos now have:
- Name, creation time
- Length (duration), resolution, aspect ratio
- Codec, FPS, file size
- Source type (generated, uploaded, stitched)
- Generation details (for AI-generated videos)
  - Provider (OpenAI/Google)
  - Prompt
  - Model
  - Generation parameters

### 2. **Content-Based Deduplication**
- Uses SHA256 hash of file content
- Automatic detection on upload
- Prevents duplicate storage
- Returns existing video_id if duplicate found

### 3. **Workflow State Management**
- **Draft workflows**: Not persisted with videos
- **Saved workflows**: Persistent with video associations
- Videos are linked to specific nodes
- Workflows can be restored with all outputs intact

### 4. **Video-Workflow Associations**
- Each video knows which workflow generated it
- Each workflow knows which videos it produced
- Videos are linked to specific nodes and their roles
- Supports execution tracking

## Database Schema

### Videos Table
```sql
CREATE TABLE videos (
    id TEXT PRIMARY KEY,              -- UUID
    name TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_hash TEXT NOT NULL,          -- SHA256 for deduplication
    size_bytes INTEGER NOT NULL,
    duration_seconds REAL,
    resolution TEXT,                  -- e.g., '1920x1080'
    aspect_ratio TEXT,                -- e.g., '16:9'
    codec TEXT,
    fps REAL,
    source_type TEXT NOT NULL,        -- 'generated', 'uploaded', 'stitched'
    created_at TIMESTAMP,
    metadata JSON
);
```

### Workflows Table
```sql
CREATE TABLE workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'draft',      -- 'draft' or 'saved'
    definition JSON NOT NULL,         -- Workflow graph
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
    node_id TEXT NOT NULL,            -- Which node produced this video
    node_type TEXT NOT NULL,          -- 'Sora2Video', 'VideoStitcher', etc.
    role TEXT NOT NULL,               -- 'output', 'input', 'intermediate'
    execution_id TEXT,
    created_at TIMESTAMP,
    PRIMARY KEY (workflow_id, video_id, node_id)
);
```

### Video Generation Details
```sql
CREATE TABLE video_generation (
    video_id TEXT PRIMARY KEY,
    provider TEXT,                    -- 'openai', 'google'
    model TEXT,
    prompt TEXT,
    generation_params JSON,
    job_id TEXT,
    status TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP
);
```

## Usage Example

### Saving a Workflow

1. User runs a workflow that generates 3 videos
2. User clicks "Save" button
3. Frontend sends workflow definition to backend:
   ```javascript
   POST /api/workflows
   {
     "name": "My Drama Workflow",
     "status": "saved",
     "definition": {
       "nodes": [...],
       "connections": [...]
     }
   }
   ```
4. Backend returns `workflow_id`
5. Frontend associates each video with its node:
   ```javascript
   POST /api/workflows/{workflow_id}/videos
   {
     "video_id": "job-uuid-1",
     "node_id": "node-1",
     "node_type": "Sora2Video",
     "role": "output"
   }
   ```

### Loading a Workflow

1. User clicks "Load" button
2. Frontend fetches workflow list:
   ```javascript
   GET /api/workflows?status=saved
   ```
3. User selects workflow from list
4. Frontend fetches full workflow details:
   ```javascript
   GET /api/workflows/{workflow_id}
   ```
5. Backend returns workflow definition + associated videos
6. Frontend restores graph structure
7. Frontend downloads each video blob:
   ```javascript
   GET /api/videos/{video_id}/download
   ```
8. Frontend populates execution results
9. Videos appear in node outputs

## Benefits

### For Users
- **Persistence**: Workflows and videos survive browser refresh
- **Organization**: All videos tracked with metadata
- **Efficiency**: Duplicate uploads prevented automatically
- **Restore**: Load workflows with all outputs intact

### For System
- **Storage**: Deduplication saves disk space
- **Tracking**: Complete audit trail for all videos
- **Scalability**: Database handles large numbers of workflows/videos
- **Reliability**: SQLite provides ACID guarantees

## Files Modified/Created

### Backend
- ✅ `video_service.py` - Updated all endpoints to use MediaManager
- ✅ `media_manager.py` - Core MediaManager class (new)
- ✅ `video_metadata.py` - FFprobe metadata extractor (new)
- ✅ `test_media_manager.py` - Test suite (new)
- ✅ `MEDIA_MANAGER_README.md` - Documentation (new)
- ✅ `.gitignore` - Updated to exclude videos and databases (new)
- ✅ `videos/.gitkeep` - Ensures videos directory tracked (new)

### Frontend
- ✅ `WorkflowBuilder.js` - Updated save/load to use backend API

## Testing

Run the test suite to verify functionality:

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
   ✓ Added video: [uuid]
   - Resolution: 1280x720
   - Duration: 00:08
   - Size: 8.65 MB

2. Testing video deduplication...
   ✓ Duplicate detected!
   - New ID: [new-uuid]
   - Redirected to: [original-uuid]

3-8. All tests passed ✓
```

## Next Steps (Future Enhancements)

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

## Database Location

The SQLite database is created at:
```
backend/media.db
```

This file is automatically created on first run and persists across restarts.

## Backward Compatibility

The integration maintains backward compatibility:
- Legacy `jobs` dict still exists for in-memory tracking
- Videos are stored in both systems during transition
- LocalStorage backup still maintained in frontend

This allows for gradual migration and rollback if needed.
