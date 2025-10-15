#!/usr/bin/env python3
"""
Test script for MediaManager
Demonstrates video and workflow management capabilities
"""

import sys
import uuid
from pathlib import Path
from media_manager import MediaManager
from video_metadata import VideoMetadataExtractor

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))


def test_media_manager():
    """Test MediaManager functionality"""

    # Initialize MediaManager
    mm = MediaManager(
        db_path='media_test.db',
        video_dir='videos'
    )

    print("=" * 60)
    print("MediaManager Test Suite")
    print("=" * 60)

    # Test 1: Add a video
    print("\n1. Testing video addition with metadata extraction...")
    test_video_path = 'videos/1d3c5835-6b76-4bdb-bd72-90afe6f6ff6f.mp4'

    if Path(test_video_path).exists():
        # Extract metadata
        metadata_extractor = VideoMetadataExtractor()
        video_metadata = metadata_extractor.extract_metadata(test_video_path)

        video_id = str(uuid.uuid4())
        result = mm.add_video(
            video_id=video_id,
            name='Test Video 1',
            file_path=test_video_path,
            size_bytes=video_metadata['size_bytes'],
            source_type='uploaded',
            duration_seconds=video_metadata['duration_seconds'],
            resolution=video_metadata['resolution'],
            aspect_ratio=video_metadata['aspect_ratio'],
            codec=video_metadata['codec'],
            fps=video_metadata['fps'],
            metadata={'test': True}
        )

        print(f"   ✓ Added video: {result['video_id']}")
        print(f"   - Resolution: {video_metadata['resolution']}")
        print(f"   - Duration: {metadata_extractor.format_duration(video_metadata['duration_seconds'])}")
        print(f"   - Size: {metadata_extractor.format_file_size(video_metadata['size_bytes'])}")
    else:
        print(f"   ⚠ Test video not found: {test_video_path}")

    # Test 2: Test deduplication
    print("\n2. Testing video deduplication...")
    if Path(test_video_path).exists():
        duplicate_id = str(uuid.uuid4())
        result = mm.add_video(
            video_id=duplicate_id,
            name='Test Video 1 (Duplicate)',
            file_path=test_video_path,
            size_bytes=video_metadata['size_bytes'],
            source_type='uploaded'
        )

        if result['is_duplicate']:
            print(f"   ✓ Duplicate detected!")
            print(f"   - New ID: {duplicate_id}")
            print(f"   - Redirected to: {result['original_id']}")
        else:
            print(f"   ✗ Deduplication failed")

    # Test 3: Create a workflow
    print("\n3. Testing workflow creation...")
    workflow_id = str(uuid.uuid4())
    workflow = mm.create_workflow(
        workflow_id=workflow_id,
        name='Test Workflow',
        description='A test workflow for demonstration',
        definition={
            'nodes': [
                {'id': 'node1', 'type': 'TextInput'},
                {'id': 'node2', 'type': 'Sora2Video'},
                {'id': 'node3', 'type': 'VideoStitcher'}
            ],
            'connections': [
                {'from': 'node1', 'to': 'node2'},
                {'from': 'node2', 'to': 'node3'}
            ]
        },
        status='draft'
    )
    print(f"   ✓ Created workflow: {workflow['workflow_id']}")
    print(f"   - Name: {workflow['name']}")
    print(f"   - Status: {workflow['status']}")

    # Test 4: Associate video with workflow
    print("\n4. Testing video-workflow association...")
    if not result.get('is_duplicate'):
        mm.associate_video_with_workflow(
            workflow_id=workflow_id,
            video_id=video_id,
            node_id='node2',
            node_type='Sora2Video',
            role='output'
        )
        print(f"   ✓ Associated video {video_id} with workflow")

    # Test 5: Save workflow (change status from draft to saved)
    print("\n5. Testing workflow save...")
    mm.update_workflow(
        workflow_id=workflow_id,
        status='saved'
    )
    print(f"   ✓ Workflow status changed: draft → saved")

    # Test 6: Retrieve workflow with videos
    print("\n6. Testing workflow retrieval...")
    retrieved_workflow = mm.get_workflow(workflow_id)
    if retrieved_workflow:
        print(f"   ✓ Retrieved workflow: {retrieved_workflow['name']}")
        print(f"   - Status: {retrieved_workflow['status']}")
        print(f"   - Associated videos: {len(retrieved_workflow['videos'])}")
        if retrieved_workflow['videos']:
            for video in retrieved_workflow['videos']:
                print(f"     • {video['name']} (node: {video['node_id']})")

    # Test 7: List all workflows
    print("\n7. Testing workflow listing...")
    all_workflows = mm.list_workflows()
    print(f"   ✓ Total workflows: {len(all_workflows)}")
    for wf in all_workflows:
        print(f"     • {wf['name']} ({wf['status']})")

    # Test 8: Get statistics
    print("\n8. Testing statistics...")
    stats = mm.get_workflow_stats()
    print(f"   ✓ System Statistics:")
    print(f"   - Total storage: {metadata_extractor.format_file_size(stats['total_storage_bytes'])}")
    print(f"   - Videos by source: {stats.get('videos_by_source', {})}")
    print(f"   - Workflows by status: {stats.get('workflows_by_status', {})}")

    print("\n" + "=" * 60)
    print("All tests completed!")
    print("=" * 60)


if __name__ == '__main__':
    test_media_manager()
