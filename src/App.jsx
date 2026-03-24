import { useState, useEffect } from 'react'
import { storeTranscription, getTranscriptions, deleteTranscription } from './db'
import './App.css'

function App() {
  const [file, setFile] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [savedTranscriptions, setSavedTranscriptions] = useState([])
  const [showHistory, setShowHistory] = useState(false)

  // Load transcriptions on mount
  useEffect(() => {
    loadTranscriptions()
  }, [])

  const loadTranscriptions = async () => {
    const result = await getTranscriptions()
    if (result.success) {
      setSavedTranscriptions(result.data || [])
    }
  }

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

      // Store in Supabase
      const fileName = file.name
      const result = await storeTranscription(fileName, data.text)
      
      if (result.success) {
        setError('') // Clear error
        // Refresh the transcription list
        await loadTranscriptions()
      } else {
        console.warn('Could not save to database:', result.error)
      }
    } catch (err) {
      setError('Transcription failed: ' + (err.message || 'unknown error'))
      setTranscript('')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTranscription = async (id) => {
    const result = await deleteTranscription(id)
    if (result.success) {
      await loadTranscriptions()
    } else {
      setError('Failed to delete: ' + result.error)
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
          <h2>Current Transcript</h2>
          <p>{transcript}</p>
        </div>
      )}

      <button 
        onClick={() => setShowHistory(!showHistory)}
        style={{ marginTop: '20px', padding: '10px 20px' }}
      >
        {showHistory ? 'Hide History' : 'Show History'}
      </button>

      {showHistory && (
        <div className="history" style={{ marginTop: '20px' }}>
          <h2>Saved Transcriptions ({savedTranscriptions.length})</h2>
          {savedTranscriptions.length === 0 ? (
            <p>No saved transcriptions yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {savedTranscriptions.map((item) => (
                <li 
                  key={item.id}
                  style={{
                    border: '1px solid #ddd',
                    padding: '10px',
                    marginBottom: '10px',
                    borderRadius: '5px'
                  }}
                >
                  <strong>{item.filename}</strong>
                  <p>{item.transcript}</p>
                  <small>{new Date(item.created_at).toLocaleString()}</small>
                  <button
                    onClick={() => handleDeleteTranscription(item.id)}
                    style={{
                      marginTop: '10px',
                      padding: '5px 10px',
                      backgroundColor: '#ff4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '3px',
                      cursor: 'pointer'
                    }}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <footer>
        <small>Powered by Deepgram API & Supabase</small>
      </footer>
    </div>
  )
}

export default App
