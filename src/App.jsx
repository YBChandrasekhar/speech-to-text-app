import { useState, useEffect, useRef } from "react";
import {
  storeTranscription,
  getTranscriptions,
  deleteTranscription,
} from "./db";

function App() {
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [history, setHistory] = useState([]);

  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    const res = await getTranscriptions();
    if (res.success) setHistory(res.data);
  };

  // 📁 File Upload
  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setTranscript("");
    setError("");
  };

  // 🎙 Start Recording
  const startRecording = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    audioChunks.current = [];

    recorder.ondataavailable = (e) => {
      audioChunks.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(audioChunks.current, { type: "audio/webm" });
      const file = new File([blob], "recording.webm");
      setFile(file);
    };

    recorder.start();
    setIsRecording(true);
  };

  // 🛑 Stop Recording
  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  // 🚀 Send to backend
  const handleSubmit = async () => {
    if (!file) {
      setError("Please upload or record audio");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("audio", file);

      const res = await fetch("http://localhost:5000/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setTranscript(data.text);

      const source =
        file.name === "recording.webm" ? "recording" : "upload";

      await storeTranscription(file.name, data.text, source);
      loadHistory();
    } catch (err) {
      setError(err.message);
    }
  };

  // ❌ Delete
  const handleDelete = async (id) => {
    await deleteTranscription(id);
    loadHistory();
  };

  // 📥 Download
  const downloadText = (text) => {
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.txt";
    a.click();
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6 flex flex-col items-center">
      <h1 className="text-3xl font-bold mb-4">🎤 Speech-to-Text App</h1>

      <div className="bg-white p-6 rounded-xl shadow w-full max-w-md">
        <input type="file" accept="audio/*" onChange={handleFileChange} />

        <div className="flex gap-3 mt-3">
          <button
            onClick={startRecording}
            disabled={isRecording}
            className="bg-green-500 text-white px-3 py-1 rounded"
          >
            Record
          </button>

          <button
            onClick={stopRecording}
            disabled={!isRecording}
            className="bg-red-500 text-white px-3 py-1 rounded"
          >
            Stop
          </button>
        </div>

        <button
          onClick={handleSubmit}
          className="mt-4 w-full bg-blue-500 text-white py-2 rounded"
        >
          Transcribe
        </button>

        {error && <p className="text-red-500 mt-2">{error}</p>}

        {transcript && (
          <div className="mt-4 bg-gray-200 p-3 rounded">
            <h3 className="font-bold">Transcript:</h3>
            <p>{transcript}</p>
          </div>
        )}
      </div>

      {/* History */}
      <div className="mt-6 w-full max-w-md">
        <h2 className="text-xl font-bold mb-2">
          History ({history.length})
        </h2>

        {history.map((item) => (
          <div
            key={item.id}
            className="bg-white p-3 mb-2 rounded shadow"
          >
            <strong>{item.filename}</strong>
            <span className="text-gray-500 ml-2">
              ({item.source})
            </span>

            <p>{item.transcript}</p>

            <small>
              {new Date(item.created_at).toLocaleString()}
            </small>

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => downloadText(item.transcript)}
                className="bg-blue-400 text-white px-2 py-1 rounded"
              >
                Download
              </button>

              <button
                onClick={() => handleDelete(item.id)}
                className="bg-red-500 text-white px-2 py-1 rounded"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;