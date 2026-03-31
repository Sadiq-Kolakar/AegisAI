/**
 * SentriX Intelligence Background Worker v2.0
 * Service Worker — bridges WhatsApp Web (content) ↔ local AI engine (server).
 *
 * Message Types:
 *   ANALYZE_MESSAGE → { type, payload: { text, timestamp } }
 *   PING            → { type }
 */

const API_SERVER = 'http://localhost:5000/analyze';
const FETCH_TIMEOUT_MS = 10000; // 10s max wait for Ollama

// ─── Simple rate-limiter: max 20 requests / 60s ───
const rateWindow = [];
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

const isRateLimited = () => {
  const now = Date.now();
  // Drop entries outside the window
  while (rateWindow.length && rateWindow[0] < now - RATE_WINDOW_MS) rateWindow.shift();
  if (rateWindow.length >= RATE_LIMIT) return true;
  rateWindow.push(now);
  return false;
};

// ─── Fetch with timeout ────────────────────────
const fetchWithTimeout = (url, options, ms = FETCH_TIMEOUT_MS) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id));
};

// ─── Core Message Handler ──────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  // ── Health Ping ─────────────────────────
  if (message.type === 'PING') {
    sendResponse({ status: 'alive' });
    return false;
  }

  // ── Analysis Request ────────────────────
  if (message.type === 'ANALYZE_MESSAGE') {
    const { text } = message.payload || {};

    if (!text) {
      sendResponse({ status: 'ERROR', message: 'No text payload provided.' });
      return false;
    }

    // Rate limit guard
    if (isRateLimited()) {
      console.warn('[SentriX] Rate limit reached. Skipping analysis.');
      sendResponse({ status: 'RATE_LIMITED', severity: 'SAFE' });
      return true;
    }

    (async () => {
      // Check if monitoring is enabled
      const { isEnabled } = await chrome.storage.sync.get({ isEnabled: true });
      if (!isEnabled) {
        sendResponse({ status: 'DISABLED', severity: 'SAFE' });
        return;
      }

      try {
        const response = await fetchWithTimeout(API_SERVER, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status} from analysis server`);
        }

        const data = await response.json();
        const severity = (['SAFE', 'MILD', 'SEVERE'].includes(data.severity))
          ? data.severity
          : 'SAFE';

        // Persist stats
        const stats = await chrome.storage.sync.get({ mildCount: 0, severeCount: 0 });
        if (severity === 'MILD')   chrome.storage.sync.set({ mildCount: stats.mildCount + 1 });
        if (severity === 'SEVERE') {
          chrome.storage.sync.set({ severeCount: stats.severeCount + 1 });
          // Desktop notification
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: '⚠️ SentriX — Threat Detected',
            message: `Severe content identified: "${text.substring(0, 60)}..."`,
            priority: 2,
          });
        }

        console.log(`[SentriX] ${severity} | ${data.reason}`);
        sendResponse({ status: 'SUCCESS', severity, reason: data.reason });

      } catch (err) {
        const isOffline = err.name === 'AbortError'
          || err.message.includes('fetch failed')
          || err.message.includes('ECONNREFUSED');

        console.warn('[SentriX] Analysis failed:', err.message);
        sendResponse({
          status: 'ERROR',
          severity: 'SAFE',
          message: isOffline
            ? 'SentriX server offline. Run: node server.js'
            : err.message,
        });
      }
    })();

    return true; // Keep async channel open
  }
});

// ─── Extension Installed / Updated ─────────────
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ isEnabled: true, mildCount: 0, severeCount: 0 });
  console.log('[SentriX] Intelligence Worker v2.0 installed.');
});
