# SubLingua AI ⚡

> **Intelligent Subtitle Localization & Live Editor converting video/sub files into authentic Roman-script Gen-Z Hinglish using the Google Gemini API.**

SubLingua AI is a client-side web application designed to translate standard English subtitles into authentic, relatable, Roman-script Indian Gen-Z Hinglish (e.g., *"Bro scene kya chal raha hai"*, *"No cap yaar"*, *"Full cringe vibe"*, *"Asli mazaak chal raha hai"*) with **strict zero-desync timestamp locking** and an interactive synchronized editing workspace.

---

## 🌟 Key Features

### 1. Mandatory API Key Validation & Dynamic Model Selection
- **Interactive Security Gate:** Inputs your Google Gemini API key and securely persists it in browser `localStorage`.
- **Live Test & Verification:** Clicking **"Test & Verify Key"** makes a live verification request directly to Google Gemini's API.
- **Controls Disabled Until Verified:** All translation controls, model pickers, and processing actions remain strictly disabled until the key passes verification.
- **Dynamic Model Enumeration:** Upon verification, dynamically fetches all available Gemini models supporting `generateContent` (e.g. `gemini-2.5-flash`, `gemini-2.0-flash`, `gemini-1.5-flash`, `gemini-1.5-pro`) and selects the fastest model by default.

### 2. Flexible File Ingestion & Video Container Inspector
- **Standalone Subtitle Files:** Drag-and-drop or file upload for `.srt` (SubRip) and `.vtt` (WebVTT).
- **Video Containers (`.mp4`, `.mkv`, `.webm`):**
  - Binary header and HTML5 `textTracks` container inspection scans for embedded subtitle tracks.
  - Interactive track selector to choose embedded streams.
  - Informative fallback prompt when no embedded streams are found, allowing immediate upload of a separate `.srt` or 1-click loading of sample subtitles.
  - Built-in video player synchronized with subtitle playback and active cue highlighting.

### 3. Top Sticky Real-Time Progress Bar
- Animated fill progress bar pinned to the top of the viewport during translation.
- Displays live percentage and exact cue counts: e.g., `Translating: 58% completed (82/140 cues translated)`.
- Interactive controls: **Pause**, **Resume**, and **Stop** buttons.

### 4. Side-by-Side Dual Real-Time Workspace
- **Zero-Desync Timestamp Locking:** Timestamps are strictly locked in memory and never sent to the LLM or modified, guaranteeing 100% video-to-audio synchronization.
- **Left Column (Source):** Displays original cue index, frozen timestamp badges, and source text.
- **Right Column (Target):** Displays live translated Roman Gen-Z Hinglish as batches arrive.
- **Inline Editing:** Every Hinglish cue cell is directly editable with real-time autosave to memory and an **"Edited"** status badge.
- **Batching & Resiliency:** Chunks cues into batches of 25–30 with automatic exponential backoff retry handling for API rate limits (HTTP 429).
- **Dialogue Search & Filter:** Filter cues by status (`All`, `Pending`, `Translating`, `Translated`, `Edited`) or search text/timing.

### 5. Export & Download Suite
- **Custom Filename Input:** Allows custom naming (e.g., `my_anime_ep1_hinglish`).
- **Strict Format Enforcement:** Strictly exports matching subtitle standards (`.srt` or `.vtt`) with standard UTF-8 encoding. Never exports as plain `.txt`.
- **Client-Side Blob Downloads:** Direct browser downloads without external backends.
- **Copy All to Clipboard:** One-click copy of the entire serialized subtitle file.
- **Reset Workspace:** One-click reset to start fresh.

---

## 🚀 Getting Started

1. Open a terminal in the project directory:
   ```bash
   node server.js
   ```
2. Navigate in any browser to:
   ```
   http://localhost:3000/
   ```
3. Enter your Google Gemini API key (or get a free key at [Google AI Studio](https://aistudio.google.com/app/apikey)) and click **"Test & Verify Key"**.
4. Click **"Load Demo Cues"** or drag-and-drop your `.srt`, `.vtt`, or video file.
5. Choose your Hinglish vibe (*Casual Chill*, *Full Gen-Z Savage*, or *Cinematic Drama*) and click **"Start Subbing"**!
