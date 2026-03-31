import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import https from "https";
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config();
const app = express();

const allowedOrigins = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : ["http://localhost:5173", "http://localhost:5174"];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

function csrfProtection(req, res, next) {
  const origin = req.headers.origin || req.headers.referer || "";
  const allowed = allowedOrigins.some((o) => origin.startsWith(o));
  if (!allowed) return res.status(403).json({ error: "CSRF check failed." });
  next();
}

const ALLOWED_MIMETYPES = [
  "audio/wav", "audio/mpeg", "audio/mp4",
  "audio/webm", "audio/x-m4a", "video/webm",
];

// Fix: resolve UPLOADS_DIR to absolute path once at startup
const UPLOADS_DIR = path.resolve("uploads");

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Invalid file type: "${file.mimetype}". Allowed: WAV, MP3, M4A, WebM`));
  },
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized. Please log in." });

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Invalid or expired session." });

  req.user = user;
  next();
}

// Fix: normalize + verify path stays inside UPLOADS_DIR
function safeFilePath(filePath) {
  const resolved = path.normalize(path.resolve(filePath));
  if (!resolved.startsWith(UPLOADS_DIR + path.sep) && resolved !== UPLOADS_DIR) {
    throw new Error("Invalid file path.");
  }
  return resolved;
}

// Fix: strictly validate mimetype before using it in the request header (prevents SSRF via header injection)
async function transcribeAudio(audioBuffer, mimetype) {
  const safeMime = ALLOWED_MIMETYPES.includes(mimetype) ? mimetype : "audio/wav";

  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.deepgram.com",           // hardcoded — not user-controlled
      path: "/v1/listen?model=nova-2&punctuate=true",
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": safeMime,             // validated value only
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode === 401) return reject(new Error("Invalid Deepgram API key."));
          if (res.statusCode === 400) return reject(new Error("Deepgram rejected the audio."));
          if (res.statusCode >= 500) return reject(new Error("Deepgram service error. Try again later."));
          if (result.error) return reject(new Error(`Deepgram error: ${result.error}`));
          resolve(result);
        } catch {
          reject(new Error("Failed to parse Deepgram response."));
        }
      });
    });

    req.on("error", (err) => reject(new Error(`Network error: ${err.message}`)));
    req.write(audioBuffer);
    req.end();
  });
}

app.post("/transcribe", requireAuth, csrfProtection, (req, res, next) => {
  upload.single("audio")(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE")
      return res.status(400).json({ error: "File too large. Maximum allowed size is 25MB." });
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No audio file uploaded." });

  let safePath;
  try {
    safePath = safeFilePath(req.file.path);
  } catch {
    return res.status(400).json({ error: "Invalid file path." });
  }

  try {
    const audio = fs.readFileSync(safePath);
    const mimeType = req.file.mimetype || "audio/wav";

    const response = await transcribeAudio(audio, mimeType);
    const transcript = response?.results?.channels?.[0]?.alternatives?.[0]?.transcript;

    if (!transcript) return res.status(422).json({ error: "No speech detected in the audio file." });

    const { error: dbError } = await supabase
      .from("transcriptions")
      .insert([{ filename: req.file.originalname, transcript, user_id: req.user.id }]);

    if (dbError) {
      console.error("DB ERROR:", dbError);
      return res.status(500).json({ error: `Database error: ${dbError.message}` });
    }

    fs.unlink(safePath, () => {});
    res.json({ text: transcript });

  } catch (error) {
    if (safePath) fs.unlink(safePath, () => {});
    console.error("Transcription error:", error.message);
    res.status(500).json({ error: error.message || "Server error" });
  }
});

app.get("/transcriptions", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("transcriptions")
      .select("*")
      .eq("user_id", req.user.id)
      .order("id", { ascending: false });

    if (error) return res.status(500).json({ error: "Failed to fetch transcription history." });
    res.json(data);
  } catch {
    res.status(500).json({ error: "Server error while fetching history." });
  }
});

app.delete("/transcriptions/:id", requireAuth, csrfProtection, async (req, res) => {
  try {
    const { id } = req.params;
    if (!id || isNaN(Number(id))) return res.status(400).json({ error: "Invalid transcription ID." });

    const { error } = await supabase
      .from("transcriptions")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user.id);

    if (error) return res.status(500).json({ error: "Failed to delete transcription." });
    res.json({ message: "Deleted successfully" });
  } catch {
    res.status(500).json({ error: "Server error while deleting." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));