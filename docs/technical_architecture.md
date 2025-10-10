# Technical Architecture - MVP

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Browser                           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Web Application UI                         │ │
│  │                                                          │ │
│  │  ┌───────────┐  ┌──────────────┐  ┌─────────────────┐  │ │
│  │  │   Left    │  │    Center    │  │     Bottom      │  │ │
│  │  │  Asset    │  │    Video     │  │     Prompt      │  │ │
│  │  │  Manager  │  │    Viewer    │  │     Input       │  │ │
│  │  └───────────┘  └──────────────┘  └─────────────────┘  │ │
│  │                                                          │ │
│  │  ┌──────────────────────────────────────────────────┐   │ │
│  │  │         Application State Manager               │   │ │
│  │  └──────────────────────────────────────────────────┘   │ │
│  │                                                          │ │
│  │  ┌──────────────────────────────────────────────────┐   │ │
│  │  │         Sora2 API Client                        │   │ │
│  │  └──────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────┘ │
│                           ↕                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │         Local Storage / IndexedDB                      │ │
│  │         (Assets, Videos, Prompts)                      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                           ↕
                    HTTPS API Calls
                           ↕
              ┌──────────────────────┐
              │   Sora2 API Service  │
              └──────────────────────┘
```

## Component Details

### 1. Asset Manager Component (Left Panel)
- **Responsibilities**:
  - Handle drag & drop file uploads
  - Display asset thumbnails in grid
  - Store uploaded files in IndexedDB
  - Provide asset selection interface

- **Key Functions**:
  - `handleDrop(files)` - Process dropped files
  - `saveAsset(file)` - Save to local storage
  - `loadAssets()` - Retrieve and display saved assets
  - `deleteAsset(id)` - Remove asset

### 2. Video Viewer Component (Center Panel)
- **Responsibilities**:
  - Display generated videos
  - Provide playback controls
  - Show loading/generation status

- **Key Functions**:
  - `loadVideo(url)` - Load video into player
  - `downloadVideo()` - Download video file
  - `showStatus(message)` - Display generation status

### 3. Prompt Input Component (Bottom Panel)
- **Responsibilities**:
  - Text input for prompts
  - Submit prompts to Sora2
  - Show generation progress

- **Key Functions**:
  - `submitPrompt(text)` - Send to Sora2 API
  - `savePromptHistory(prompt)` - Store prompt
  - `updateProgress(status)` - Update UI status

### 4. Sora2 API Client
- **Responsibilities**:
  - Authenticate with Sora2 API
  - Submit generation requests
  - Poll for completion status
  - Download generated videos

- **Key Functions**:
  - `authenticate(apiKey)` - Setup API credentials
  - `generateVideo(prompt, options)` - Create video request
  - `checkStatus(jobId)` - Poll generation status
  - `downloadVideo(url)` - Fetch completed video

### 5. State Manager
- **Responsibilities**:
  - Manage application state
  - Coordinate between components
  - Handle error states

- **State Structure**:
```javascript
{
  assets: [],
  currentVideo: null,
  generationStatus: 'idle' | 'generating' | 'complete' | 'error',
  promptHistory: [],
  apiConfig: {
    apiKey: '',
    baseUrl: ''
  }
}
```

## Data Storage

### IndexedDB Schema

**Assets Store**:
```javascript
{
  id: string,
  fileName: string,
  fileType: string,
  blob: Blob,
  uploadedAt: timestamp
}
```

**Videos Store**:
```javascript
{
  id: string,
  prompt: string,
  videoBlob: Blob,
  videoUrl: string,
  generatedAt: timestamp,
  soraJobId: string
}
```

**Prompts Store**:
```javascript
{
  id: string,
  text: string,
  createdAt: timestamp,
  videoId: string (optional)
}
```

## API Integration

### Sora2 API Endpoints (Example)

1. **Generate Video**
   - `POST /v1/generate`
   - Body: `{ prompt: string, duration: number }`
   - Response: `{ jobId: string, status: string }`

2. **Check Status**
   - `GET /v1/status/{jobId}`
   - Response: `{ status: string, progress: number, videoUrl?: string }`

3. **Download Video**
   - `GET /v1/download/{jobId}`
   - Response: Video file blob

## File Structure

```
short_form_drama_workflow/
├── index.html              # Main HTML file
├── src/
│   ├── main.js            # Application entry point
│   ├── components/
│   │   ├── AssetManager.js
│   │   ├── VideoViewer.js
│   │   └── PromptInput.js
│   ├── services/
│   │   ├── Sora2Client.js
│   │   └── StorageService.js
│   ├── state/
│   │   └── AppState.js
│   └── utils/
│       ├── fileHandler.js
│       └── constants.js
├── styles/
│   └── main.css
├── config/
│   └── sora2_config.json  # API configuration
└── package.json
```

## Security Considerations

- Store API keys securely (environment variables, not in code)
- Validate file types before upload
- Implement file size limits
- Use HTTPS for all API calls
- Sanitize user input in prompts
