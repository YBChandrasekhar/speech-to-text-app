import { useState } from 'react'
import './App.css'

function App() {
  const [file, setFile] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleFileChange = (event) => {
    setError('')
    setTranscript('')
    setFile(event.target.files[0] || null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!file) {
      setError('Please choose an audio file first.')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('audio', file)

      const res = await fetch('http://localhost:5000/transcribe', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Transcription request failed')
      }

      setTranscript(data.text || '')
    } catch (err) {
      setError('Transcription failed: ' + (err.message || 'unknown error'))
      setTranscript('')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="app-container">
      <h1>Deepgram Speech-to-Text</h1>
      <p>Upload an audio file (wav/mp3/m4a/webm) and get transcript from backend.</p>

      <form onSubmit={handleSubmit}>
        <input type="file" accept="audio/*" onChange={handleFileChange} />
        <button type="submit" disabled={isLoading}>
          {isLoading ? 'Transcribing...' : 'Transcribe'}
        </button>
      </form>

      {error && <div className="error">{error}</div>}
      {transcript && (
        <div className="result">
          <h2>Transcript</h2>
          <p>{transcript}</p>
        </div>
      )}

      <footer>
        <small>Powered by Deepgram API</small>
      </footer>
    </div>
  )
}

export default App
