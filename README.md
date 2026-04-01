# Aegis-AI 🛡️
### AI-Powered Cyberbullying Detection for WhatsApp Web

> **Real-time detection. Fully local. No API keys. No cloud.**  
> Uses Llama/Mistral (via Ollama) to classify messages as SAFE, MILD, or SEVERE — directly on WhatsApp Web.

---

## 👋 Handoff Setup Guide (Read This First)

This project has **2 parts** you must run simultaneously:

| Part | What it is | How to start |
|---|---|---|
| **Backend Server** | Node.js app that talks to the AI | `node server.js` |
| **Chrome Extension** | Injects into WhatsApp Web | Load via `chrome://extensions` |

---

## ✅ Prerequisites

Install these **before anything else**:

### 1. Node.js (v18+)
👉 Download: https://nodejs.org  
After install, confirm in terminal:
```
node -v
```
Should show `v18.x.x` or higher.

---

### 2. Ollama (Local AI Engine)
👉 Download: https://ollama.com  
Install it like a normal app (Windows/Mac/Linux supported).

After install, open terminal and **download the AI model**:
```
ollama pull mistral
```

> 📦 **Model:** `mistral` — a fast, accurate 7B parameter model  
> 💾 **Download size:** ~4.1 GB (one-time download)  
> ⏱️ Wait for it to complete before starting the server

To confirm it downloaded correctly:
```
ollama list
```
You should see `mistral` in the list.

---

### 3. Google Chrome
👉 Download: https://www.google.com/chrome  
(Must be Chrome — not Edge, Firefox, etc.)

---

## 🚀 Setup Steps (Do In Order)

### STEP 1 — Start Ollama

Open a terminal and run:
```
ollama serve
```
Leave this terminal open. Ollama runs on port `11434`.

---

### STEP 2 — Start the Backend Server

Open a **new terminal**, navigate to the `server` folder:
```
cd path\to\SentriX\server
npm install
node server.js
```

You should see:
```
╔══════════════════════════════════════╗
║      AegisAI Intelligence Engine     ║
╠══════════════════════════════════════╣
║  Server   : http://localhost:5000    ║
║  Model    : mistral                  ║
║  Ollama   : http://localhost:11434   ║
╚══════════════════════════════════════╝
```

> ⚠️ Keep this terminal open while using the extension.

---

### STEP 3 — Load the Chrome Extension

1. Open Chrome
2. Go to: `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right)
4. Click **Load unpacked**
5. Select the **root `SentriX` folder** (the one containing `manifest.json`)
6. The AegisAI 🛡️ shield icon appears in your toolbar

---

### STEP 4 — Test It

1. Go to [web.whatsapp.com](https://web.whatsapp.com)
2. Log in with your phone's QR code
3. Open any chat
4. Send this message:
   ```
   You are useless
   ```
5. You should see a **🚨 Severe** badge appear on the message

---

## 🎨 What You'll See

| Message | Badge | Effect |
|---|---|---|
| Normal message | `✓ Safe` green badge | Nothing |
| Slightly rude message | `⚡ Mild` amber badge | Nothing |
| Abusive/threatening | `🚨 Severe` red badge | Message blurred + reveal button |

---

## 🔍 How to Check It's Working

**Browser Console** (F12 on WhatsApp tab → Console):
```
🔥 Extension working on WhatsApp
🚀 Observer attached to body
🔥 MESSAGE DETECTED: You are useless
[AegisAI] Result → SEVERE
[AegisAI] 🎨 Badge shown: SEVERE
```

**Server Terminal:**
```
[AegisAI] Analyzing: "You are useless..."
[AegisAI] Result: SEVERE | Reason: abusive, insulting
```

---

## 🧯 Troubleshooting

| Problem | Fix |
|---|---|
| No badge appearing | Reload extension in `chrome://extensions/` → click ↺ |
| Server not starting | Run `npm install` inside the `server/` folder first |
| Ollama error | Run `ollama serve` in a separate terminal |
| Model not found | Run `ollama pull mistral` |
| Extension not loading | Make sure you selected the **root** `AegisAI/` folder, not `server/` |
| WhatsApp not scanning | Hard refresh: `Ctrl + Shift + R` after loading extension |

---

## 📂 Project Structure

```
AegisAI/
├── manifest.json          ← Chrome Extension config
├── background.js          ← Service Worker (bridges extension ↔ server)
│
├── content/
│   └── observer.js        ← Watches WhatsApp, injects badges
│
├── popup/
│   ├── index.html         ← Extension popup UI
│   └── popup.js           ← Popup logic (stats, toggle, server status)
│
├── server/
│   ├── server.js          ← Express API + Ollama integration
│   ├── package.json
│   └── .env.example       ← Copy to .env for custom config
│
└── icons/                 ← Extension icons
```

---

## ⚙️ Configuration (Optional)

Create a `.env` file inside `server/` (copy from `.env.example`):
```env
PORT=5000
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=mistral
```

### 🤖 Available AI Models

AegisAI uses **Mistral** by default. You can swap it for any model supported by Ollama.

| Model | Pull Command | Size | Speed | Best For |
|---|---|---|---|---|
| `mistral` ⭐ | `ollama pull mistral` | ~4.1 GB | Fast | **Recommended** |
| `llama3` | `ollama pull llama3` | ~4.7 GB | Fast | Alternative |
| `llama3.1` | `ollama pull llama3.1` | ~4.7 GB | Fast | Latest Llama |
| `gemma3` | `ollama pull gemma3` | ~5.4 GB | Medium | Google model |
| `phi3` | `ollama pull phi3` | ~2.2 GB | Very Fast | Low RAM machines |
| `tinyllama` | `ollama pull tinyllama` | ~0.6 GB | Fastest | Minimal hardware |

**To switch models:**
1. Pull the model: `ollama pull <model-name>`
2. Edit `server/.env` → set `OLLAMA_MODEL=<model-name>`
3. Restart the server: `node server.js`

> 💡 If you don't have a `.env` file, just edit line 18 of `server/server.js`:
> ```js
> const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';
> ```
> Change `'mistral'` to your preferred model name.

---

## 🔒 Privacy

- **100% local** — no data leaves your machine
- No accounts, no API keys, no subscriptions
- Ollama runs on your CPU/GPU locally

---

## 📋 Quick Cheatsheet

```bash
# Terminal 1 — AI Engine
ollama serve

# Terminal 2 — Backend
cd AegisAI/server
node server.js

# Chrome
chrome://extensions/ → Load unpacked → select AegisAI/ folder
# Then go to web.whatsapp.com
```

---

*Built with Node.js + Express + Ollama (Mistral) + Chrome Extension MV3*
