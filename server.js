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

// 📁 Multer setup
const upload = multer({ dest: "uploads/" });

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

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          const result = JSON.parse(data);
          if (result.error) reject(new Error(result.error));
          else resolve(result);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on("error", (err) => reject(err));

    req.write(audioBuffer);
    req.end();
  });
}

// 🚀 1. TRANSCRIBE + STORE IN DB
app.post("/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file uploaded" });
  }

  try {
    const audio = fs.readFileSync(req.file.path);
    const mimeType = req.file.mimetype || "audio/wav";

    // 🎤 Transcribe
    const response = await transcribeAudio(audio, mimeType);

    const transcript =
      response?.results?.channels?.[0]?.alternatives?.[0]?.transcript;

    if (!transcript) {
      return res.status(500).json({ error: "No transcript returned" });
    }

    // ✅ STORE IN SUPABASE (BACKEND)
    const { error: dbError } = await supabase
      .from("transcriptions")
      .insert([
        {
          filename: req.file.originalname,
          transcript: transcript, // ✅ FIXED
        },
      ]);

    if (dbError) {
      console.error("DB ERROR:", dbError);
      return res.status(500).json({ error: dbError.message });
    }

    // 🧹 Clean temp file
    fs.unlink(req.file.path, () => { });

    // ✅ Send response
    res.json({ text: transcript });

  } catch (error) {
    console.error("Transcription error:", error);
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
      return res.status(500).json({ error: "Fetch failed" });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// ❌ 3. DELETE TRANSCRIPTION
app.delete("/transcriptions/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("transcriptions")
      .delete()
      .eq("id", id);

    if (error) {
      return res.status(500).json({ error: "Delete failed" });
    }

    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// 🚀 Start server
app.listen(5000, () => {
  console.log("✅ Server running on http://localhost:5000");
});