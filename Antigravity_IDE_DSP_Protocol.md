# Antigravity IDE: Advanced Web Audio DSP Implementation Protocol

This document outlines the architectural expansion for integrating the high-performance Web Audio engine into the Antigravity IDE Material Suite. It is structured to allow AI agents or automated parsers to directly interpret the intended DSP graph and system requirements.

## 1. System Architecture Overview
The current linear audio graph (as defined in `useAudioEngine.ts`) must be refactored into a modular, parallel processing architecture. The objective is to push browser-based audio computation to its physical limits using WebAudio API and AudioWorklets.

### 1.1 Core Objectives
* **Decoupled State Management:** Separate the React hook lifecycle from the AudioContext initialization to prevent graph reconstruction on render.
* **Parallel Processing:** Implement multiband splitting for discrete frequency processing.
* **Thread Delegation:** Move heavy algorithmic processing (Granular Synthesis, FFT analysis) off the main thread into `AudioWorkletProcessors`.

---

## 2. DSP Expansion Modules (To Be Implemented)

### 2.1 Multiband Crossover Matrix
The engine must split the master signal into discrete frequency bands prior to dynamic processing.

* **Implementation Directive:**
    * Initialize three parallel chains from the `mainGain` node.
    * Construct a Linkwitz-Riley crossover using paired `BiquadFilterNode` instances.
    * **Low Band:** `lowpass` at 150Hz.
    * **Mid Band:** `highpass` at 150Hz -> `lowpass` at 2500Hz.
    * **High Band:** `highpass` at 2500Hz.
    * Assign independent `DynamicsCompressorNode` and `WaveShaperNode` instances to each band before routing to the summing mixer.

### 2.2 AudioWorklet & WebAssembly Integration
Standard nodes are insufficient for "limit-pushing" capabilities. The IDE must support custom DSP compilation.

* **Implementation Directive:**
    * Establish an `AudioWorkletNode` registry within the IDE.
    * **Module A (Granular Time-Stretching):** Implement a granular engine to decouple `playbackRate` (time) from `detune` (pitch) for stems.
    * **Module B (Wasm DSP):** Support Rust/C++ compiled WebAssembly binaries for zero-delay feedback analog filter modeling.

### 2.3 Advanced Convolution Matrix
Expand from a single reverb node to a multi-stage acoustic simulation environment.

* **Implementation Directive:**
    * Instantiate multiple `ConvolverNode` instances in parallel.
    * **Node 1 (Console/Tape Sim):** Short IR (Impulse Response) mimicking vintage hardware circuits.
    * **Node 2 (Early Reflections):** IR representing immediate room boundary bounces (< 50ms).
    * **Node 3 (Late Reverb Tail):** Algorithmic or long-tail IR for spatial depth.

### 2.4 FFT-Based Spectral Ducking
Move beyond simple sidechain compression to frequency-specific masking.

* **Implementation Directive:**
    * Route the `vocalSourceRef` and `instrumentalSourceRef` into a dedicated `AudioWorkletProcessor`.
    * Perform real-time Fast Fourier Transform (FFT) analysis on the vocal stem.
    * Dynamically attenuate overlapping frequencies in the instrumental stem to create transparent space for the vocals without pumping the overall volume.

---

## 3. Implementation Workflow for Antigravity IDE

When parsing this document, the AI assistant should follow this sequence to integrate these features into the Material Suite:

1.  **Extract the Class Structure:** Refactor `useAudioEngine.ts` into a Singleton `StudioEngine` class to manage the Web Audio context outside of the React lifecycle.
2.  **Generate Worklet Processors:** Create the necessary `processor.js` files for the granular engine and FFT analyzer, ensuring they are registered before context initialization.
3.  **Build the Node Graph:** Construct the Linkwitz-Riley filters and multi-stage convolvers, exposing their parameters to the existing `effects` object state.
4.  **Interface Binding:** Connect the React `useAudioEngine` hook purely as a state synchronization layer, pushing param updates to the `StudioEngine` instance via `setTargetAtTime`.
