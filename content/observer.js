/**
 * SentriX Intelligence Observer v2.0
 * Watches WhatsApp Web for new messages and dispatches them for AI analysis.
 *
 * Key improvements over v1:
 *  - Uses a WeakSet for O(1) deduplication (no memory leaks)
 *  - Proper chrome.runtime.lastError handling
 *  - SEVERE: blurs message text with a reveal button
 *  - Retry logic if WhatsApp DOM isn't ready
 */

const MSG_LIST_SELECTOR   = '[aria-label="Message list"]';
const MSG_TEXT_SELECTOR   = '.selectable-text.copyable-text';

// WeakSet tracks nodes already processed — GC-friendly, no memory leaks
const processedNodes = new WeakSet();

let observerInstance = null;

// ─── Styled Logger ──────────────────────────────
const log = (msg, level = 'info') => {
  const styles = {
    info:  'color:#10b981;font-weight:bold;',
    warn:  'color:#fbbf24;font-weight:bold;',
    error: 'color:#f43f5e;font-weight:bold;',
  };
  console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
    `%c[SentriX]`, styles[level] || styles.info, msg
  );
};

// ─── Badge Injection (delegates to badge.js) ────
const applyBadge = (node, severity) => {
  if (typeof window.injectSeverityBadge === 'function') {
    window.injectSeverityBadge(node, severity);
  }
};

// ─── SEVERE: Blur + Reveal Button ──────────────
const applyRedaction = (node) => {
  const textEl = node.querySelector(MSG_TEXT_SELECTOR);
  if (!textEl || textEl.dataset.sentrixRedacted) return;

  textEl.style.filter = 'blur(6px)';
  textEl.style.userSelect = 'none';
  textEl.style.transition = 'filter 0.3s ease';
  textEl.dataset.sentrixRedacted = 'true';

  // Reveal overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:absolute;inset:0;display:flex;align-items:center;',
    'justify-content:center;z-index:99;cursor:pointer;',
  ].join('');

  const btn = document.createElement('button');
  btn.textContent = '⚠️ Reveal Protected Content';
  btn.style.cssText = [
    'background:rgba(244,63,94,0.9);color:#fff;border:none;',
    'border-radius:6px;padding:4px 10px;font-size:11px;font-weight:700;',
    'cursor:pointer;letter-spacing:0.4px;',
  ].join('');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    textEl.style.filter = 'none';
    textEl.style.userSelect = '';
    overlay.remove();
  }, { once: true });

  overlay.appendChild(btn);
  if (getComputedStyle(node).position === 'static') node.style.position = 'relative';
  node.appendChild(overlay);
};

// ─── Core: Process a Single Message Node ───────
const processNode = (node) => {
  if (processedNodes.has(node)) return;
  processedNodes.add(node);

  const textEl = node.querySelector(MSG_TEXT_SELECTOR);
  if (!textEl) return;

  const text = textEl.innerText?.trim();
  if (!text) return;

  log(`Analyzing: "${text.substring(0, 30)}..."`);

  chrome.runtime.sendMessage(
    { type: 'ANALYZE_MESSAGE', payload: { text, timestamp: Date.now() } },
    (response) => {
      // Handle extension context invalidation or no response
      if (chrome.runtime.lastError) {
        log(`Extension context error: ${chrome.runtime.lastError.message}`, 'warn');
        return;
      }

      if (!response || response.status === 'ERROR') {
        log(response?.message || 'No response from background.', 'warn');
        return;
      }

      if (response.status === 'DISABLED' || response.status === 'RATE_LIMITED') return;

      const { severity } = response;
      log(`Result → ${severity}`, severity === 'SEVERE' ? 'error' : 'info');

      applyBadge(node, severity);

      if (severity === 'SEVERE') {
        applyRedaction(node);
      }
    }
  );
};

// ─── MutationObserver Setup ─────────────────────
const startObserver = () => {
  const target = document.querySelector(MSG_LIST_SELECTOR);
  if (!target) {
    setTimeout(startObserver, 1500); // WhatsApp not yet rendered
    return;
  }

  if (observerInstance) observerInstance.disconnect();

  observerInstance = new MutationObserver((mutations) => {
    for (const { addedNodes } of mutations) {
      for (const node of addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          processNode(node);
        }
      }
    }
  });

  observerInstance.observe(target, { childList: true, subtree: true });
  log('Observer activated on WhatsApp Web ✅');
};

// ─── Boot ───────────────────────────────────────
if (document.readyState === 'complete') startObserver();
else window.addEventListener('load', startObserver, { once: true });
