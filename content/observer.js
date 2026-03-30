/**
 * SentriX Observer Script for WhatsApp Web.
 * Detects newly added message nodes, extracts text, and communicates with background.js.
 */

const APP_NAME = "SentriX Observer";
const MESSAGE_CONTAINER_SELECTOR = '[aria-label="Message list"]';
const MESSAGE_TEXT_SELECTOR = '.selectable-text.copyable-text';
const DEBOUNCE_DELAY = 300; // ms

let observer = null;
let debounceTimeout = null;

/**
 * Utility: Debounces execution to avoid excessive triggers during rapid DOM updates.
 */
const debounce = (callback, delay) => {
    return (...args) => {
        if (debounceTimeout) clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(() => callback(...args), delay);
    };
};

/**
 * Processes mutations and extracts information from new message nodes.
 */
const handleMutations = (mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Look for message text within newly added nodes
                    const messageElement = node.querySelector(MESSAGE_TEXT_SELECTOR);
                    if (messageElement) {
                        const messageText = messageElement.innerText || messageElement.textContent;
                        processNewMessage(messageText, node);
                    }
                }
            });
        }
    });
};

/**
 * Sends message data to background.js and handles its response.
 * If severe, triggers a DOM screenshot of the evidence node.
 */
const processNewMessage = async (text, node) => {
    if (!text) return;
    
    console.log(`[${APP_NAME}] Analyzing detected content...`);
    
    try {
        const response = await chrome.runtime.sendMessage({
            type: "ANALYZE_MESSAGE",
            payload: { text, timestamp: new Date().toISOString() }
        });

        if (response?.severity) {
            injectBadge(node, response.severity);
            
            if (response.severity === "SEVERE") {
                console.warn(`[${APP_NAME}] SEVERE ALERT: Redacting and capturing evidence...`);
                blurMessage(node);
                captureScreenshot(node, text);
            }
        }
    } catch (err) {
        console.debug(`[${APP_NAME}] Analysis message delivery failed:`, err.message);
    }
};

/**
 * Captures a screenshot of the specific DOM element and sends it back to background.
 */
const captureScreenshot = async (element, originalText) => {
    if (typeof html2canvas === "undefined") {
        console.error(`[${APP_NAME}] Error: html2canvas library is missing!`);
        return;
    }

    try {
        // Optimize screenshot by specifically targeting the element
        const canvas = await html2canvas(element, {
            scale: 2, // 2x for retina-like quality
            logging: false,
            useCORS: true,
            backgroundColor: null
        });

        const base64Image = canvas.toDataURL("image/png");

        chrome.runtime.sendMessage({
            type: "SAVE_EVIDENCE",
            payload: {
                text: originalText,
                screenshot: base64Image,
                timestamp: new Date().toISOString()
            }
        });

        console.log(`[${APP_NAME}] Evidence captured and uploaded.`);
    } catch (error) {
        console.error(`[${APP_NAME}] Screenshot capture failed:`, error.message);
    }
};

/**
 * Injects a severity badge into the message node using Shadow DOM.
 */
const injectBadge = (node, severity) => {
    // Check if a badge already exists to avoid duplicates
    if (node.shadowRoot || node.querySelector('.sentrix-badge-container')) return;

    const colors = {
        SAFE: '#25d366',
        MILD: '#ffd700',
        SEVERE: '#ff4b2b'
    };

    const container = document.createElement('div');
    container.className = 'sentrix-badge-container';
    container.style.display = 'inline-block';
    container.style.marginLeft = '8px';
    container.style.verticalAlign = 'middle';

    const shadow = container.attachShadow({ mode: 'open' });

    const badge = document.createElement('div');
    badge.textContent = severity;
    badge.className = `badge ${severity.toLowerCase()}`;

    const style = document.createElement('style');
    style.textContent = `
        .badge {
            font-family: 'Inter', sans-serif;
            font-size: 10px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 4px;
            color: #fff;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            animation: fadeIn 0.4s ease-out forwards;
            opacity: 0;
            cursor: default;
            user-select: none;
        }
        .safe { background-color: ${colors.SAFE}; }
        .mild { background-color: ${colors.MILD}; color: #333; }
        .severe { background-color: ${colors.SEVERE}; }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(4px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;

    shadow.appendChild(style);
    shadow.appendChild(badge);
    node.appendChild(container); // Inject into parent container of the text
};

/**
 * Redacts and blurs the original message text, providing a 'Reveal' option.
 */
const blurMessage = (node) => {
    const textElement = node.querySelector(MESSAGE_TEXT_SELECTOR);
    if (!textElement || textElement.classList.contains('sentrix-blurred')) return;

    // Apply blurring to the actual text content
    textElement.style.filter = 'blur(10px)';
    textElement.style.transition = 'filter 0.4s ease';
    textElement.style.pointerEvents = 'none';
    textElement.classList.add('sentrix-blurred');

    // Create the 'Reveal' overlay
    const overlay = document.createElement('div');
    overlay.className = 'sentrix-redaction-overlay';
    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.zIndex = '10';
    
    // Use Shadow DOM for the specific UI button
    const shadow = overlay.attachShadow({ mode: 'open' });
    
    const revealBtn = document.createElement('button');
    revealBtn.textContent = 'REVEAL PROTECTED CONTENT';
    revealBtn.style.cssText = `
        background: rgba(0, 0, 0, 0.75);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.3);
        border-radius: 4px;
        padding: 4px 10px;
        font-family: 'Inter', sans-serif;
        font-size: 10px;
        font-weight: 600;
        cursor: pointer;
        backdrop-filter: blur(4px);
        transition: background 0.2s;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    `;

    revealBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        textElement.style.filter = 'none';
        textElement.style.pointerEvents = 'auto';
        overlay.remove();
    });

    shadow.appendChild(revealBtn);
    
    // Ensure parent node is positioned appropriately for absolute overlay
    if (getComputedStyle(node).position === 'static') {
        node.style.position = 'relative';
    }
    
    node.appendChild(overlay);
};

/**
 * Initializes the observer with retry logic to ensure the DOM is ready.
 */
const initObserver = (retryCount = 0) => {
    const container = document.querySelector(MESSAGE_CONTAINER_SELECTOR);

    if (!container) {
        if (retryCount < 20) { // Retry for up to ~10 seconds
            console.log(`[${APP_NAME}] Message container not found. Retrying in 500ms...`);
            setTimeout(() => initObserver(retryCount + 1), 500);
        } else {
            console.error(`[${APP_NAME}] Failed to find message container after multiple retries.`);
        }
        return;
    }

    // Set up MutationObserver on the message list container
    observer = new MutationObserver(debounce(handleMutations, DEBOUNCE_DELAY));
    
    observer.observe(container, {
        childList: true,
        subtree: true
    });

    console.log(`[${APP_NAME}] Observer active on message container.`);
};

// Start initialization when the DOM is ready
if (document.readyState === "complete" || document.readyState === "interactive") {
    initObserver();
} else {
    globalThis.addEventListener("DOMContentLoaded", () => initObserver());
}
