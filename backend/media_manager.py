#!/usr/bin/env python3
"""
Media Manager - Manages videos and workflows with persistence
Handles video storage, deduplication, and workflow associations
"""

import sqlite3
import hashlib
import json
from pathlib import Path
from datetime import datetime
from typing import Optional, List, Dict, Any
import logging

logger = logging.getLogger(__name__)


class MediaManager:
    """
    Manages video assets and workflow associations with SQLite persistence
    """

    def __init__(self, db_path: str = 'backend/media.db', video_dir: str = 'backend/videos'):
        self.db_path = Path(db_path)
        self.video_dir = Path(video_dir)
        self.video_dir.mkdir(exist_ok=True)
        self.db_path.parent.mkdir(exist_ok=True)

        self._init_database()

    def _init_database(self):
        """Initialize SQLite database with required tables"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        # Videos table - stores all video metadata
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS videos (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                file_path TEXT NOT NULL UNIQUE,
                file_hash TEXT NOT NULL,
                size_bytes INTEGER NOT NULL,
                duration_seconds REAL,
                resolution TEXT,
                aspect_ratio TEXT,
                codec TEXT,
                fps REAL,
                source_type TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata JSON
            )
        ''')

        # Create index on file_hash for deduplication
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_videos_hash
            ON videos(file_hash)
        ''')

        # Generation details table - tracks how videos were created
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS video_generation (
                video_id TEXT PRIMARY KEY,
                provider TEXT,
                model TEXT,
                prompt TEXT,
                generation_params JSON,
                job_id TEXT,
                status TEXT,
                error TEXT,
                started_at TIMESTAMP,
                completed_at TIMESTAMP,
                FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
            )
        ''')

        # Workflows table - stores workflow definitions and state
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS workflows (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'draft',
                definition JSON NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_executed_at TIMESTAMP
            )
        ''')

        # Workflow executions table - tracks each run
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS workflow_executions (
                id TEXT PRIMARY KEY,
                workflow_id TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                error TEXT,
                execution_data JSON,
                FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
            )
        ''')

        # Workflow-Video associations - many-to-many relationship
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS workflow_videos (
                workflow_id TEXT NOT NULL,
                video_id TEXT NOT NULL,
                node_id TEXT NOT NULL,
                node_type TEXT NOT NULL,
                role TEXT NOT NULL,
                execution_id TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (workflow_id, video_id, node_id),
                FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
                FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
                FOREIGN KEY (execution_id) REFERENCES workflow_executions(id) ON DELETE SET NULL
            )
        ''')

        conn.commit()
        conn.close()
        logger.info(f"Database initialized at {self.db_path}")

    def calculate_file_hash(self, file_path: str) -> str:
        """Calculate SHA256 hash of file for deduplication"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            # Read in chunks to handle large files
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()

    def find_duplicate_video(self, file_hash: str) -> Optional[Dict[str, Any]]:
        """Check if video with same hash already exists"""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute('''
            SELECT * FROM videos WHERE file_hash = ?
        ''', (file_hash,))

        row = cursor.fetchone()
        conn.close()

        if row:
            return dict(row)
        return None

    def add_video(
        self,
        video_id: str,
        name: str,
        file_path: str,
        size_bytes: int,
        source_type: str,
        duration_seconds: Optional[float] = None,
        resolution: Optional[str] = None,
        aspect_ratio: Optional[str] = None,
        codec: Optional[str] = None,
        fps: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Add a video to the database

        Args:
            video_id: Unique identifier
            name: Display name
            file_path: Path to video file
            size_bytes: File size in bytes
            source_type: 'generated', 'uploaded', 'stitched'
            duration_seconds: Video duration
            resolution: e.g., '1920x1080'
            aspect_ratio: e.g., '16:9'
            codec: Video codec
            fps: Frames per second
            metadata: Additional metadata

        Returns:
            Video record with deduplication info
        """
        # Calculate file hash for deduplication
        file_hash = self.calculate_file_hash(file_path)

        # Check for duplicates
        duplicate = self.find_duplicate_video(file_hash)
        if duplicate:
            logger.info(f"Duplicate video detected: {video_id} -> {duplicate['id']}")
            return {
                'video_id': duplicate['id'],
                'is_duplicate': True,
                'original_id': duplicate['id'],
                'file_path': duplicate['file_path']
            }

        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        try:
            cursor.execute('''
                INSERT INTO videos (
                    id, name, file_path, file_hash, size_bytes,
                    duration_seconds, resolution, aspect_ratio, codec, fps,
                    source_type, metadata
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                video_id, name, file_path, file_hash, size_bytes,
                duration_seconds, resolution, aspect_ratio, codec, fps,
                source_type, json.dumps(metadata) if metadata else None
            ))

            conn.commit()
            logger.info(f"Added video: {video_id} ({name})")

            return {
                'video_id': video_id,
                'is_duplicate': False,
                'file_path': file_path,
                'file_hash': file_hash
            }

        except sqlite3.IntegrityError as e:
            conn.rollback()
            logger.error(f"Failed to add video {video_id}: {e}")
            raise
        finally:
            conn.close()

    def add_generation_details(
        self,
        video_id: str,
        provider: str,
        prompt: str,
        model: Optional[str] = None,
        generation_params: Optional[Dict[str, Any]] = None,
        job_id: Optional[str] = None,
        status: str = 'completed',
        error: Optional[str] = None,
        started_at: Optional[str] = None,
        completed_at: Optional[str] = None
    ):
        """Add generation details for a video"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        cursor.execute('''
            INSERT OR REPLACE INTO video_generation (
                video_id, provider, model, prompt, generation_params,
                job_id, status, error, started_at, completed_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            video_id, provider, model, prompt,
            json.dumps(generation_params) if generation_params else None,
            job_id, status, error, started_at, completed_at
        ))

        conn.commit()
        conn.close()
        logger.info(f"Added generation details for video: {video_id}")

    def get_video(self, video_id: str) -> Optional[Dict[str, Any]]:
        """Get video by ID with all associated data"""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Get video data
        cursor.execute('SELECT * FROM videos WHERE id = ?', (video_id,))
        video_row = cursor.fetchone()

        if not video_row:
            conn.close()
            return None

        video = dict(video_row)

        # Parse JSON fields
        if video['metadata']:
            video['metadata'] = json.loads(video['metadata'])

        # Get generation details if exists
        cursor.execute('SELECT * FROM video_generation WHERE video_id = ?', (video_id,))
        gen_row = cursor.fetchone()
        if gen_row:
            video['generation'] = dict(gen_row)
            if video['generation']['generation_params']:
                video['generation']['generation_params'] = json.loads(
                    video['generation']['generation_params']
                )

        conn.close()
        return video

    def list_videos(
        self,
        source_type: Optional[str] = None,
        workflow_id: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List videos with optional filtering"""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        if workflow_id:
            # Get videos associated with a workflow
            cursor.execute('''
                SELECT v.*, wv.node_id, wv.node_type, wv.role
                FROM videos v
                JOIN workflow_videos wv ON v.id = wv.video_id
                WHERE wv.workflow_id = ?
                ORDER BY v.created_at DESC
                LIMIT ? OFFSET ?
            ''', (workflow_id, limit, offset))
        elif source_type:
            cursor.execute('''
                SELECT * FROM videos
                WHERE source_type = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            ''', (source_type, limit, offset))
        else:
            cursor.execute('''
                SELECT * FROM videos
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
            ''', (limit, offset))

        rows = cursor.fetchall()
        videos = [dict(row) for row in rows]

        # Parse JSON fields
        for video in videos:
            if video.get('metadata'):
                video['metadata'] = json.loads(video['metadata'])

        conn.close()
        return videos

    def delete_video(self, video_id: str, delete_file: bool = True):
        """Delete video from database and optionally from disk"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        # Get file path before deleting
        cursor.execute('SELECT file_path FROM videos WHERE id = ?', (video_id,))
        row = cursor.fetchone()

        if row:
            file_path = row[0]

            # Delete from database (cascades to related tables)
            cursor.execute('DELETE FROM videos WHERE id = ?', (video_id,))
            conn.commit()

            # Delete file if requested
            if delete_file and Path(file_path).exists():
                Path(file_path).unlink()
                logger.info(f"Deleted video file: {file_path}")

            logger.info(f"Deleted video: {video_id}")

        conn.close()

    # ========== Workflow Management ==========

    def create_workflow(
        self,
        workflow_id: str,
        name: str,
        definition: Dict[str, Any],
        description: Optional[str] = None,
        status: str = 'draft'
    ) -> Dict[str, Any]:
        """Create a new workflow"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO workflows (id, name, description, status, definition)
            VALUES (?, ?, ?, ?, ?)
        ''', (workflow_id, name, description, status, json.dumps(definition)))

        conn.commit()
        conn.close()
        logger.info(f"Created workflow: {workflow_id} ({name})")

        return {
            'workflow_id': workflow_id,
            'name': name,
            'status': status
        }

    def update_workflow(
        self,
        workflow_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        definition: Optional[Dict[str, Any]] = None,
        status: Optional[str] = None
    ):
        """Update workflow"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        updates = []
        params = []

        if name:
            updates.append('name = ?')
            params.append(name)
        if description is not None:
            updates.append('description = ?')
            params.append(description)
        if definition:
            updates.append('definition = ?')
            params.append(json.dumps(definition))
        if status:
            updates.append('status = ?')
            params.append(status)

        updates.append('updated_at = CURRENT_TIMESTAMP')

        params.append(workflow_id)

        cursor.execute(f'''
            UPDATE workflows
            SET {', '.join(updates)}
            WHERE id = ?
        ''', params)

        conn.commit()
        conn.close()
        logger.info(f"Updated workflow: {workflow_id}")

    def get_workflow(self, workflow_id: str) -> Optional[Dict[str, Any]]:
        """Get workflow with all associated videos"""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        cursor.execute('SELECT * FROM workflows WHERE id = ?', (workflow_id,))
        row = cursor.fetchone()

        if not row:
            conn.close()
            return None

        workflow = dict(row)
        workflow['definition'] = json.loads(workflow['definition'])

        # Get associated videos
        cursor.execute('''
            SELECT v.*, wv.node_id, wv.node_type, wv.role, wv.execution_id
            FROM videos v
            JOIN workflow_videos wv ON v.id = wv.video_id
            WHERE wv.workflow_id = ?
            ORDER BY wv.created_at DESC
        ''', (workflow_id,))

        video_rows = cursor.fetchall()
        workflow['videos'] = []
        for video_row in video_rows:
            video = dict(video_row)
            if video.get('metadata'):
                video['metadata'] = json.loads(video['metadata'])
            workflow['videos'].append(video)

        conn.close()
        return workflow

    def list_workflows(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """List workflows"""
        conn = sqlite3.connect(str(self.db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        if status:
            cursor.execute('''
                SELECT * FROM workflows
                WHERE status = ?
                ORDER BY updated_at DESC
            ''', (status,))
        else:
            cursor.execute('''
                SELECT * FROM workflows
                ORDER BY updated_at DESC
            ''')

        rows = cursor.fetchall()
        workflows = []

        for row in rows:
            workflow = dict(row)
            workflow['definition'] = json.loads(workflow['definition'])
            workflows.append(workflow)

        conn.close()
        return workflows

    def associate_video_with_workflow(
        self,
        workflow_id: str,
        video_id: str,
        node_id: str,
        node_type: str,
        role: str = 'output',
        execution_id: Optional[str] = None
    ):
        """Associate a video with a workflow node"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        cursor.execute('''
            INSERT OR REPLACE INTO workflow_videos
            (workflow_id, video_id, node_id, node_type, role, execution_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (workflow_id, video_id, node_id, node_type, role, execution_id))

        conn.commit()
        conn.close()
        logger.info(f"Associated video {video_id} with workflow {workflow_id}")

    def create_workflow_execution(
        self,
        execution_id: str,
        workflow_id: str,
        status: str = 'running'
    ) -> str:
        """Create a workflow execution record"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        cursor.execute('''
            INSERT INTO workflow_executions (id, workflow_id, status)
            VALUES (?, ?, ?)
        ''', (execution_id, workflow_id, status))

        conn.commit()
        conn.close()
        logger.info(f"Created workflow execution: {execution_id}")
        return execution_id

    def update_workflow_execution(
        self,
        execution_id: str,
        status: str,
        error: Optional[str] = None,
        execution_data: Optional[Dict[str, Any]] = None
    ):
        """Update workflow execution status"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        completed_at = datetime.utcnow().isoformat() if status in ['completed', 'failed'] else None

        cursor.execute('''
            UPDATE workflow_executions
            SET status = ?, error = ?, execution_data = ?, completed_at = ?
            WHERE id = ?
        ''', (
            status,
            error,
            json.dumps(execution_data) if execution_data else None,
            completed_at,
            execution_id
        ))

        conn.commit()
        conn.close()

    def get_workflow_stats(self) -> Dict[str, Any]:
        """Get statistics about workflows and videos"""
        conn = sqlite3.connect(str(self.db_path))
        cursor = conn.cursor()

        stats = {}

        # Total videos by source type
        cursor.execute('''
            SELECT source_type, COUNT(*) as count, SUM(size_bytes) as total_size
            FROM videos
            GROUP BY source_type
        ''')
        stats['videos_by_source'] = {row[0]: {'count': row[1], 'total_size': row[2]}
                                     for row in cursor.fetchall()}

        # Total workflows by status
        cursor.execute('''
            SELECT status, COUNT(*) as count
            FROM workflows
            GROUP BY status
        ''')
        stats['workflows_by_status'] = {row[0]: row[1] for row in cursor.fetchall()}

        # Total storage used
        cursor.execute('SELECT SUM(size_bytes) FROM videos')
        stats['total_storage_bytes'] = cursor.fetchone()[0] or 0

        conn.close()
        return stats
