import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabaseClient";
import Auth from "./Auth";

const ALLOWED_TYPES = ["audio/wav", "audio/mpeg", "audio/mp4", "audio/webm", "audio/x-m4a", "video/webm"];
const MAX_SIZE_MB = 25;
const API = "";

function App() {
  const [session, setSession] = useState(null);
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [history, setHistory] = useState([]);

  const mediaRecorderRef = useRef(null);
  const audioChunks = useRef([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) loadHistory();
    else setHistory([]);
  }, [session]);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const loadHistory = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${API}/transcriptions`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load history.");
      const data = await res.json();
      setHistory(data);
    } catch (err) {
      console.error(err);
    }
  };

  const validateFile = (f) => {
    if (!ALLOWED_TYPES.includes(f.type))
      return `Invalid file type "${f.type}". Please upload WAV, MP3, M4A, or WebM.`;
    if (f.size > MAX_SIZE_MB * 1024 * 1024)
      return `File too large. Maximum allowed size is ${MAX_SIZE_MB}MB.`;
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

  const startRecording = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunks.current = [];

      recorder.ondataavailable = (e) => audioChunks.current.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        setFile(new File([blob], "recording.webm", { type: "audio/webm" }));
        setError("");
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      if (err.name === "NotAllowedError")
        setError("Microphone access denied. Please allow microphone permission and try again.");
      else if (err.name === "NotFoundError")
        setError("No microphone found. Please connect a microphone and try again.");
      else
        setError(`Recording failed: ${err.message}`);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const handleSubmit = async () => {
    if (!file) { setError("Please upload or record audio before transcribing."); return; }
    const validationError = validateFile(file);
    if (validationError) { setError(validationError); return; }

    setLoading(true);
    setError("");
    setTranscript("");

    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("audio", file);

      const res = await fetch(`${API}/transcribe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed. Please try again.");

      setTranscript(data.text);
      loadHistory();
    } catch (err) {
      setError(
        err.message === "Failed to fetch"
          ? "Cannot connect to server. Make sure the backend is running on port 5000."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    const safeId = parseInt(id, 10);
    if (!Number.isInteger(safeId) || safeId <= 0) { setError("Invalid transcription ID."); return; }

    try {
      const token = await getToken();
      const res = await fetch(`${API}/transcriptions/${safeId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
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

  if (!session) return <Auth />;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow p-4 flex justify-between items-center sticky top-0 z-10">
        <h1 className="text-xl font-bold text-gray-700">🎤 Speech Dashboard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-500">{session.user.email}</span>
          <span className="text-sm text-gray-400">|</span>
          <span className="text-sm text-gray-500">{history.length} Transcriptions</span>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-red-500 hover:underline"
          >
            Logout
          </button>
        </div>
      </header>

      <div className="grid md:grid-cols-2 gap-6 p-6">
        <div className="bg-white p-6 rounded-xl shadow">
          <h2 className="text-lg font-semibold mb-4">Upload / Record</h2>

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
            {isRecording && <span className="text-red-500 animate-pulse">● Recording...</span>}
          </div>

          <button
            onClick={handleSubmit}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded font-semibold transition"
          >
            🚀 Transcribe
          </button>

          {loading && <p className="mt-3 text-blue-500 animate-pulse">⏳ Processing audio...</p>}

          {error && (
            <p className="mt-3 text-red-500 bg-red-50 border border-red-200 rounded p-2 text-sm">
              ⚠️ {error}
            </p>
          )}

          {transcript && (
            <div className="mt-4 p-4 bg-gray-100 rounded-lg shadow-inner">
              <h3 className="font-semibold mb-2 text-gray-700">📝 Result</h3>
              <p className="text-gray-800">{transcript}</p>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-xl shadow max-h-[75vh] overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">History</h2>

          {history.length === 0 && (
            <p className="text-gray-400 text-sm">No transcriptions yet.</p>
          )}

          {history.map((item) => (
            <div
              key={item.id}
              className="bg-gray-50 p-4 mb-4 rounded-lg shadow hover:shadow-md transition transform hover:scale-[1.02]"
            >
              <div className="flex justify-between items-center">
                <strong className="text-gray-700">{item.filename}</strong>
                <span className="text-xs text-gray-500">{item.source}</span>
              </div>
              <p className="text-gray-800 text-sm mt-2">{item.transcript}</p>
              <div className="flex justify-between mt-3 text-xs text-gray-500">
                <span>{new Date(item.created_at).toLocaleString()}</span>
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