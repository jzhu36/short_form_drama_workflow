#!/usr/bin/env python3
"""
End-to-end test for video stitcher
Tests the VideoStitcher class directly and via API
"""

import os
import sys
import requests
import json
from pathlib import Path

# Test 1: Direct VideoStitcher class test
print("=" * 60)
print("TEST 1: Direct VideoStitcher Class")
print("=" * 60)

try:
    from video_stitcher import VideoStitcher

    # Get some video files to stitch
    videos_dir = Path("videos")
    video_files = list(videos_dir.glob("*.mp4"))[:3]  # Use first 3 videos

    if len(video_files) < 2:
        print("ERROR: Need at least 2 videos to test stitching")
        sys.exit(1)

    print(f"\nFound {len(video_files)} videos to stitch:")
    for i, video in enumerate(video_files, 1):
        size_mb = video.stat().st_size / (1024 * 1024)
        print(f"  {i}. {video.name} ({size_mb:.1f} MB)")

    # Initialize stitcher
    print("\nInitializing VideoStitcher...")
    stitcher = VideoStitcher(output_dir="videos")

    # Test with normalization
    print("\nStitching videos with normalization...")
    result = stitcher.stitch_videos(
        input_videos=[str(v) for v in video_files],
        normalize=True,
        output_filename="test_stitched_normalized.mp4"
    )

    print("\n✅ Stitching successful!")
    print(f"  Output: {result['filename']}")
    print(f"  Duration: {result['duration']:.1f}s")
    print(f"  Size: {result['size'] / (1024*1024):.1f} MB")
    print(f"  Resolution: {result['resolution']}")
    print(f"  Codec: {result['codec']}")
    print(f"  Input count: {result['input_count']}")

except Exception as e:
    print(f"\n❌ Direct test failed: {e}")
    import traceback
    traceback.print_exc()

# Test 2: API endpoint test
print("\n" + "=" * 60)
print("TEST 2: API Endpoint")
print("=" * 60)

try:
    # Check if server is running
    health_url = "http://localhost:5001/health"
    print(f"\nChecking server health: {health_url}")
    response = requests.get(health_url, timeout=5)

    if response.status_code != 200:
        print("❌ Server not healthy")
        sys.exit(1)

    print("✅ Server is running")

    # Test stitch endpoint
    stitch_url = "http://localhost:5001/api/videos/stitch"

    # Use filenames directly (they're in the videos directory)
    video_filenames = [v.name for v in video_files[:3]]

    print(f"\nSending stitch request to: {stitch_url}")
    print(f"Video IDs: {video_filenames}")

    payload = {
        "video_ids": video_filenames,
        "normalize": True,
        "target_resolution": "1280x720"
    }

    response = requests.post(
        stitch_url,
        json=payload,
        headers={"Content-Type": "application/json"},
        timeout=120  # Stitching can take time
    )

    print(f"\nResponse status: {response.status_code}")

    if response.status_code == 200:
        data = response.json()
        print("\n✅ API stitching successful!")
        print(f"  Job ID: {data['job_id']}")
        print(f"  Output: {data['filename']}")
        print(f"  Duration: {data['duration']:.1f}s")
        print(f"  Size: {data['size'] / (1024*1024):.1f} MB")
        print(f"  Resolution: {data['resolution']}")
        print(f"  Input count: {data['input_count']}")
        print(f"  Video URL: {data['video_url']}")

        # Try to download the result
        download_url = f"http://localhost:5001{data['video_url']}"
        print(f"\nDownloading stitched video from: {download_url}")

        dl_response = requests.get(download_url, timeout=30)
        if dl_response.status_code == 200:
            test_output = Path("test_downloaded_stitched.mp4")
            test_output.write_bytes(dl_response.content)
            print(f"✅ Downloaded to: {test_output}")
            print(f"  Size: {len(dl_response.content) / (1024*1024):.1f} MB")
        else:
            print(f"❌ Download failed: {dl_response.status_code}")

    else:
        print(f"\n❌ API stitching failed")
        try:
            error_data = response.json()
            print(f"  Error: {error_data.get('error', 'Unknown error')}")
        except:
            print(f"  Response: {response.text}")

except requests.exceptions.ConnectionError:
    print("\n❌ Cannot connect to server. Make sure video_service.py is running:")
    print("  cd backend && python3 video_service.py")
except Exception as e:
    print(f"\n❌ API test failed: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
print("END-TO-END TESTING COMPLETE")
print("=" * 60)
