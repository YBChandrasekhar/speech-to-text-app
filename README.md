# Speech-to-Text App

A full-stack speech-to-text transcription application using **React**, **Vite**, **Express**, and **Deepgram API**, with **Supabase** for authentication and database.

## Features

- 🎤 Upload audio files (WAV, MP3, M4A, WebM)
- 🎙️ Record audio directly from the browser microphone
- 🤖 Speech-to-text transcription using Deepgram Nova-2
- 🔐 User authentication via Supabase (sign up, login, logout)
- 📝 Transcription history per user (save, view, delete, download)
- ⚡ Fast, responsive UI with React + Vite + TailwindCSS
- 🛡️ CORS-enabled Express backend with CSRF protection
- 🔄 Vite proxy for seamless local frontend-backend communication

## Tech Stack

- **Frontend:** React 19 + Vite + TailwindCSS
- **Backend:** Express.js + Multer
- **Auth & Database:** Supabase
- **Speech API:** Deepgram Nova-2
- **Backend Deploy:** Render
- **Frontend Deploy:** Vercel

## Prerequisites

- Node.js v18+
- npm
- Deepgram API key — [get one free](https://deepgram.com/)
- Supabase project — [create one free](https://supabase.com/)

## Installation

```bash
# Clone repository
git clone https://github.com/YBChandrasekhar/speech-to-text-app.git
cd speech-to-text-app

# Install dependencies
npm install
