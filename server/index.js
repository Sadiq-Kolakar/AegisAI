/**
 * SentriX Backend Server v2.0
 * Cyberbullying Detection Engine via Llama 3 (Ollama)
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;
const OLLAMA_ENDPOINT = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

app.use(cors());
app.use(express.json());

/**
 * Endpoint: Message Analysis Engine
 */
app.post('/analyze', async (req, res) => {
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: "Missing message text." });
  }

  try {
    const prompt = `You are a cyberbullying detection system. 
Analyze the following message and classify its severity as SAFE, MILD, or SEVERE based on potential toxic behavior or bullying. 
Return your result as valid JSON ONLY, exactly in this format:
{"severity": "SAFE|MILD|SEVERE", "reason": "short explanation"}

Message: "${text}"`;

    const response = await fetch(`${OLLAMA_ENDPOINT}/api/generate`, {
      method: "POST",
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt: prompt,
        stream: false,
        format: "json"
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.response); // Ollama returns string in response
    
    console.log(`[SentriX Server] Classified: ${result.severity} | Message: ${text.substring(0, 30)}...`);
    res.status(200).json(result);

  } catch (error) {
    console.error("[SentriX Server Error]:", error.message);
    res.status(503).json({ 
      severity: "SAFE", 
      reason: "Analysis service currently unavailable." 
    });
  }
});

app.listen(PORT, () => {
  console.log(`[SentriX Engine] Live on http://localhost:${PORT}`);
  console.log(`[SentriX Engine] Using Local Model: ${OLLAMA_MODEL}`);
});
