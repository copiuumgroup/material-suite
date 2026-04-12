# Material Audio Studio 🎧💎

> **Professional High-Fidelity DSP Mastering Suite optimized for modern Windows LTSC releases.**

Material Audio Studio is a premium, local-first audio tool designed for modern Windows environments. It provides high-performance Digital Signal Processing (DSP) for creating "Slowed + Reverb" and "Nightcore" versions of tracks with professional-grade EQ, stabilization, and a robust ingestion engine.

---

## 🤖 Artificial Intelligence Warning
**This project was built with significant assistance from advanced AI agents (Antigravity).** 
While the codebase is hardened and functional, users should expect a highly specialized, native-first architecture that prioritizes AI-driven design patterns and direct system integration.

## ⚠️ Targeting & Compatibility
This application is strictly optimized and targeted for **Industrial & Enterprise Windows environments**. Compatibility is only guaranteed for:
-   **Windows 10 21H2 IoT Enterprise LTSC** and up.
-   **Windows 11 24H2 IoT Enterprise LTSC** and up.

*The app utilizes native Windows 11 Mica material and Title Bar Overlays that may not render correctly on Home/Pro versions or older builds.*

---

## ✨ Key Features

### 🔐 The Studio Vault
- **Self-Contained Sessions**: Every project is automatically internalized into a local "Vault" (`%APPDATA%/material-audio-tool/archives`).
- **Persistence Guarantee**: Delete or move the original source files; your Studio Archives remain perfectly intact.

### 📥 YT-DLP Ingestion Engine (New)
- **Local-First Ingest**: Robust ingestion using a local `yt-dlp` engine. No external cloud dependencies or API keys required.
- **Configurable Quality**: Select between **Lossless WAV** or **High-Quality MP3 (320kbps)** for your mastering source.
- **Real-Time Diagnostics**: Integrated system monitor with live terminal logs, auto-scrolling, and interactive font scaling (Ctrl+Scroll).
- **Process Guard**: Automated safety watchdogs, background process registries, and an interactive "Force Kill" fail-safe.

### ⏱️ Effective Mastering Chain
- **Slowed + Reverb**: Professional IR-convolution reverb and high-precision speed stretching.
- **Nightcore**: High-speed resampling with frequency preservation.
- **Dynamic Waveforms**: Real-time buffer rendering with precision seeking.

### 🎨 Visual & Audio Excellence
- **Android 16 Aesthetics**: Inspired by the latest Material 3 and Android 16 design principles—clean, high-contrast, and monochrome-focused.
- **Offline Ready**: All typography (Outfit/Inter), icons, and assets are served locally. Zero external network calls for assets.
- **Synthesized Sound Engine**: Deep system integration with unique audio signatures for Success, Warning, and Fatal events.

---

## 🚀 Getting Started

### Prerequisites
-   **Node.js v20+**
-   **yt-dlp** (Must be in your system PATH)
-   **ffmpeg** (Required for audio extraction)
-   **Windows 10/11 LTSC** (Recommended)

### Installation
```bash
# Clone the repository
git clone https://github.com/keriless/material-audio-tool.git

# Install dependencies
npm install

# Run in Development Mode
npm run dev
```

### Building for Production
```bash
npm run package
```

---

## 🛠️ Technology Stack
- **Core**: Electron, React 19, TypeScript
- **Styling**: Tailwind CSS v4, Lucide Icons, Framer Motion
- **Inference**: Native `yt-dlp` Process Management
- **Audio**: Web Audio API (AudioContext & Offline Rendering)
- **Database**: Dexie.js (IndexedDB)
- **Native**: Microsoft Mica / Windows 11 WCO Integration

---

**Built by Antigravity Studio.** 🚀💎
