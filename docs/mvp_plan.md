# Short Form Drama Workflow - MVP Plan

## Project Overview

A client-side web application for creating short form drama videos using AI video generation (Sora2).

## MVP Scope

### Core Features

1. **Asset Management (Left Panel)**
   - Drag and drop interface for uploading assets (images, videos)
   - Display uploaded assets in a grid/list view
   - Store assets locally in browser storage or local folder
   - Basic asset preview on hover/click

2. **Prompt Input (Bottom Panel)**
   - Text input area for video generation prompts
   - Submit button to send prompt to Sora2 API
   - Display generation status (pending, generating, completed, error)
   - Prompt history/template storage

3. **Video Viewer (Center Panel)**
   - Video player for generated content
   - Display video when generation completes
   - Basic playback controls (play, pause, seek)
   - Download button for generated videos

4. **Sora2 Integration**
   - API authentication and configuration
   - Send text prompts to Sora2
   - Poll/webhook for generation status
   - Download completed videos
   - Auto-save to asset management area

### Technical Stack

- **Frontend**: HTML5, CSS3, JavaScript (Vanilla or React)
- **Video Player**: HTML5 video element or video.js
- **File Storage**: Local filesystem or IndexedDB
- **API Integration**: Sora2 REST API
- **Build Tool**: Vite or webpack

### Out of Scope for MVP

- Multi-user collaboration
- Cloud storage integration
- Advanced video editing
- Asset organization (folders, tags)
- Batch processing
- Video trimming/composition

## User Flow

1. User opens the web app in Chrome
2. User drags and drops reference assets (images/videos) to left panel
3. User writes a prompt in the bottom panel describing desired video
4. User clicks "Generate" button
5. App sends prompt to Sora2 API
6. App shows generation progress/status
7. When complete, video appears in center viewer
8. Generated video automatically saved to asset area
9. User can play, review, and download the video

## Success Criteria

- ✅ Successfully upload and display assets in left panel
- ✅ Send prompt to Sora2 API and receive video URL
- ✅ Display generated video in center player
- ✅ Save generated video to local asset storage
- ✅ Basic error handling for API failures
- ✅ Runs smoothly in Chrome browser
