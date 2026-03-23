import express from "express";
import multer from "multer";
import cors from "cors";
import dotenv from "dotenv";
import https from "https";
import fs from "fs";
import { connectDB } from "./db.js";
import Transcription from "./models/Transcription.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// Connect to MongoDB
connectDB().catch((err) => {
  console.error("Failed to connect to MongoDB:", err);
  process.exit(1);
});

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

    // Extract confidence if available
    const confidence = response?.results?.channels?.[0]?.alternatives?.[0]?.confidence;

    // Save to MongoDB
    const transcriptionRecord = new Transcription({
      fileName: req.file.originalname || req.file.filename,
      filePath: req.file.path,
      mimeType: mimeType,
      fileSize: req.file.size || 0,
      transcript: transcript,
      confidence: confidence || null,
      deepgramResponse: response,
      status: 'completed',
    });

    await transcriptionRecord.save();

    res.json({ 
      text: transcript,
      id: transcriptionRecord._id,
      confidence: confidence,
    });
  } catch (error) {
    console.error("Transcription failed", error);
    res.status(500).json({ error: error.message || "Error transcribing audio" });
  }
});

// Get all transcriptions
app.get("/transcriptions", async (req, res) => {
  try {
    const transcriptions = await Transcription.find().sort({ createdAt: -1 });
    res.json(transcriptions);
  } catch (error) {
    console.error("Error fetching transcriptions", error);
    res.status(500).json({ error: "Error fetching transcriptions" });
  }
});

// Get transcription by ID
app.get("/transcriptions/:id", async (req, res) => {
  try {
    const transcription = await Transcription.findById(req.params.id);
    if (!transcription) {
      return res.status(404).json({ error: "Transcription not found" });
    }
    res.json(transcription);
  } catch (error) {
    console.error("Error fetching transcription", error);
    res.status(500).json({ error: "Error fetching transcription" });
  }
});

// Delete transcription by ID
app.delete("/transcriptions/:id", async (req, res) => {
  try {
    const transcription = await Transcription.findByIdAndDelete(req.params.id);
    if (!transcription) {
      return res.status(404).json({ error: "Transcription not found" });
    }
    res.json({ message: "Transcription deleted successfully" });
  } catch (error) {
    console.error("Error deleting transcription", error);
    res.status(500).json({ error: "Error deleting transcription" });
  }
});

app.listen(5000, () => console.log("Server running on port 5000"));