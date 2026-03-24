import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
app.use(cors());

const upload = multer({ dest: "uploads/" });

// OpenAI Whisper transcription function
async function transcribeAudio(filePath) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY in environment');
  }

  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));
  formData.append('model', 'whisper-1');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

app.post("/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file uploaded" });
  }

  try {
    const response = await transcribeAudio(req.file.path);

    // cleanup temp file
    fs.unlink(req.file.path, (err) => {
      if (err) console.warn("Could not delete temp file:", err);
    });

    const transcript = response?.text;
    if (!transcript) {
      return res.status(500).json({ error: "No transcript returned from Whisper" });
    }

    res.json({ text: transcript });
  } catch (error) {
    console.error("Transcription failed", error);
    res.status(500).json({ error: error.message || "Error transcribing audio" });
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));