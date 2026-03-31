/**
 * SentriX Badge Injector v2.0
 * Injects a severity badge into a message node using Shadow DOM.
 * Shadow DOM prevents any CSS collision with WhatsApp's styles.
 */

const SEVERITY_CONFIG = {
  SAFE:   { color: '#10b981', label: '✓ Safe',   text: '#fff' },
  MILD:   { color: '#fbbf24', label: '⚡ Mild',   text: '#1a1a1a' },
  SEVERE: { color: '#f43f5e', label: '🚨 Severe', text: '#fff' },
};

/**
 * Injects a severity badge adjacent to the message node.
 * Idempotent — skips if badge already injected on this node.
 *
 * @param {Element} node     - The message container element.
 * @param {string}  severity - 'SAFE' | 'MILD' | 'SEVERE'
 */
const injectSeverityBadge = (node, severity) => {
  if (!node || node.querySelector('.sx-badge-host')) return;

  const config = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.SAFE;

  // ── Shadow Host ──────────────────────────────
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

  // ── Badge Element ────────────────────────────
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
    // Entrance animation
    'opacity:0;',
    'transform:scale(0.7);',
    'transition:opacity 0.35s ease,transform 0.35s cubic-bezier(0.16,1,0.3,1);',
  ].join('');

  shadow.appendChild(badge);

  // ── Append to node ───────────────────────────
  // Try to find the text span so the badge sits next to the text
  const textEl = node.querySelector('.selectable-text.copyable-text') || node;
  textEl.appendChild(host);

  // Trigger animation after paint
  requestAnimationFrame(() => requestAnimationFrame(() => {
    badge.style.opacity = '1';
    badge.style.transform = 'scale(1)';
  }));
};

// Make available globally for observer.js (both run in same content context)
window.injectSeverityBadge = injectSeverityBadge;
