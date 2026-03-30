/**
 * Popup Script for SentriX Extension.
 * Handles interaction between the popup UI and the Chrome extension background/storage.
 */

document.addEventListener("DOMContentLoaded", async () => {
    console.log("SentriX Popup Initialized");

    const extensionToggle = document.getElementById("extensionToggle");
    const parentEmailInput = document.getElementById("parentEmail");
    const sendPingBtn = document.getElementById("sendPing");
    const statusMsg = document.getElementById("statusMessage");

    const mildCountEl = document.getElementById("mildCount");
    const severeCountEl = document.getElementById("severeCount");
    const pulseDot = document.getElementById("pulseDot");

    /** Initialize storage values */
    const settings = await chrome.storage.sync.get(["isEnabled", "parentEmail", "mildCount", "severeCount"]);
    
    extensionToggle.checked = settings.isEnabled !== false; // Default to true
    pulseDot.style.display = extensionToggle.checked ? "inline-block" : "none";
    parentEmailInput.value = settings.parentEmail || "";
    mildCountEl.textContent = settings.mildCount || 0;
    severeCountEl.textContent = settings.severeCount || 0;

    /** Toggle logic */
    extensionToggle.addEventListener("change", (e) => {
        chrome.storage.sync.set({ isEnabled: e.target.checked });
        pulseDot.style.display = e.target.checked ? "inline-block" : "none";
        showStatus(e.target.checked ? "Monitoring Enabled" : "Monitoring Paused");
    });

    /** Save email on input change (debounced via change event) */
    parentEmailInput.addEventListener("change", (e) => {
        chrome.storage.sync.set({ parentEmail: e.target.value.trim() });
        showStatus("Email saved");
    });

    /** Ping background script */
    sendPingBtn.addEventListener("click", () => {
        statusMsg.textContent = "Sending ping...";
        chrome.runtime.sendMessage({ type: "PING" }, (response) => {
            if (chrome.runtime.lastError) {
                statusMsg.textContent = "Error: Background not responding.";
            } else {
                statusMsg.textContent = `Response: Background is ${response.status}!`;
                setTimeout(() => {
                    statusMsg.textContent = "";
                }, 2000);
            }
        });
    });

    /** Utility: show brief status message */
    function showStatus(msg) {
        statusMsg.textContent = msg;
        setTimeout(() => {
            if (statusMsg.textContent === msg) {
                statusMsg.textContent = "";
            }
        }, 1500);
    }
});
