import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import https from "https";
import fs from "fs";

dotenv.config();

const app = express();
app.use(cors());

const upload = multer({ dest: "uploads/" });

// Direct Deepgram API call function
async function transcribeAudio(audioBuffer, mimetype) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.deepgram.com',
      path: '/v1/listen?model=nova-2&punctuate=true',
      method: 'POST',
      headers: {
        'Authorization': `Token ${process.env.DEEPGRAM_API_KEY}`,
        'Content-Type': mimetype || 'audio/wav'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result);
          }
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(audioBuffer);
    req.end();
  });
}

app.post("/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file uploaded" });
  }

  try {
    const audio = fs.readFileSync(req.file.path);
    const mimeType = req.file.mimetype || "audio/wav";

    const response = await transcribeAudio(audio, mimeType);

    // cleanup temp file
    fs.unlink(req.file.path, (err) => {
      if (err) console.warn("Could not delete temp file:", err);
    });

    const transcript = response?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
    if (!transcript) {
      return res.status(500).json({ error: "No transcript returned from Deepgram" });
    }

    res.json({ text: transcript });
  } catch (error) {
    console.error("Transcription failed", error);
    res.status(500).json({ error: error.message || "Error transcribing audio" });
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));