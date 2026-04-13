import { studioAPI } from './MaterialStudioAPI';

export interface StudioEffectParams {
  speed: number;
  reverbWet: number;
  isNightcore: boolean;
  isVocalReduced: boolean;
}

class AlgorithmEngine {
  private static instance: AlgorithmEngine;
  private audioCtx: AudioContext | null = null;

  private constructor() { }

  public static getInstance(): AlgorithmEngine {
    if (!AlgorithmEngine.instance) {
      AlgorithmEngine.instance = new AlgorithmEngine();
    }
    return AlgorithmEngine.instance;
  }

  public setContext(ctx: AudioContext) {
    this.audioCtx = ctx;
  }

  // --- MATHEMATICAL REVERB GENERATOR ---
  public async createReverbBuffer(duration: number, decay: number): Promise<AudioBuffer> {
    if (!this.audioCtx) throw new Error("AudioContext not initialized");

    studioAPI.emitStudioLog(`Generating Mathematical Reverb (Dur: ${duration}s, Decay: ${decay})...`);

    const sampleRate = this.audioCtx.sampleRate;
    const length = sampleRate * duration;
    const impulse = this.audioCtx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        // Exponentially decaying white noise
        const noise = (Math.random() * 2 - 1);
        channelData[i] = noise * Math.pow(1 - i / length, decay);
      }
    }

    return impulse;
  }

  // --- AI-READY VOCAL REDUCTION SLOT ---
  /**
   * Currently implements a High-Quality OOPS (Out Of Phase Stereo) filter 
   * as a placeholder for a future ONNX/UVR AI model.
   */
  public async processVocalReduction(buffer: AudioBuffer): Promise<AudioBuffer> {
    if (!this.audioCtx) throw new Error("AudioContext not initialized");

    studioAPI.emitStudioLog("AI SLOT: Preparing Vocal Reduction Module...");

    const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;

    // Vocal Reduction Logic (Mid-Side Subtraction)
    // L_new = L - R, R_new = R - L
    const splitter = offlineCtx.createChannelSplitter(2);
    const gainL = offlineCtx.createGain();
    const gainR = offlineCtx.createGain();
    const invL = offlineCtx.createGain();
    const invR = offlineCtx.createGain();
    const merger = offlineCtx.createChannelMerger(2);

    invL.gain.value = -1;
    invR.gain.value = -1;

    source.connect(splitter);

    // Left Channel Processing
    splitter.connect(gainL, 0);
    splitter.connect(invR, 1);
    invR.connect(gainL);
    gainL.connect(merger, 0, 0);

    // Right Channel Processing
    splitter.connect(gainR, 1);
    splitter.connect(invL, 0);
    invL.connect(gainR);
    gainR.connect(merger, 0, 1);

    merger.connect(offlineCtx.destination);
    source.start();

    return await offlineCtx.startRendering();
  }

  // --- MASTER PROCESSING ---
  public async renderMaster(buffer: AudioBuffer, params: StudioEffectParams): Promise<AudioBuffer> {
    studioAPI.emitStudioLog(`STARTING MASTER RENDER: ${params.speed}x speed, ${Math.round(params.reverbWet * 100)}% reverb...`);

    // 1. Calculate new length based on speed and add tail for reverb (fixed 2.5s tail)
    const tailSeconds = 2.5;
    const renderedSampleRate = buffer.sampleRate;
    const newLength = Math.ceil((buffer.length / params.speed) + (tailSeconds * renderedSampleRate));

    const offlineCtx = new OfflineAudioContext(2, newLength, renderedSampleRate);

    // 2. Setup Source
    let sourceBuffer = buffer;

    // Apply Vocal Reduction first if enabled (it's a pre-pass)
    if (params.isVocalReduced) {
      sourceBuffer = await this.processVocalReduction(buffer);
    }

    const source = offlineCtx.createBufferSource();
    source.buffer = sourceBuffer;
    source.playbackRate.value = params.speed;

    // 3. Setup Processing Nodes
    const mainGain = offlineCtx.createGain();

    if (params.reverbWet > 0) {
      const reverb = offlineCtx.createConvolver();
      reverb.buffer = await this.createReverbBuffer(tailSeconds, 2.0);

      const wetGain = offlineCtx.createGain();
      const dryGain = offlineCtx.createGain();

      wetGain.gain.value = params.reverbWet;
      dryGain.gain.value = 1 - (params.reverbWet * 0.5); // Attenuate dry slightly to prevent clipping

      source.connect(dryGain);
      dryGain.connect(mainGain);

      source.connect(reverb);
      reverb.connect(wetGain);
      wetGain.connect(mainGain);
    } else {
      source.connect(mainGain);
    }

    mainGain.connect(offlineCtx.destination);

    // 4. Execute Render
    source.start(0);
    const result = await offlineCtx.startRendering();
    studioAPI.emitStudioLog("MASTER RENDER COMPLETE.");
    return result;
  }
}

export const studioEngine = AlgorithmEngine.getInstance();
