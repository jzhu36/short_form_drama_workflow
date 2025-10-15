"""
Video Stitcher Module
Concatenates multiple video files into a single output video using ffmpeg.
"""

import os
import logging
import tempfile
import uuid
from typing import List, Optional, Dict, Any
import ffmpeg

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class VideoStitcher:
    """
    A helper class for stitching multiple video files together using ffmpeg.

    Attributes:
        output_dir (str): Directory to save stitched videos
        temp_dir (str): Directory for temporary files during processing
    """

    def __init__(self, output_dir: str = "videos", temp_dir: Optional[str] = None):
        """
        Initialize the VideoStitcher.

        Args:
            output_dir: Directory to save output videos
            temp_dir: Directory for temporary files (uses system temp if None)
        """
        self.output_dir = output_dir
        self.temp_dir = temp_dir or tempfile.gettempdir()

        # Create output directory if it doesn't exist
        os.makedirs(self.output_dir, exist_ok=True)

    def stitch_videos(
        self,
        input_videos: List[str],
        output_filename: Optional[str] = None,
        normalize: bool = True,
        target_resolution: Optional[str] = None,
        video_codec: str = "libx264",
        audio_codec: str = "aac",
        preset: str = "medium"
    ) -> Dict[str, Any]:
        """
        Stitch multiple videos together into a single output video.

        Args:
            input_videos: List of input video file paths (in order)
            output_filename: Name of output file (auto-generated if None)
            normalize: Whether to normalize video properties (resolution, fps, codec)
            target_resolution: Target resolution (e.g., "1920x1080"). Auto if None.
            video_codec: Video codec to use (default: libx264)
            audio_codec: Audio codec to use (default: aac)
            preset: FFmpeg preset (ultrafast, fast, medium, slow, veryslow)

        Returns:
            Dict with output_path, duration, size, and metadata

        Raises:
            ValueError: If inputs are invalid
            FileNotFoundError: If input files don't exist
            RuntimeError: If ffmpeg processing fails
        """
        # Validate inputs
        if not input_videos or len(input_videos) == 0:
            raise ValueError("At least one input video is required")

        if len(input_videos) > 100:
            raise ValueError("Too many input videos (max 100)")

        # Check all input files exist
        for video_path in input_videos:
            if not os.path.exists(video_path):
                raise FileNotFoundError(f"Input video not found: {video_path}")

        # Generate output filename if not provided
        if not output_filename:
            output_filename = f"stitched_{uuid.uuid4().hex[:8]}.mp4"

        output_path = os.path.join(self.output_dir, output_filename)

        try:
            logger.info(f"Stitching {len(input_videos)} videos together")

            if normalize:
                # Normalize videos first, then concatenate
                output_path = self._stitch_with_normalization(
                    input_videos,
                    output_path,
                    target_resolution,
                    video_codec,
                    audio_codec,
                    preset
                )
            else:
                # Simple concatenation (requires compatible formats)
                output_path = self._stitch_simple(
                    input_videos,
                    output_path,
                    video_codec,
                    audio_codec,
                    preset
                )

            # Get output video metadata
            probe = ffmpeg.probe(output_path)
            video_info = next(s for s in probe['streams'] if s['codec_type'] == 'video')

            result = {
                "output_path": output_path,
                "filename": output_filename,
                "duration": float(probe['format']['duration']),
                "size": int(probe['format']['size']),
                "resolution": f"{video_info['width']}x{video_info['height']}",
                "codec": video_info['codec_name'],
                "input_count": len(input_videos)
            }

            logger.info(f"Successfully stitched video: {output_path}")
            return result

        except ffmpeg.Error as e:
            error_message = e.stderr.decode() if e.stderr else str(e)
            logger.error(f"FFmpeg error during stitching: {error_message}")
            raise RuntimeError(f"Video stitching failed: {error_message}")
        except Exception as e:
            logger.error(f"Error during video stitching: {e}")
            raise

    def _stitch_simple(
        self,
        input_videos: List[str],
        output_path: str,
        video_codec: str,
        audio_codec: str,
        preset: str
    ) -> str:
        """
        Simple concatenation using ffmpeg concat demuxer.
        Requires all videos to have the same format/codec/resolution.
        """
        # Create concat file list
        concat_file = os.path.join(self.temp_dir, f"concat_{uuid.uuid4().hex[:8]}.txt")

        try:
            with open(concat_file, 'w') as f:
                for video in input_videos:
                    # Use absolute paths and escape special characters
                    abs_path = os.path.abspath(video)
                    f.write(f"file '{abs_path}'\n")

            # Run ffmpeg concat
            (
                ffmpeg
                .input(concat_file, format='concat', safe=0)
                .output(
                    output_path,
                    vcodec=video_codec,
                    acodec=audio_codec,
                    preset=preset,
                    movflags='faststart'  # Enable streaming
                )
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )

            return output_path

        finally:
            # Clean up concat file
            if os.path.exists(concat_file):
                os.remove(concat_file)

    def _stitch_with_normalization(
        self,
        input_videos: List[str],
        output_path: str,
        target_resolution: Optional[str],
        video_codec: str,
        audio_codec: str,
        preset: str
    ) -> str:
        """
        Concatenate videos with normalization (resolution, fps, codec).
        More robust but slower than simple concat.
        """
        # Get properties of first video to use as reference
        first_probe = ffmpeg.probe(input_videos[0])
        first_video = next(s for s in first_probe['streams'] if s['codec_type'] == 'video')

        # Check if videos have audio
        has_audio = any(s['codec_type'] == 'audio' for s in first_probe['streams'])

        # Determine target resolution
        if target_resolution:
            width, height = map(int, target_resolution.split('x'))
        else:
            width = int(first_video['width'])
            height = int(first_video['height'])

        # Get target framerate
        fps = eval(first_video['r_frame_rate'])  # e.g., "30/1" -> 30.0

        logger.info(f"Normalizing to {width}x{height} @ {fps}fps (audio: {has_audio})")

        # Build ffmpeg command with multiple inputs and filters
        inputs = [ffmpeg.input(video) for video in input_videos]

        # Create filter chain to normalize each video
        normalized_streams = []
        for input_stream in inputs:
            # Scale, set fps, and set audio sample rate
            video = (
                input_stream
                .video
                .filter('scale', width, height)
                .filter('setsar', '1/1')  # Set square pixel aspect ratio
                .filter('fps', fps)
            )
            normalized_streams.append(video)

            # Only process audio if present
            if has_audio:
                audio = input_stream.audio.filter('aresample', 48000)
                normalized_streams.append(audio)

        # Concatenate all normalized streams
        if has_audio:
            joined = ffmpeg.concat(*normalized_streams, v=1, a=1).node
            # Output with audio
            output = ffmpeg.output(
                joined[0],
                joined[1],
                output_path,
                vcodec=video_codec,
                acodec=audio_codec,
                preset=preset,
                movflags='faststart',
                strict='experimental'
            )
        else:
            joined = ffmpeg.concat(*normalized_streams, v=1, a=0).node
            # Output without audio
            output = ffmpeg.output(
                joined[0],
                output_path,
                vcodec=video_codec,
                preset=preset,
                movflags='faststart'
            )

        # Run ffmpeg
        output.overwrite_output().run(capture_stdout=True, capture_stderr=True)

        return output_path

    def get_video_info(self, video_path: str) -> Dict[str, Any]:
        """
        Get information about a video file.

        Args:
            video_path: Path to video file

        Returns:
            Dict with video metadata
        """
        if not os.path.exists(video_path):
            raise FileNotFoundError(f"Video not found: {video_path}")

        probe = ffmpeg.probe(video_path)
        video_stream = next(s for s in probe['streams'] if s['codec_type'] == 'video')

        return {
            "duration": float(probe['format']['duration']),
            "size": int(probe['format']['size']),
            "resolution": f"{video_stream['width']}x{video_stream['height']}",
            "width": int(video_stream['width']),
            "height": int(video_stream['height']),
            "codec": video_stream['codec_name'],
            "fps": eval(video_stream['r_frame_rate']),
            "bitrate": int(probe['format'].get('bit_rate', 0))
        }


def create_video_stitcher(output_dir: str = "videos") -> VideoStitcher:
    """
    Factory function to create a VideoStitcher instance.

    Args:
        output_dir: Directory to save output videos

    Returns:
        Configured VideoStitcher instance
    """
    return VideoStitcher(output_dir=output_dir)
