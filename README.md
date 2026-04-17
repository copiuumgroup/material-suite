# 💎 Material Suite
**The Definitive Native-First Audio Mastering Studio by copiuum group.**

Material Suite is a high-performance, local-first audio environment designed for professional Windows mastering. It combines modern Material Design 3 aesthetics with a professional-grade DSP engine, providing a robust suite for "Slowed + Reverb", "Nightcore", and high-fidelity mastering.

---

## 🤖 Artificial Intelligence Warning
**This project was built with significant assistance from advanced AI agents (copiuum group).** 
While the codebase is hardened and production-ready, it utilizes highly specialized, native-first architecture that prioritizes AI-driven design patterns and direct system integration.

## ⚠️ Targeting & Compatibility
This application is strictly optimized for **Industrial & Enterprise Windows environments**. Compatibility is only guaranteed for:
-   **Windows 10 21H2+ IoT Enterprise LTSC**
-   **Windows 11 22H2+ IoT Enterprise LTSC**

*The app utilizes native Windows 11 Mica material and Title Bar Overlays. Transparency is disabled in the core to ensure 100% reliability for Windows Snap Layouts and Snap Assist.*

---

## ✨ Key Features

### 🎨 Duo-Design System
- **Material 3 (Android 16 style)**: Vibrant, glassmorphic, and dynamic design for a modern creative experience.
- **Metro Modern UI (Windows 8.1)**: A high-velocity, monolithic monochrome mode with sharp corners and cubic-bezier (snappy) animations, optimized for distraction-free mastering.

### 🎛️ Professional Mastering Chain (V3 Engine)
- **3-Way Multi-Band Compressor**: A high-fidelity crossover matrix that splits audio into Lows (< 250Hz), Mids (250Hz - 4kHz), and Highs (> 4kHz) for surgical dynamic control.
- **Auto-EQ (Algorithmic)**: Analyzes track frequency response and suggests corrective curves (Sub, Bass, Mid, Treble, Air).
- **Slowed + Reverb**: Professional IR-convolution reverb with a custom Impulse Vault and high-precision speed stretching.
- **Nightcore**: High-speed resampling with frequency preservation and "Hyper-pop" aesthetic.
- **Flawless Seek Sync**: Physically decoupled 'Real World Time' and 'Buffer Time' ensures perfect scrubbing even during heavy speed/pitch manipulation.

### 📹 High-Performance Video Export
- **FFmpeg WASM Integration**: Native browser-based video multiplexing (H.264 / AAC) at 320kbps.
- **Variable FPS Control**: Toggle between 24 (Cinematic/Fast), 30 (Standard), and 60 (Smooth) FPS to optimize render speed vs. visual fluidity.
- **Dynamic Canvas Thumbnails**: Automated typographical plate generation for tracks missing ID3 cover art—incorporating titles and effects directly into the video stream.

### 📥 YT-DLP Ingestion Suite (Hardened)
- **Batch Unpacking**: Directly ingest entire SoundCloud profiles, YouTube playlists, or albums into a staging area.
- **Session Manager**: Unified logging feed and real-time metadata parsing with multi-line JSON support.
- **Target Vault Node**: Native folder picker integration allowing you to route high-quality ingests to any project directory.

---

## 🚀 Getting Started

### Prerequisites
-   **Node.js v22+**
-   **yt-dlp** (Must be in your system PATH)
-   **ffmpeg** (Required for high-fidelity audio extraction and native rendering fallback)
-   **Windows 10/11 LTSC** (Recommended)

### Installation
```bash
# Clone the repository
git clone https://github.com/copiuumgroup/material-suite.git

# Install dependencies
npm install

# Run in Development Mode
npm run dev
```

### Building for Production
```bash
# Generate a portable standalone .exe
npm run package
```

---

## 🛠️ Technology Stack
- **Core**: Electron, React 19, TypeScript 6.0
- **DSP**: Web Audio API (AudioContext & 32-bit Float Offline Rendering)
- **Video**: FFmpeg WebAssembly (v0.12+)
- **Styling**: Tailwind CSS v4, Lucide Icons, Framer Motion (Cubic Bézier velocity)
- **Ingestion**: Hardened `yt-dlp` Native Process Management
- **Storage**: Dexie.js (IndexedDB) with native FS-Metadata caching
- **Integration**: Microsoft Mica / Native Windows Controls Overlay (WCO)

---

**Material Suite** is the intellectual property of **copiuum group**, a collective of multiple individuals behind the name. All rights reserved. 🚀💎
