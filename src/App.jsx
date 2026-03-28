import { useState, useEffect, useRef } from "react";

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

  // 📥 Fetch history from backend
  const loadHistory = async () => {
    try {
      const res = await fetch("http://localhost:5000/transcriptions");
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

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
      const recordedFile = new File([blob], "recording.webm");
      setFile(recordedFile);
    };

    recorder.start();
    setIsRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  // 🚀 Transcribe
  const handleSubmit = async () => {
    if (!file) {
      setError("Please upload or record audio");
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
      if (!res.ok) throw new Error(data.error);

      setTranscript(data.text);

      // Refresh history (backend already saved)
      loadHistory();

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ❌ Delete
  const handleDelete = async (id) => {
    try {
      await fetch(`http://localhost:5000/transcriptions/${id}`, {
        method: "DELETE",
      });
      loadHistory();
    } catch (err) {
      console.error(err);
    }
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
            <p className="mt-3 text-red-500">{error}</p>
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