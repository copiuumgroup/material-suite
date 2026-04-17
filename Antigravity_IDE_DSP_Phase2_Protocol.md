# Antigravity IDE: DSP Expansion Protocol (Phases 5-8)

## 1. Advanced Architecture Overview
This document outlines the next generation of DSP architecture for the Antigravity IDE Material Suite. It transitions the audio engine from native Web Audio API limitations to hardware-accelerated processing utilizing the GPU, local Neural Engines, and shared memory models.

## 2. DSP Expansion Modules (To Be Implemented)

### Phase 5: WebGPU Compute Shaders
Transition massive parallel floating-point processing from the CPU audio thread to the GPU.
* **Implementation Directive:**
    * Extract raw float arrays from the active `AudioBuffer`.
    * Implement WebGPU compute pipelines for heavy matrix operations (e.g., 100+ impulse response convolutions or 10,000-band spectral EQs).
    * Bypass native `ConvolverNode` and `BiquadFilterNode` for these specific intensive tasks to radically reduce CPU thermal load and rendering time.

### Phase 6: Native Neural Processing (WebNN & ONNX)
Integrate local machine learning models directly into the rendering pipeline for true, artifact-free source separation.
* **Implementation Directive:**
    * Deprecate the phase-cancellation (OOPS) `processVocalReduction` placeholder.
    * Initialize the WebNN API or ONNX Runtime Web within the engine context.
    * Load quantized pre-trained AI models (e.g., Demucs, Spleeter, or custom UVR models) into the IDE's local cache.
    * Enable offline, local processing to separate stems (Vocals, Drums, Bass, Melody) without external cloud server dependencies.

### Phase 7: Spatial Audio & Ambisonics (The 3D Matrix)
Expand the existing Mid/Side (M/S) stereo matrix into a full 3D spatial acoustic environment targeting VR/AR integration.
* **Implementation Directive:**
    * Implement 3rd-Order Ambisonics encoding/decoding logic.
    * Utilize HRTF (Head-Related Transfer Functions) via multi-node `PannerNode` matrices and custom delay networks.
    * Enable explicit physical positioning of stems (e.g., mapping vocal stems overhead and bass stems rear-center) for immersive Dolby Atmos-style output.

### Phase 8: SharedArrayBuffer Ring Architecture
Eliminate memory copying bottlenecks between the UI, Web Workers, and AudioWorklets during massive project renders.
* **Implementation Directive:**
    * Establish a lock-free Ring Buffer architecture utilizing `SharedArrayBuffer`.
    * Map the main React UI thread, the background DSP Web Worker, and the `AudioWorkletProcessor` to synchronously read/write from the exact same physical memory block.
    * Achieve zero-copy state synchronization to allow infinite scaling of track duration and simultaneous node counts without garbage collection pauses (stutters).

## 3. Integration Sequence for AI Assistant
When parsing this protocol, follow this precise upgrade sequence:
1. **Memory Foundation:** Implement the `SharedArrayBuffer` ring first. Memory stability and zero-copy routing must exist before adding massive GPU or Neural data loads.
2. **Neural Swap:** Replace the existing `processVocalReduction` method with the ONNX/WebNN stem separation architecture.
3. **Spatial Upgrades:** Inject the HRTF/Ambisonics matrix into the final mastering chain, building it as an optional toggle over the standard 2D M/S matrix.
4. **GPU Offloading:** Move the heaviest mathematical operations (specifically the multi-stage reverb tail convolutions) to the new WebGPU compute shader pipeline.
