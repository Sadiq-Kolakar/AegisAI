/**
 * SentriX Analysis Backend Server.
 * Port: 5000 | Endpoint: POST /analyze
 */

require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');
const cors = require('cors');
const helmet = require('helmet');
const { sendAlertEmail } = require('./services/emailService');
const { saveDetection, getDetections } = require('./services/dbService');
const path = require('node:path');

const app = express();
const PORT = process.env.PORT || 5000;
// ... (middleware stays as is)

/**
 * Endpoint: Data history for dashboard
 */
app.get('/api/detections', async (req, res) => {
    try {
        const rows = await getDetections();
        res.status(200).json(rows);
    } catch (err) {
        console.error("[SentriX] Fetch error:", err.message);
        res.status(500).json({ error: "Failed to fetch dashboard data." });
    }
});

/**
 * Endpoint: Save analyze result + screenshot
 */
app.post('/api/save', async (req, res) => {
    const { text, severity, reason, screenshot, parentEmail } = req.body;
    
    try {
        await saveDetection({ text, severity, reason, screenshot });
        
        // Also send an email alert for saved detection if requested
        if (severity === "SEVERE") {
            sendAlertEmail(text, severity, parentEmail).catch(e => console.error("Email Alert Failed:", e.message));
        }
        
        res.status(200).json({ status: "SAVED" });
    } catch (err) {
        console.error("[SentriX] Save error:", err.message);
        res.status(500).json({ error: "Storage failure." });
    }
});

// -- Middleware --
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline images in the dashboard
}));
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Allow large base64 screenshots
app.use(express.static(path.join(__dirname, 'public')));

// -- OpenAI Setup --
let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
} else {
  console.warn("[SentriX] WARNING: OPENAI_API_KEY is missing. Analysis features will be disabled.");
}

/**
 * Controller: Message Analysis
 */
app.post('/analyze', async (req, res) => {
  const { text, parentEmail } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Missing 'text' in request body." });
  }

  if (!openai) {
    return res.status(503).json({ 
      severity: "SAFE", 
      reason: "Analysis engine not configured (API key missing)." 
    });
  }

  try {
    const prompt = `Analyze the following message for harmful content, toxic behavior, or spam. 
    Classify it as one of the following: SAFE, MILD (minor issues), or SEVERE (dangerous/highly toxic).
    Return your result in valid JSON format only, exactly like this:
    {"severity": "SAFE | MILD | SEVERE", "reason": "short explanation"}
    
    Message: "${text}"`;

    const response = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview", // Or gpt-3.5-turbo
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content);
    
    // Asynchronous alert if the severity is SEVERE
    if (result.severity === "SEVERE") {
        sendAlertEmail(text, result.severity, parentEmail).catch(e => console.error("Email Alert Failed:", e.message));
    }
    
    res.status(200).json(result);

  } catch (error) {
    console.error("[Server Error] OpenAI Interaction Failed:", error.message);
    res.status(500).json({ 
      error: "Analysis service unavailable.", 
      details: error.message 
    });
  }
});

// -- Health Check --
app.get('/health', (req, res) => {
    res.status(200).json({ status: "ok", service: "SentriX Analysis API" });
});

// -- Server Startup --
app.listen(PORT, () => {
  console.log(`[SentriX Server] Running on http://localhost:${PORT}`);
});
