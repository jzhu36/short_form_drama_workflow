#!/bin/bash

# Start Video Generation Backend Service

echo "=========================================="
echo "Video Generation Backend Service"
echo "=========================================="
echo ""

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "⚠️  Virtual environment not found. Creating one..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "🔧 Activating virtual environment..."
source venv/bin/activate

# Install/upgrade dependencies
echo "📦 Installing dependencies..."
pip install -q flask flask-cors openai google-genai python-dotenv

# Check for .env file
if [ ! -f "../.env" ] && [ ! -f "../../ai-short-drama/.env" ]; then
    echo ""
    echo "⚠️  WARNING: .env file not found!"
    echo "   Please create .env file with:"
    echo "   - OPENAI_API_KEY=your_key_here"
    echo "   - GEMINI_API_KEY=your_key_here"
    echo ""
    echo "   Place it in the project root or ai-short-drama directory"
    echo ""
fi

# Create videos directory
mkdir -p videos

echo ""
echo "✅ Backend service starting on http://localhost:5001"
echo ""
echo "Available endpoints:"
echo "  - POST   /api/videos/generate"
echo "  - GET    /api/videos/list"
echo "  - GET    /api/videos/{id}/status"
echo "  - GET    /api/videos/{id}/download"
echo "  - DELETE /api/videos/{id}"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=========================================="
echo ""

# Start the Flask server
/usr/bin/python3 video_service.py
