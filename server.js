import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import https from "https";
import fs from "fs";
import { createClient } from "@supabase/supabase-js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// 📁 Multer setup — validate file type & size
const ALLOWED_MIMETYPES = ["audio/wav", "audio/mpeg", "audio/mp4", "audio/webm", "audio/x-m4a", "video/webm"];

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB limit
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type: "${file.mimetype}". Allowed types: WAV, MP3, M4A, WebM`));
    }
  },
});

// 🗄 Supabase setup
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// 🎤 Deepgram API call
async function transcribeAudio(audioBuffer, mimetype) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.deepgram.com",
      path: "/v1/listen?model=nova-2&punctuate=true",
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": mimetype || "audio/wav",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";

      res.on("data", (chunk) => { data += chunk; });

      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode === 401) return reject(new Error("Invalid Deepgram API key. Check your DEEPGRAM_API_KEY."));
          if (res.statusCode === 400) return reject(new Error("Deepgram rejected the audio. Ensure the file contains valid speech."));
          if (res.statusCode >= 500) return reject(new Error("Deepgram service error. Please try again later."));
          if (result.error) return reject(new Error(`Deepgram error: ${result.error}`));
          resolve(result);
        } catch (err) {
          reject(new Error("Failed to parse Deepgram response."));
        }
      });
    });

    req.on("error", (err) => reject(new Error(`Network error reaching Deepgram: ${err.message}`)));

    req.write(audioBuffer);
    req.end();
  });
}

// 🚀 1. TRANSCRIBE + STORE IN DB
app.post("/transcribe", (req, res, next) => {
  upload.single("audio")(req, res, (err) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large. Maximum allowed size is 25MB." });
    }
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file uploaded." });
  }

  try {
    const audio = fs.readFileSync(req.file.path);
    const mimeType = req.file.mimetype || "audio/wav";

    // 🎤 Transcribe
    const response = await transcribeAudio(audio, mimeType);

    const transcript =
      response?.results?.channels?.[0]?.alternatives?.[0]?.transcript;

    if (!transcript) {
      return res.status(422).json({ error: "No speech detected in the audio file." });
    }

    // ✅ STORE IN SUPABASE (BACKEND)
    const { error: dbError } = await supabase
      .from("transcriptions")
      .insert([{ filename: req.file.originalname, transcript }]);

    if (dbError) {
      console.error("DB ERROR:", dbError);
      return res.status(500).json({ error: `Database error: ${dbError.message}` });
    }

    // 🧹 Clean temp file
    fs.unlink(req.file.path, () => {});

    res.json({ text: transcript });

  } catch (error) {
    // 🧹 Clean temp file on error too
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    console.error("Transcription error:", error.message);
    res.status(500).json({ error: error.message || "Server error" });
  }
});

// 📜 2. FETCH HISTORY
app.get("/transcriptions", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("transcriptions")
      .select("*")
      .order("id", { ascending: false });

    if (error) {
      return res.status(500).json({ error: "Failed to fetch transcription history." });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Server error while fetching history." });
  }
});

// ❌ 3. DELETE TRANSCRIPTION
app.delete("/transcriptions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: "Invalid transcription ID." });
    }

    const { error } = await supabase
      .from("transcriptions")
      .delete()
      .eq("id", id);

    if (error) {
      return res.status(500).json({ error: "Failed to delete transcription." });
    }

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Server error while deleting." });
  }
});

// 🚀 Start server
app.listen(5000, () => {
  console.log("✅ Server running on http://localhost:5000");
}); 