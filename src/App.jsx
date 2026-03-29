import { useState, useEffect, useRef } from "react";

const ALLOWED_TYPES = ["audio/wav", "audio/mpeg", "audio/mp4", "audio/webm", "audio/x-m4a", "video/webm"];
const MAX_SIZE_MB = 25;

function App() {
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [history, setHistory] = useState([]);

  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const res = await fetch("http://localhost:5000/transcriptions");
      if (!res.ok) throw new Error("Failed to load history.");
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

  // ✅ Validate file type & size
  const validateFile = (f) => {
    if (!ALLOWED_TYPES.includes(f.type)) {
      return `Invalid file type "${f.type}". Please upload WAV, MP3, M4A, or WebM.`;
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return `File too large. Maximum allowed size is ${MAX_SIZE_MB}MB.`;
    }
    return null;
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (!selected) return;
    const validationError = validateFile(selected);
    if (validationError) {
      setError(validationError);
      setFile(null);
      e.target.value = "";
      return;
    }
    setFile(selected);
    setTranscript("");
    setError("");
  };

  // 🎙 Start Recording — handle mic permission denial
  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunks.current = [];

      recorder.ondataavailable = (e) => {
        audioChunks.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        const recordedFile = new File([blob], "recording.webm", { type: "audio/webm" });
        setFile(recordedFile);
        setError("");
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      if (err.name === "NotAllowedError") {
        setError("Microphone access denied. Please allow microphone permission and try again.");
      } else if (err.name === "NotFoundError") {
        setError("No microphone found. Please connect a microphone and try again.");
      } else {
        setError(`Recording failed: ${err.message}`);
      }
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  // 🚀 Transcribe
  const handleSubmit = async () => {
    if (!file) {
      setError("Please upload or record audio before transcribing.");
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError("");
    setTranscript("");

    try {
      const formData = new FormData();
      formData.append("audio", file);

      const res = await fetch("http://localhost:5000/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed. Please try again.");

      setTranscript(data.text);
      loadHistory();
    } catch (err) {
      if (err.message === "Failed to fetch") {
        setError("Cannot connect to server. Make sure the backend is running on port 5000.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // ❌ Delete — show error if it fails
  const handleDelete = async (id) => {
    // ✅ Fix CWE-918: validate id is a safe positive integer before using in URL
    const safeId = parseInt(id, 10);
    if (!Number.isInteger(safeId) || safeId <= 0) {
      setError("Invalid transcription ID.");
      return;
    }

    try {
      const res = await fetch(`http://localhost:5000/transcriptions/${safeId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed.");
      }
      loadHistory();
    } catch (err) {
      setError(`Delete failed: ${err.message}`);
    }
  };

  const downloadText = (text) => {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "transcript.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-100">

      {/* HEADER */}
      <header className="bg-white shadow p-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-700">
          🎤 Speech Dashboard
        </h1>
        <span className="text-sm text-gray-500">
          {history.length} Transcriptions
        </span>
      </header>

      <div className="grid md:grid-cols-2 gap-6 p-6">

        {/* LEFT PANEL */}
        <div className="bg-white p-6 rounded-xl shadow">

          <h2 className="text-lg font-semibold mb-4">
            Upload / Record
          </h2>

          <input
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            className="mb-4 w-full border p-2 rounded"
          />

          <div className="flex gap-3 mb-4 items-center">
            <button
              onClick={startRecording}
              disabled={isRecording}
              className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition"
            >
              🎙 Start
            </button>

            <button
              onClick={stopRecording}
              disabled={!isRecording}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded transition"
            >
              ⏹ Stop
            </button>

            {isRecording && (
              <span className="text-red-500 animate-pulse">
                ● Recording...
              </span>
            )}
          </div>

          <button
            onClick={handleSubmit}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-semibold transition"
          >
            🚀 Transcribe
          </button>

          {loading && (
            <p className="mt-3 text-blue-500 animate-pulse">
              ⏳ Processing audio...
            </p>
          )}

          {error && (
            <p className="mt-3 text-red-500 bg-red-50 border border-red-200 rounded p-2 text-sm">
              ⚠️ {error}
            </p>
          )}

          {transcript && (
            <div className="mt-4 p-4 bg-gray-100 rounded-lg shadow-inner">
              <h3 className="font-semibold mb-2 text-gray-700">
                📝 Result
              </h3>
              <p className="text-gray-800">{transcript}</p>
            </div>
          )}
        </div>

        {/* RIGHT PANEL */}
        <div className="bg-white p-6 rounded-xl shadow max-h-[75vh] overflow-y-auto">

          <h2 className="text-lg font-semibold mb-4">
            History
          </h2>

          {history.map((item) => (
            <div
              key={item.id}
              className="bg-gray-50 p-4 mb-4 rounded-lg shadow hover:shadow-md transition transform hover:scale-[1.02]"
            >
              <div className="flex justify-between items-center">
                <strong className="text-gray-700">
                  {item.filename}
                </strong>
                <span className="text-xs text-gray-500">
                  {item.source}
                </span>
              </div>

              <p className="text-gray-800 text-sm mt-2">
                {item.transcript}
              </p>

              <div className="flex justify-between mt-3 text-xs text-gray-500">
                <span>
                  {new Date(item.created_at).toLocaleString()}
                </span>

                <div className="flex gap-3">
                  <button
                    onClick={() => downloadText(item.transcript)}
                    className="text-blue-500 hover:underline"
                  >
                    Download
                  </button>

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-red-500 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

        </div>
      </div>
    </div>
  );
}

export default App;