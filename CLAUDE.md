# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web application for creating short form drama videos using AI video generation. The application features a **Python Flask backend** that wraps OpenAI Sora-2 and Google Veo 3 APIs, and a **JavaScript frontend** built with vanilla JS and Vite. The UI has a three-panel interface: Video List (left), Video Viewer (center), and Prompt Input (bottom).

## Development Commands

### Running the Application

**IMPORTANT**: You need to run BOTH the Python backend AND the frontend:

#### 1. Start Python Backend (Terminal 1)
```bash
cd backend
./start_backend.sh   # Starts Flask server on port 5001
```

#### 2. Start Frontend Dev Server (Terminal 2)
```bash
npm run dev          # Start Vite dev server on port 3000 (auto-opens browser)
```

The frontend proxies API requests from `/api/videos/*` to the Python backend at `http://localhost:5001`.

### Building for Production
```bash
npm run build        # Build frontend (output: dist/)
npm run preview      # Preview production build
```

### Testing
```bash
# Frontend tests
npm test             # Run tests with Vitest
npm run test:ui      # Run tests with UI
npm run test:coverage # Run tests with coverage report

# Backend tests
pytest               # Run Python tests
```

### Python Dependencies
```bash
pip install -r requirements.txt  # Install: Flask, OpenAI, Google GenAI, etc.
```

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Vite + Vanilla JS)              │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐    │
│  │ Video List │  │   Video    │  │  Prompt Input      │    │
│  │  (Left)    │  │  Viewer    │  │   (Bottom)         │    │
│  │            │  │  (Center)  │  │                    │    │
│  └────────────┘  └────────────┘  └────────────────────┘    │
│         │              │                    │                │
│         └──────────────┴────────────────────┘                │
│                        │                                     │
│                  Sora2Client.js                              │
│                        │                                     │
└────────────────────────┼─────────────────────────────────────┘
                         │ HTTP API (/api/videos/*)
                         │ Proxied by Vite
┌────────────────────────┼─────────────────────────────────────┐
│                        ▼                                     │
│            Python Backend (Flask)                            │
│                  video_service.py                            │
│                        │                                     │
│         ┌──────────────┴──────────────┐                     │
│         │                              │                     │
│    video_generator.py           Job Management              │
│  (from ai-short-drama)           (In-memory/Redis)          │
│         │                              │                     │
│    ┌────┴────┐                  ┌─────┴─────┐              │
│    │ OpenAI  │                  │  Google   │              │
│    │ Sora-2  │                  │  Veo 3    │              │
│    └─────────┘                  └───────────┘              │
└─────────────────────────────────────────────────────────────┘
```

### Frontend Architecture

The application uses a modular component architecture with three main UI panels:

1. **Video List (Left Panel)**: Lists all video generation jobs from the backend with status indicators
2. **Video Viewer (Center Panel)**: Displays selected videos with HTML5 player and playback controls
3. **Prompt Input (Bottom Panel)**: Text input for video generation prompts with provider selection

### Frontend Services Layer
- **Sora2Client**: API client that communicates with Python backend for video generation, status polling, and downloads
- **StorageService**: Manages IndexedDB for persisting downloaded videos and prompt history (optional local caching)
- **Components**: VideoList, VideoViewer, PromptInput, DebugPanel

### Backend Architecture (Python Flask)

**Location**: `/backend/video_service.py`

The backend wraps video generation logic from the `ai-short-drama` project's `video_generator.py`:

- **Job-based Architecture**: Each generation request creates a job with unique ID
- **Background Processing**: Video generation runs in background thread (use Celery in production)
- **Dual Provider Support**: OpenAI Sora-2 and Google Veo 3
- **Video Storage**: Generated videos saved to `backend/videos/` directory
- **RESTful API**: Simple HTTP endpoints for frontend integration

### API Integration Flow

1. User submits prompt → **Frontend** sends `POST /api/videos/generate` with prompt, provider, and settings
2. **Backend** creates job → Initializes VideoGenerator → Starts background generation
3. **Frontend** polls `GET /api/videos/{jobId}/status` every 3 seconds
4. **Backend** updates job status as video generates (pending → processing → completed)
5. On completion → **Frontend** downloads video via `GET /api/videos/{jobId}/download`
6. **Frontend** displays video in viewer and optionally saves to IndexedDB

### Provider Support

**OpenAI Sora-2:**
- Duration: 4, 8, or 12 seconds
- Sizes: 720x1280 (vertical), 1280x720 (horizontal), etc.
- Requires: Organization verification

**Google Veo 3:**
- Duration: Fixed 8 seconds
- Models: `veo-3.0-generate-001` (high quality), `veo-3.0-fast-generate-001` (faster)
- Aspect Ratios: 16:9, 9:16, 1:1

## Key Implementation Details

### Component Structure (Actual)
```
backend/
├── video_service.py        # Flask API server (port 5001)
├── videos/                 # Generated video storage
├── start_backend.sh        # Startup script
└── README.md               # Backend documentation

src/
├── main.js                 # Application entry point, wires all components
├── components/
│   ├── DebugPanel.js       # Debug console for API calls and logs
│   ├── VideoList.js        # Left panel: List jobs from backend API
│   ├── VideoViewer.js      # Center panel: Video playback with HTML5 player
│   └── PromptInput.js      # Bottom panel: Prompt submission with status
├── services/
│   ├── Sora2Client.js      # API client for Python backend (no auth needed)
│   └── StorageService.js   # IndexedDB wrapper for local video caching
└── utils/
    └── (placeholder for future utilities)
```

### Configuration
- **Backend API Keys**: Stored in `.env` file at project root or `ai-short-drama` directory
  - `OPENAI_API_KEY` for OpenAI Sora-2
  - `GEMINI_API_KEY` for Google Veo 3
- **Frontend**: No API keys needed (calls backend via proxy)
- **Polling Interval**: 3 seconds (configurable in Sora2Client.js:9)
- **Backend Port**: 5001 (Flask server)
- **Frontend Port**: 3000 (Vite dev server)

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

### Video Generation API
- Generation can take 1-6 minutes; backend handles long-running operations
- Frontend polls status every 3 seconds to check completion
- Python backend manages all API communication (no CORS issues from browser)
- Backend uses threading for background processing (consider Celery for production scale)

### Video Playback
- Large video files may cause memory issues; consider streaming or chunked loading
- Browser codec support varies; test with multiple formats
- Autoplay policies require user interaction before playing

## Documentation References

- MVP Plan: `docs/mvp_plan.md` - Feature scope and success criteria
- Technical Architecture: `docs/technical_architecture.md` - Component details and data schemas
- Implementation Roadmap: `docs/implementation_roadmap.md` - Phased development plan
