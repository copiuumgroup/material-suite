# Dynamic Media Manipulation Brainstorming Guide

This document outlines the technical strategy for building a high-end, locally-running audio manipulation tool suite. It is designed to be readable for humans while providing the necessary logical framework for an AI to implement the features.

## 1. Likelihood of Success
**Status: Extremely High**
With your vision and my technical execution, building these algorithms locally is not only possible but preferred for performance and privacy. We aren't relying on complex cloud APIs; we are using the raw power of your computer via **WebAssembly (FFmpeg)** and the **Web Audio API**.

---

## 2. The "Aesthetic" Algorithms

### 🔮 Slowed + Reverb
This is the "sad/chill" vibe. It involves two distinct steps:
1.  **Slowed**: We lower the `playbackRate`. In an "Elastic" mode, we'd keep the pitch, but for the "Slowed" aesthetic, we usually **want** the pitch to drop (the "Generic" way).
2.  **Reverb**: We use a **ConvolverNode**. This essentially "multiplies" the audio by a "space" (called an Impulse Response). We can generate these spaces (Hall, Room, Cathedral) mathematically using white noise and exponential decay.

### ⚡ Nightcore
The "sped up/pitched up" vibe.
1.  **Sped up**: Increase `playbackRate` (e.g., 1.25x or 1.5x).
2.  **Pitched up**: Because we use a generic speed adjustment, the pitch naturally rises, creating that signature "anime" vocal sound.

---

## 3. Advanced Detection Algorithms

### 🥁 BPM Detection (Beats Per Minute)
To detect BPM locally without an API:
1.  **Filtering**: Strip away the high frequencies so we only "hear" the kicks/bass.
2.  **Peak Detection**: Look for spikes in volume (energy peaks).
3.  **Autocorrelation**: Compare the spikes over time to find a repeating pattern. The distance between these patterns tells us the BPM.

### 🎭 Genre & Effect Detection
1.  **Spectral Analysis**: We look at the "shape" of the sound.
    *   **EDM**: High energy in sub-bass and crisp highs.
    *   **Acoustic**: High mid-range presence, dynamic (loud and quiet parts).
2.  **Beat Consistency**: If the peaks are perfectly consistent, it’s likely electronic. If they drift, it’s likely a live performance.

---

## 4. The "Backend" Logic (The Boring but Important Stuff)

| Feature | Logic Type | Implementation |
| :--- | :--- | :--- |
| **Importing** | Buffer Loading | Read file as `ArrayBuffer` -> `decodeAudioData`. |
| **Rendering** | Offline Graph | Use `OfflineAudioContext` to burn effects into a new file. |
| **Exporting** | FFmpeg.wasm | Convert the raw audio to MP3/WAV locally. |
| **Caching** | Dexie.js | Store the `Blob` of the file in IndexedDB so it's there next time. |
| **Auto-saving** | State Sync | Every 30 seconds, save the "Project JSON" (settings like speed/eq) to the DB. |
| **Preloading** | Look-ahead | While one song plays, start decoding the next one in the background. |

---

## 5. Elastic vs. Generic Playback
*   **Generic**: Like a vinyl record. Speed up = Pitch up. Slow down = Pitch down. (Simpler, sounds "classic").
*   **Elastic**: Modern time-stretching. Speed up = Pitch stays the same. (Harder, requires complex math like Phase Vocoders). We will likely implement **Generic** for the aesthetics and **Elastic** via FFmpeg for high-quality renders.

---

## 6. How it works offline
We pack the **FFmpeg core** and **Wasm files** directly inside the application. When you open the tool, it doesn't need to ask a server how to process audio; it does it right on your CPU. This makes it fast, private, and permanent.

---

## 7. Advanced Signal Processing (PRO)

### 🥊 Transient Shaper (The "Punch" Algorithm)
We now have a dedicated **Audio Worklet** (a background math engine) that isolates the "Attack" of your sounds. 
- **Punch**: Boosts the initial hit of a drum.
- **Body**: Controls the ring and sustain.

### 📐 Auto-Level (Spectral Balance)
The app now "scans" the audio buffer and compares it to a **Golden Mean Curve**. It then suggests (and applies) EQ settings to automatically fix imbalances in your mix.

### 🧵 Elastic vs. Generic Mode
- **Generic**: Classic pitch-drifting when changing speed.
- **Elastic**: Uses a **Phase Vocoder** logic to keep the pitch steady while the speed changes.

---

## Next Steps for the Team
1.  **AI Mixing Presets**: We can now expand on "Auto-Level" to create Genre-specific profiles.
2.  **Master Export**: Use the high-precision mode for final renders.
