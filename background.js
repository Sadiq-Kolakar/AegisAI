// --- Rate Limiter (Token Bucket) ---
class TokenBucket {
  constructor(capacity, fillPerMinute) {
    this.capacity = capacity;
    this.tokens = capacity;
    this.fillRate = fillPerMinute / 60; // tokens per second
    this.lastRefillTime = Date.now();
  }

  refill() {
    const now = Date.now();
    const delta = (now - this.lastRefillTime) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + delta * this.fillRate);
    this.lastRefillTime = now;
  }

  tryConsume() {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}

const aiRateLimiter = new TokenBucket(20, 20); // 20 calls max, 20 refills per minute

// --- Constants & Config ---
const SEVERITY_LEVELS = {
  SAFE: "SAFE",
  MILD: "MILD",
  SEVERE: "SEVERE",
};

const ESCALATION_THRESHOLD = 3;
const ESCALATION_WINDOW_MS = 60000; // 60 seconds

// --- State ---
let mildMessageLog = []; // Stores timestamps of mild messages

// --- API Service Configuration ---
const API_BASE_URL = "http://localhost:5000";
const MAX_RETRIES = 2;
const FETCH_TIMEOUT_MS = 8000;

/**
 * Utility: Fetch wrapper with timeout capability.
 */
const fetchWithTimeout = async (url, options = {}, timeout = FETCH_TIMEOUT_MS) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

/**
 * Core Service: Analysis API call with retry.
 */
const analyzeContent = async (text, parentEmail, retryCount = 0) => {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, parentEmail })
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.severity || SEVERITY_LEVELS.SAFE;

  } catch (error) {
    console.warn(`[SentriX] API Call failed (attempt ${retryCount + 1}):`, error.message);
    
    if (retryCount < MAX_RETRIES) {
      // Exponential backoff or simple delay before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return analyzeContent(text, parentEmail, retryCount + 1);
    }
    
    // Fallback if all retries fail
    console.error("[SentriX] All retries exhausted. Falling back to SAFE.");
    return SEVERITY_LEVELS.SAFE;
  }
};

/**
 * Manages the buffer of MILD messages and handles escalation logic.
 */
const checkEscalation = () => {
  const now = Date.now();
  
  // Prune messages older than the observation window
  mildMessageLog = mildMessageLog.filter(ts => now - ts < ESCALATION_WINDOW_MS);
  
  // Add current mild message timestamp
  mildMessageLog.push(now);
  
  if (mildMessageLog.length >= ESCALATION_THRESHOLD) {
    console.warn(`[SentriX] ALERT: Escalated to SEVERE due to ${mildMessageLog.length} MILD messages in 60s.`);
    return true; // Should escalate
  }
  
  return false;
};

/**
 * Core Message Listener
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_MESSAGE") {
    // 🛡️ Guard with Rate Limiter
    if (!aiRateLimiter.tryConsume()) {
      console.warn("[SentriX] ALERT: Rate limit exceeded for AI analysis.");
      sendResponse({ status: "RATE_LIMIT_EXCEEDED", severity: "SAFE", message: "Too many requests. Please wait." });
      return true;
    }

    const payload = message.payload || {};
    
    // Use async self-invoked function to handle response
    (async () => {
      try {
        const settings = await chrome.storage.sync.get(["parentEmail"]);
        let severity = await analyzeContent(payload.text || "", settings.parentEmail);
        let escalated = false;
        
        // Handle MILD escalation logic
        if (severity === SEVERITY_LEVELS.MILD) {
          // Increment MILD count in storage
          const stats = await chrome.storage.sync.get(["mildCount"]);
          chrome.storage.sync.set({ mildCount: (stats.mildCount || 0) + 1 });

          if (checkEscalation()) {
            severity = SEVERITY_LEVELS.SEVERE;
            escalated = true;
          }
        }

        // Trigger Notification and Counter for SEVERE
        if (severity === SEVERITY_LEVELS.SEVERE) {
          // If severity already severe (not just escalated), increment severeCount
          // Save endpoint also increments severeCount, but only when evidence is saved.
          // Let's increment it here for consistent UI updates.
          const stats = await chrome.storage.sync.get(["severeCount"]);
          chrome.storage.sync.set({ severeCount: (stats.severeCount || 0) + 1 });

          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'SentriX Threat Detected!',
            message: escalated ? 'Multiple suspicious messages detected recently.' : 'A severe security threat was identified in a message.',
            priority: 2
          });
        }
        
        sendResponse({
          status: "SUCCESS",
          severity: severity,
          escalated: escalated,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error("[SentriX] Analysis Error:", error);
        sendResponse({ status: "ERROR", message: error.message });
      }
    })();
    
    return true; // Keep channel open for async response
  }

  /**
   * Endpoint: Save Evidence (Screenshots + Metadata)
   */
  if (message.type === "SAVE_EVIDENCE") {
    const payload = message.payload || {};
    
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/save`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: payload.text,
            severity: "SEVERE",
            reason: "Visual evidence captured.",
            screenshot: payload.screenshot
          })
        });

        if (response.ok) {
          // Note: Counter already incremented in ANALYZE_MESSAGE if it was severe.
          // But we could add further logic here if needed.
        }
      } catch (err) {
        console.error("[SentriX] Storage failure:", err.message);
      }
    })();
    return false;
  }

  // Handle standard pings or other message types
  if (message.type === "PING") {
    sendResponse({ status: "alive" });
  }

  return false;
});

// Initialization
chrome.runtime.onInstalled.addListener(() => {
  console.log("SentriX Background Worker initialized.");
  chrome.storage.sync.set({ isEnabled: true });
});
