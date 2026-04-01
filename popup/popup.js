/**
 * AegisAI Popup Controller v2.0
 * Handles live stats, toggle state, and server health-check.
 */

const SERVER_HEALTH_URL = 'http://localhost:5000/health';

// ─── Element refs ────────────────────────────────
const toggleEl       = document.getElementById('toggleMonitoring');
const mildCountEl    = document.getElementById('mildCount');
const severeCountEl  = document.getElementById('severeCount');
const serverDot      = document.getElementById('serverDot');
const serverStatus   = document.getElementById('serverStatus');

// ─── Load stored state ───────────────────────────
chrome.storage.sync.get(
  { isEnabled: true, mildCount: 0, severeCount: 0 },
  ({ isEnabled, mildCount, severeCount }) => {
    toggleEl.checked       = isEnabled;
    mildCountEl.textContent   = mildCount;
    severeCountEl.textContent = severeCount;
  }
);

// ─── Toggle monitoring ───────────────────────────
toggleEl.addEventListener('change', () => {
  chrome.storage.sync.set({ isEnabled: toggleEl.checked });
});

// ─── Server health check ─────────────────────────
const checkServer = async () => {
  try {
    const res = await fetch(SERVER_HEALTH_URL, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      serverDot.className    = 'dot online';
      serverStatus.className = 'server-status online';
      serverStatus.textContent = 'Online';
    } else {
      throw new Error('non-2xx');
    }
  } catch {
    serverDot.className    = 'dot offline';
    serverStatus.className = 'server-status offline';
    serverStatus.textContent = 'Offline';
  }
};

// ─── Live stats refresh ──────────────────────────
const refreshStats = () => {
  chrome.storage.sync.get({ mildCount: 0, severeCount: 0 }, ({ mildCount, severeCount }) => {
    mildCountEl.textContent   = mildCount;
    severeCountEl.textContent = severeCount;
  });
};

// ─── Boot ────────────────────────────────────────
checkServer();
setInterval(checkServer,  5000);
setInterval(refreshStats, 2000);
