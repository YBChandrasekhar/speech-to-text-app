# Speech-to-Text App

A full-stack speech-to-text transcription application using **React**, **Vite**, **Express**, and **OpenAI Whisper API**.

## Features

- 🎤 Upload audio files (WAV, MP3, M4A, WebM)
- 🤖 Speech-to-text transcription using OpenAI Whisper (`whisper-1`)
- ⚡ Fast, responsive UI with React + Vite
- 🔄 Vite proxy for seamless frontend-backend communication
- 🛡️ CORS-enabled Express backend

## Tech Stack

- **Frontend:** React 19 + Vite 8 + TailwindCSS
- **Backend:** Express.js + Multer
- **API:** Deepgram Speech-to-Text
- **Deploy:** Node.js

## Prerequisites

- Node.js (v18+ for built-in fetch/FormData or adjust with polyfills)
- npm or yarn
- OpenAI API key ([get one](https://platform.openai.com/))

## Installation

```bash
# Clone repository
git clone https://github.com/yourusername/speech-to-text-app.git
cd speech-to-text-app

# Install dependencies
npm install
```

## Configuration

Create a `.env` file in the root directory:

```env
OPENAI_API_KEY=your_openai_api_key
```

## Running the Application

### Development

**Terminal 1 - Start backend:**
```bash
node server.js
# Server runs on http://localhost:5000
```

**Terminal 2 - Start frontend:**
```bash
npm run dev
# Frontend runs on http://localhost:5176 (or next available port)
```

### Production Build

```bash
npm run build
npm run preview
```

## API Endpoints

### POST `/transcribe`
Transcribe an audio file.

**Request:**
```bash
curl -X POST http://localhost:5000/transcribe \
  -F "audio=@audio.wav"
```

**Response:**
```json
{
  "text": "Hello, this is a test transcription"
}
```

## Project Structure

```
speech-to-text-app/
├── src/
│   ├── App.jsx           # Main React component
│   ├── App.css           # Styles
│   └── main.jsx          # Entry point
├── public/               # Static assets
├── server.js             # Express backend
├── vite.config.js        # Vite configuration with proxy
├── package.json
├── .env                  # Environment variables (not committed)
└── README.md
```

## Troubleshooting

### Backend connection refused
```bash
# Make sure backend is running on port 5000
node server.js
```

### Invalid API key
Verify `DEEPGRAM_API_KEY` in `.env` is correct.

### Audio file not transcribing
Ensure audio file is:
- Valid WAV/MP3/M4A/WebM format
- Contains speech (not silent)
- Less than size limits (check Deepgram docs)

## Contributing

Fork, create a feature branch, and submit a pull request.

## License

ISC
