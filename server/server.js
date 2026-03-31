/**
 * =============================================================
 * SentriX | AI Cyberbullying Detection Backend
 * =============================================================
 * Stack  : Node.js + Express + Ollama (Llama 3 - Local)
 * Port   : 5000
 * Endpoint: POST /analyze
 * =============================================================
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;
const OLLAMA_ENDPOINT = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';

// ─────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ─────────────────────────────────────────────
// AI PROMPT BUILDER
// ─────────────────────────────────────────────
/**
 * Builds the cyberbullying detection prompt.
 * @param {string} message - The message to classify.
 * @returns {string} The formatted prompt string.
 */
const buildPrompt = (message) =>
`You are a strict cyberbullying detection system.

Classify the message into ONE category:
SAFE, MILD, or SEVERE.

Rules:
- SAFE = normal conversation
- MILD = slightly rude or offensive
- SEVERE = abusive, insulting, or harmful

IMPORTANT:
- Respond ONLY in JSON
- No explanation
- No extra text

Format:
{"severity":"SAFE|MILD|SEVERE","reason":"short"}

Message: "${message}"`;

// ─────────────────────────────────────────────
// RESPONSE CLEANER
// ─────────────────────────────────────────────
/**
 * Strips markdown code fences or extra formatting from the AI response string.
 * Handles: ```json ... ```, ``` ... ```, and plain whitespace.
 * @param {string} raw - Raw string from Ollama.
 * @returns {string} Cleaned JSON-ready string.
 */
const cleanAIResponse = (raw) => {
  return raw
    .trim()
    .replace(/^```json\s*/i, '')  // Remove opening ```json
    .replace(/^```\s*/i, '')       // Remove opening ```
    .replace(/\s*```$/, '')        // Remove closing ```
    .trim();
};

// ─────────────────────────────────────────────
// OLLAMA CALLER
// ─────────────────────────────────────────────
/**
 * Sends a message to the local Ollama API and returns structured JSON.
 * @param {string} text - The user message to analyze.
 * @returns {Promise<{severity: string, reason: string}>}
 */
const classifyWithOllama = async (text) => {
  const prompt = buildPrompt(text);

  const response = await fetch(`${OLLAMA_ENDPOINT}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt: prompt,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama responded with status ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const rawText = data?.response;

  if (!rawText) {
    throw new Error('Empty response received from Ollama.');
  }

  // Clean any markdown formatting before parsing
  const cleaned = cleanAIResponse(rawText);

  try {
    const parsed = JSON.parse(cleaned);

    // Validate expected fields
    if (!parsed.severity || !parsed.reason) {
      throw new Error('AI response missing required fields: severity or reason.');
    }

    // Normalize severity to uppercase
    parsed.severity = parsed.severity.toUpperCase().trim();

    // Ensure severity is one of the valid values
    const validSeverities = ['SAFE', 'MILD', 'SEVERE'];
    if (!validSeverities.includes(parsed.severity)) {
      parsed.severity = 'SAFE'; // Safe fallback
    }

    return parsed;
  } catch (parseErr) {
    throw new Error(`Failed to parse AI JSON output: ${parseErr.message}. Raw: "${cleaned.substring(0, 100)}"`);
  }
};

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────

/**
 * Health Check
 * Confirms the server is alive without calling Ollama.
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', model: OLLAMA_MODEL, engine: 'SentriX Analysis Engine' });
});

/**
 * Primary Analysis Endpoint
 * POST /analyze
 * Body: { "text": "message to classify" }
 */
app.post('/analyze', async (req, res) => {
  const { text } = req.body;

  // ── Validate Input ──────────────────────────
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    console.warn('[SentriX] Request rejected: empty or missing text field.');
    return res.status(400).json({
      error: 'Validation failed.',
      detail: 'The "text" field is required and must be a non-empty string.',
    });
  }

  const truncatedLog = text.length > 50 ? `${text.substring(0, 50)}...` : text;
  console.log(`[SentriX] Analyzing: "${truncatedLog}"`);

  // ── Classify ────────────────────────────────
  try {
    const result = await classifyWithOllama(text.trim());
    console.log(`[SentriX] Result: ${result.severity} | Reason: ${result.reason}`);
    return res.status(200).json(result);

  } catch (err) {
    // ── Ollama Connection Failure ─────────────
    if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
      console.error('[SentriX] Ollama is unreachable. Is it running on port 11434?');
      return res.status(503).json({
        error: 'Local AI Engine offline.',
        detail: 'Ollama is not reachable. Run: ollama serve',
      });
    }

    // ── JSON Parse Error ──────────────────────
    if (err.message.startsWith('Failed to parse')) {
      console.error('[SentriX] JSON parse error from AI:', err.message);
      return res.status(422).json({
        error: 'AI response parsing failed.',
        detail: err.message,
      });
    }

    // ── Unexpected Error ──────────────────────
    console.error('[SentriX] Unexpected Error:', err.message);
    return res.status(500).json({
      error: 'Internal server error.',
      detail: err.message,
    });
  }
});

// ─────────────────────────────────────────────
// SERVER START
// ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║      SentriX Intelligence Engine      ║');
  console.log('╠══════════════════════════════════════╣');
  console.log(`║  Server   : http://localhost:${PORT}    ║`);
  console.log(`║  Model    : ${OLLAMA_MODEL.padEnd(25)} ║`);
  console.log(`║  Ollama   : ${OLLAMA_ENDPOINT.padEnd(25)} ║`);
  console.log('╚══════════════════════════════════════╝');
  console.log('');
});
