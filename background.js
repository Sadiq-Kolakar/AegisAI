/**
 * AegisAI Intelligence Background Worker v2.1
 * Uses chrome.tabs.sendMessage to push results back to content script.
 */

const API_SERVER = 'http://localhost:5000/analyze';
const FETCH_TIMEOUT_MS = 10000;

// ─── Rate limiter ────────────────────────────────
const rateWindow = [];
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60_000;

const isRateLimited = () => {
  const now = Date.now();
  while (rateWindow.length && rateWindow[0] < now - RATE_WINDOW_MS) rateWindow.shift();
  if (rateWindow.length >= RATE_LIMIT) return true;
  rateWindow.push(now);
  return false;
};

const fetchWithTimeout = (url, options, ms = FETCH_TIMEOUT_MS) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  return fetch(url, { ...options, signal: controller.signal }).finally(() => clearTimeout(id));
};

// ─── Core Message Handler ────────────────────────
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.type === 'PING') {
    sendResponse({ status: 'alive' });
    return false;
  }

  if (message.type === 'ANALYZE_MESSAGE') {
    const text = message.text;

    if (!text) return false;
    if (isRateLimited()) {
      console.warn('[AegisAI] Rate limit reached.');
      return false;
    }

    (async () => {
      const { isEnabled } = await chrome.storage.sync.get({ isEnabled: true });
      if (!isEnabled) return;

      try {
        const response = await fetchWithTimeout(API_SERVER, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        const severity = ['SAFE', 'MILD', 'SEVERE'].includes(data.severity)
          ? data.severity : 'SAFE';

        console.log(`[AegisAI] ${severity} | ${data.reason}`);

        // ── Push result to content script ──────────
        chrome.tabs.sendMessage(sender.tab.id, {
          type: 'SHOW_RESULT',
          severity,
          reason: data.reason,
          text,
        });

        // ── Update stats ───────────────────────────
        const stats = await chrome.storage.sync.get({ mildCount: 0, severeCount: 0 });
        if (severity === 'MILD')   chrome.storage.sync.set({ mildCount: stats.mildCount + 1 });
        if (severity === 'SEVERE') {
          chrome.storage.sync.set({ severeCount: stats.severeCount + 1 });
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: '⚠️ AegisAI — Threat Detected',
            message: `Severe: "${text.substring(0, 60)}"`,
            priority: 2,
          });
        }

      } catch (err) {
        console.warn('[AegisAI] Analysis failed:', err.message);
      }
    })();

    return false;
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.set({ isEnabled: true, mildCount: 0, severeCount: 0 });
  console.log('[AegisAI] Intelligence Worker v2.1 installed.');
});
