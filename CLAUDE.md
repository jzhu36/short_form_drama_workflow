# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a client-side web application for creating short form drama videos using AI video generation (Sora2 API). The application is built with vanilla JavaScript and Vite, featuring a three-panel interface: Asset Manager (left), Video Viewer (center), and Prompt Input (bottom).

## Development Commands

### Running the Application
```bash
npm run dev          # Start development server on port 3000 (auto-opens browser)
npm run build        # Build for production (output: dist/)
npm run preview      # Preview production build
```

### Testing
```bash
npm test             # Run tests with Vitest
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage report
```

### Python Dependencies (Backend/Workflow Tools)
```bash
pip install -r requirements.txt  # Install Python dependencies
pytest                          # Run Python tests
```

## Architecture Overview

### Three-Panel Layout Structure
The application uses a modular component architecture centered around three main UI panels:

1. **Asset Manager (Left Panel)**: Handles drag-and-drop file uploads, stores assets in IndexedDB, and displays thumbnails in a grid
2. **Video Viewer (Center Panel)**: Displays generated videos with HTML5 video player and playback controls
3. **Prompt Input (Bottom Panel)**: Text input for video generation prompts, submission to Sora2 API, and status display

### Core Services Layer
- **Sora2Client**: API client for authentication, video generation requests, status polling, and video downloads
- **StorageService**: Manages IndexedDB for persisting assets, generated videos, and prompt history
- **AppState**: Central state management coordinating all components

### Data Storage (IndexedDB)
Three main stores:
- **Assets Store**: Uploaded images/videos (blob storage)
- **Videos Store**: Generated videos with associated prompts and Sora job IDs
- **Prompts Store**: Prompt history for reuse

### API Integration Flow
1. User submits prompt → Sora2Client sends POST to `/v1/generate`
2. Receive jobId → Poll `/v1/status/{jobId}` for completion
3. On completion → Download video from `/v1/download/{jobId}`
4. Save video blob to IndexedDB → Display in Video Viewer → Auto-add to Assets

## Key Implementation Details

### Component Structure (Planned)
```
src/
├── main.js                 # Application entry point, initializes all components
├── components/
│   ├── AssetManager.js     # Drag-drop upload, thumbnail display, asset CRUD
│   ├── VideoViewer.js      # Video playback, download, status display
│   └── PromptInput.js      # Prompt submission, history, status updates
├── services/
│   ├── Sora2Client.js      # API authentication, generation, polling
│   └── StorageService.js   # IndexedDB wrapper for all storage operations
├── state/
│   └── AppState.js         # Central state: assets[], currentVideo, generationStatus
└── utils/
    ├── fileHandler.js      # File validation, type checking, size limits
    └── constants.js        # API endpoints, storage keys, config constants
```

### State Management
The AppState manages:
```javascript
{
  assets: [],                                           // Array of uploaded asset objects
  currentVideo: null,                                   // Currently playing video object
  generationStatus: 'idle' | 'generating' | 'complete' | 'error',
  promptHistory: [],                                    // Previous prompts
  apiConfig: { apiKey: '', baseUrl: '' }               // Sora2 API configuration
}
```

### Configuration
- API keys should be stored in `config/sora2_config.json` (not committed)
- Use environment variables for sensitive data in production
- File validation: Only accept image/video formats, implement size limits
- Polling interval for Sora2 status checks should be configurable (default: 5s)

## Testing Strategy

### Vitest Configuration
- Test environment: jsdom (browser simulation)
- Setup file: `tests/setup.js` (create this for test initialization)
- Coverage: v8 provider with text/json/html reports
- Coverage excludes: node_modules, tests, dist, config files

### Test Priorities
1. StorageService: IndexedDB CRUD operations
2. Sora2Client: API request/response handling, polling logic
3. Component interactions: State updates, event handling
4. File validation: Type checking, size limits

## Development Workflow

### Current Status (MVP Phase 1)
- Project structure initialized with Vite
- Basic HTML layout with three panels defined
- Package.json configured with dev/build/test scripts
- Next: Implement AssetManager component with drag-drop functionality

### Implementation Order (from docs/implementation_roadmap.md)
1. Asset Manager: Drag-drop, IndexedDB storage, thumbnail display
2. Video Viewer: HTML5 player, status indicators, download button
3. Prompt Input: Textarea, submit handler, validation
4. Sora2 API Integration: Client service, polling, error handling
5. State Management: Connect all components, complete user flow
6. Polish: UI/UX, animations, error messages, testing

### Critical Integration Points
- **Asset → Video Viewer**: Generated videos must auto-populate both viewer and asset grid
- **Prompt → Sora2 Client**: Handle async operations, loading states, error recovery
- **State → All Components**: Single source of truth, reactive updates across UI

### Security & Validation
- Validate file types before IndexedDB storage (images: jpg/png/gif, videos: mp4/webm)
- Implement file size limits to prevent IndexedDB quota issues
- Sanitize prompt input before sending to Sora2 API
- Never commit API keys (use .gitignore for config/sora2_config.json)

## Common Gotchas

### IndexedDB
- Browser storage quotas vary; monitor usage and implement warnings
- Blob storage can fail silently on quota exceeded
- Always handle promise rejections from IndexedDB operations

### Sora2 API
- Generation can take several minutes; implement proper timeout handling
- Rate limits may apply; add exponential backoff for polling
- CORS issues may require proxy setup if API doesn't support direct browser calls

### Video Playback
- Large video files may cause memory issues; consider streaming or chunked loading
- Browser codec support varies; test with multiple formats
- Autoplay policies require user interaction before playing

## Documentation References

- MVP Plan: `docs/mvp_plan.md` - Feature scope and success criteria
- Technical Architecture: `docs/technical_architecture.md` - Component details and data schemas
- Implementation Roadmap: `docs/implementation_roadmap.md` - Phased development plan
