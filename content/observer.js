/**
 * AegisAI Observer v2.1 — WhatsApp Cyberbullying Detection
 * Self-contained single content script.
 *
 * Responsibilities:
 *   1. Badge injection via Shadow DOM (inlined from badge.js)
 *   2. MutationObserver watching for new messages
 *   3. Sending messages to background for AI classification
 *   4. Applying blur/redaction on SEVERE messages
 */

// ═══════════════════════════════════════════════════════════
// SECTION 1 — BADGE INJECTOR (Shadow DOM, fully isolated)

// ─── Boot confirmation ──────────────────────────
console.log("🔥 Extension working on WhatsApp");

// ═══════════════════════════════════════════════════════════

const SEVERITY_CONFIG = {
  SAFE:   { color: '#10b981', label: '✓ Safe',    text: '#fff' },
  MILD:   { color: '#fbbf24', label: '⚡ Mild',    text: '#1a1a1a' },
  SEVERE: { color: '#f43f5e', label: '🚨 Severe',  text: '#fff' },
};

/**
 * Injects a severity badge into a message node via Shadow DOM.
 * Idempotent — skips if badge already present on this node.
 */
const injectSeverityBadge = (node, severity) => {
  if (!node || node.querySelector('.sx-badge-host')) return;

  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.SAFE;

  const host = document.createElement('span');
  host.className = 'sx-badge-host';
  host.style.cssText = [
    'display:inline-block;',
    'vertical-align:middle;',
    'margin-left:6px;',
    'line-height:1;',
    'pointer-events:none;',
  ].join('');

  const shadow = host.attachShadow({ mode: 'open' });

  const badge = document.createElement('span');
  badge.textContent = config.label;
  badge.style.cssText = [
    `background:${config.color};`,
    `color:${config.text};`,
    'font-family:system-ui,sans-serif;',
    'font-size:9px;',
    'font-weight:800;',
    'padding:2px 7px;',
    'border-radius:100px;',
    'letter-spacing:0.3px;',
    'white-space:nowrap;',
    'box-shadow:0 1px 4px rgba(0,0,0,0.2);',
    'opacity:0;',
    'transform:scale(0.7);',
    'transition:opacity 0.35s ease,transform 0.35s cubic-bezier(0.16,1,0.3,1);',
  ].join('');

  shadow.appendChild(badge);

  const textEl = node.querySelector('.selectable-text.copyable-text') || node;
  textEl.appendChild(host);

  // Double rAF ensures transition fires after element is painted
  requestAnimationFrame(() => requestAnimationFrame(() => {
    badge.style.opacity = '1';
    badge.style.transform = 'scale(1)';
  }));
};

// ═══════════════════════════════════════════════════════════
// SECTION 2 — OBSERVER & MESSAGE PROCESSOR
// ═══════════════════════════════════════════════════════════

/**
 * Returns the WhatsApp message container using multiple selector fallbacks.
 * WhatsApp frequently changes its DOM — this ensures the observer always attaches.
 */
const getMessageContainer = () => document.body;
const MSG_TEXT_SELECTOR = '.selectable-text.copyable-text';

// WeakSet — GC-friendly deduplication, no memory leaks
const processedNodes = new WeakSet();

let observerInstance = null;

// ─── Styled Logger ──────────────────────────────
const log = (msg, level = 'info') => {
  const styles = {
    info:  'color:#10b981;font-weight:bold;',
    warn:  'color:#fbbf24;font-weight:bold;',
    error: 'color:#f43f5e;font-weight:bold;',
  };
  let method = 'log';
  if (level === 'error') method = 'error';
  else if (level === 'warn') method = 'warn';
  console[method](`%c[AegisAI]`, styles[level] || styles.info, msg);
};

// ─── SEVERE: Blur + Reveal Button ──────────────
const applyRedaction = (node) => {
  const textEl = node.querySelector(MSG_TEXT_SELECTOR);
  if (!textEl || textEl.dataset.sentrixRedacted) return;

  textEl.style.filter = 'blur(6px)';
  textEl.style.userSelect = 'none';
  textEl.style.transition = 'filter 0.3s ease';
  textEl.dataset.sentrixRedacted = 'true';

  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:absolute;inset:0;',
    'display:flex;align-items:center;justify-content:center;',
    'z-index:99;cursor:pointer;',
  ].join('');

  const btn = document.createElement('button');
  btn.textContent = '⚠️ Reveal Protected Content';
  btn.style.cssText = [
    'background:rgba(244,63,94,0.9);color:#fff;border:none;',
    'border-radius:6px;padding:4px 10px;font-size:11px;',
    'font-weight:700;cursor:pointer;letter-spacing:0.4px;',
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

// Maps message text → DOM node for badge injection on SHOW_RESULT
const textNodeMap = new Map();
const seenTexts = new Set();

function processNode(node) {
  const spans = node.querySelectorAll('span');

  spans.forEach((el) => {
    const text = el.innerText?.trim();

    if (!text || text.length < 3) return;
    if (seenTexts.has(text)) return;
    seenTexts.add(text);

    // Store reference so SHOW_RESULT can find the right node
    textNodeMap.set(text, node);

    console.log('🔥 MESSAGE DETECTED:', text);

    chrome.runtime.sendMessage({ type: 'ANALYZE_MESSAGE', text });
  });
}

// ─── Badge + Highlight ──────────────────────────
function showBadge(node, severity) {
  if (node.querySelector('.sx-result-badge')) return;

  let label = '✓ Safe';
  if (severity === 'MILD')   label = '⚡ Mild';
  if (severity === 'SEVERE') label = '🚨 Severe';

  let bgColor = '#10b981';
  if (severity === 'MILD')   bgColor = '#f59e0b';
  if (severity === 'SEVERE') bgColor = '#ef4444';

  const badge = document.createElement('span');
  badge.className = 'sx-result-badge';
  badge.innerText = label;
  badge.style.cssText = [
    'margin-left:8px;padding:2px 8px;border-radius:6px;',
    'font-size:10px;font-weight:bold;color:white;',
    'display:inline-block;vertical-align:middle;',
    `background:${bgColor};`,
  ].join('');
  node.appendChild(badge);

  if (severity === 'SEVERE') {
    node.style.outline = '2px solid #ef4444';
    node.style.borderRadius = '10px';
    node.style.transition = 'outline 0.3s ease';
  }

  console.log(`[AegisAI] 🎨 Badge shown: ${severity}`);
}

// ─── Listen for results from background ─────────
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_RESULT') {
    console.log(`[AegisAI] Result → ${msg.severity}`);

    // Find the node that sent this text
    const node = textNodeMap.get(msg.text);
    if (!node) return;

    showBadge(node, msg.severity);

    if (msg.severity === 'SEVERE') {
      applyRedaction(node);
    }
  }
});

// ─── MutationObserver Setup ─────────────────────
const startObserver = () => {
  const target = getMessageContainer();

  if (observerInstance) observerInstance.disconnect();

  observerInstance = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          processNode(node);
        }
      });
    });
  });

  observerInstance.observe(target, { childList: true, subtree: true });
  console.log('🚀 Observer attached to body');
};

// ─── Boot ───────────────────────────────────────
if (document.readyState === 'complete') startObserver();
else window.addEventListener('load', startObserver, { once: true });
