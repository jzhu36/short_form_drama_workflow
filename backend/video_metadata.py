#!/usr/bin/env python3
"""
Video Metadata Extractor - Uses FFprobe to extract video information
"""

import subprocess
import json
import logging
from pathlib import Path
from typing import Optional, Dict, Any

logger = logging.getLogger(__name__)


class VideoMetadataExtractor:
    """Extract metadata from video files using FFprobe"""

    @staticmethod
    def extract_metadata(video_path: str) -> Dict[str, Any]:
        """
        Extract comprehensive metadata from video file

        Returns:
            Dict with keys: duration, resolution, aspect_ratio, codec, fps, size_bytes
        """
        video_path = Path(video_path)

        if not video_path.exists():
            raise FileNotFoundError(f"Video file not found: {video_path}")

        metadata = {
            'duration_seconds': None,
            'resolution': None,
            'aspect_ratio': None,
            'codec': None,
            'fps': None,
            'size_bytes': video_path.stat().st_size,
            'bitrate': None,
            'audio_codec': None
        }

        try:
            # Use ffprobe to get video information
            cmd = [
                'ffprobe',
                '-v', 'quiet',
                '-print_format', 'json',
                '-show_format',
                '-show_streams',
                str(video_path)
            ]

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )

            probe_data = json.loads(result.stdout)

            # Extract format information
            if 'format' in probe_data:
                fmt = probe_data['format']
                if 'duration' in fmt:
                    metadata['duration_seconds'] = float(fmt['duration'])
                if 'bit_rate' in fmt:
                    metadata['bitrate'] = int(fmt['bit_rate'])

            # Extract video stream information
            if 'streams' in probe_data:
                for stream in probe_data['streams']:
                    if stream.get('codec_type') == 'video':
                        # Video codec
                        if 'codec_name' in stream:
                            metadata['codec'] = stream['codec_name']

                        # Resolution
                        if 'width' in stream and 'height' in stream:
                            width = stream['width']
                            height = stream['height']
                            metadata['resolution'] = f"{width}x{height}"

                            # Calculate aspect ratio
                            gcd_val = VideoMetadataExtractor._gcd(width, height)
                            aspect_w = width // gcd_val
                            aspect_h = height // gcd_val
                            metadata['aspect_ratio'] = f"{aspect_w}:{aspect_h}"

                        # FPS
                        if 'r_frame_rate' in stream:
                            try:
                                num, den = map(int, stream['r_frame_rate'].split('/'))
                                if den > 0:
                                    metadata['fps'] = round(num / den, 2)
                            except (ValueError, ZeroDivisionError):
                                pass

                    elif stream.get('codec_type') == 'audio':
                        # Audio codec
                        if 'codec_name' in stream:
                            metadata['audio_codec'] = stream['codec_name']

            logger.debug(f"Extracted metadata for {video_path.name}: {metadata}")
            return metadata

        except subprocess.CalledProcessError as e:
            logger.error(f"FFprobe failed for {video_path}: {e.stderr}")
            # Return partial metadata
            return metadata

        except Exception as e:
            logger.error(f"Failed to extract metadata for {video_path}: {e}")
            return metadata

    @staticmethod
    def _gcd(a: int, b: int) -> int:
        """Calculate greatest common divisor"""
        while b:
            a, b = b, a % b
        return a

    @staticmethod
    def format_duration(seconds: float) -> str:
        """Format duration in human-readable format (HH:MM:SS)"""
        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)

        if hours > 0:
            return f"{hours:02d}:{minutes:02d}:{secs:02d}"
        else:
            return f"{minutes:02d}:{secs:02d}"

    @staticmethod
    def format_file_size(bytes_size: int) -> str:
        """Format file size in human-readable format"""
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if bytes_size < 1024.0:
                return f"{bytes_size:.2f} {unit}"
            bytes_size /= 1024.0
        return f"{bytes_size:.2f} PB"
