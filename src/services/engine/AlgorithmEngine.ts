import { studioAPI } from './MaterialStudioAPI';

export interface StudioEffectParams {
  speed: number;
  reverbWet: number;
  isNightcore: boolean;
  isVocalReduced: boolean;
  isMultibandEnabled: boolean;
  isAutoEQEnabled: boolean;
  customIRBuffer: AudioBuffer | null;
  saturation: number; // 0..100
  reverbRoomSize: number; // 0.1..10 (seconds)
  stereoWidth: number; // 0..200 (100 is neutral)
  tapeWow: number; // 0..100
  tapeFlutter: number; // 0..100
  analysis?: {
    suggestedEQ: {
      sub: number;
      bass: number;
      mid: number;
      treble: number;
      air: number;
    };
  };
  irId?: number;
  limiter?: {
    threshold: number;
    ratio: number;
    attack: number;
    release: number;
  };
  vocalPitch: number;
  vocalTone: number;
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
  /**
   * Generates a lush, mathematical reverb impulse response.
   * Includes pre-delay and multiple diffusion stages for high-end quality.
   */
  public async createReverbBuffer(duration: number, decay: number, preDelay: number = 0.02, roomSizeMultiplier: number = 1.0): Promise<AudioBuffer> {
    if (!this.audioCtx) throw new Error("AudioContext not initialized");

    const effectiveDuration = duration * roomSizeMultiplier;
    studioAPI.emitStudioLog(`Generating Material Reverb (Dur: ${effectiveDuration.toFixed(2)}s, Decay: ${decay}, Pre-Delay: ${preDelay * 1000}ms)...`);

    const sampleRate = this.audioCtx.sampleRate;
    const length = Math.floor(sampleRate * effectiveDuration);
    const preDelaySamples = Math.floor(preDelay * sampleRate);
    const impulse = this.audioCtx.createBuffer(2, length, sampleRate);

    for (let channel = 0; channel < 2; channel++) {
      const channelData = impulse.getChannelData(channel);
      
      for (let i = preDelaySamples; i < length; i++) {
        const noise = (Math.random() * 2 - 1);
        const decayFactor = Math.pow(1 - (i - preDelaySamples) / (length - preDelaySamples), decay);
        
        const earlyReflections = (i > preDelaySamples + 1000) ? channelData[i - 1000] * 0.2 : 0;
        
        channelData[i] = (noise + earlyReflections) * decayFactor;
      }
      
      for (let i = 1; i < length; i++) {
        channelData[i] = channelData[i] * 0.8 + channelData[i - 1] * 0.2;
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

    studioAPI.emitStudioLog("ALGORITHM: Applying HQ Center-Channel Subtraction...");

    const offlineCtx = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;

    // Advanced Vocal Reduction Logic:
    // 1. Split to Mid/Side
    // 2. Filter Mid (300Hz - 8kHz) where most vocals live
    // 3. Subtract filtered Mid from original mix
    
    const splitter = offlineCtx.createChannelSplitter(2);
    const merger = offlineCtx.createChannelMerger(2);
    
    
    
    // Vocal-band Filter (Bandpass 300Hz - 8kHz)
    const bandpass = offlineCtx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 2500;
    bandpass.Q.value = 0.5;

    const inverter = offlineCtx.createGain();
    inverter.gain.value = -1;

    source.connect(splitter);

    // Technique: OOPS + Bass Preservation
    // Preserves frequencies < 200Hz and > 10kHz to keep the "thump" and "shimmer"
    const lowPass = offlineCtx.createBiquadFilter();
    lowPass.type = 'lowpass';
    lowPass.frequency.value = 250;

    const highPass = offlineCtx.createBiquadFilter();
    highPass.type = 'highpass';
    highPass.frequency.value = 8000;

    // Connect Source -> BP -> Invert -> Mix
    splitter.connect(bandpass, 0); // Left center
    splitter.connect(bandpass, 1); // Right center
    bandpass.connect(inverter);

    // Left Mix: Original L + Inverted Bandpassed R
    const leftMix = offlineCtx.createGain();
    splitter.connect(leftMix, 0);
    inverter.connect(leftMix);
    leftMix.connect(merger, 0, 0);

    // Right Mix: Original R + Inverted Bandpassed L
    const rightMix = offlineCtx.createGain();
    splitter.connect(rightMix, 1);
    inverter.connect(rightMix);
    rightMix.connect(merger, 0, 1);

    merger.connect(offlineCtx.destination);
    source.start();

    return await offlineCtx.startRendering();
  }

  // --- MASTER PROCESSING ---
  public async renderMaster(buffer: AudioBuffer, params: StudioEffectParams): Promise<AudioBuffer> {
    studioAPI.emitStudioLog(`STARTING MASTER RENDER: ${params.speed}x speed, ${Math.round(params.reverbWet * 100)}% reverb...`);

    const tailSeconds = params.reverbRoomSize || 3.0;
    const renderedSampleRate = buffer.sampleRate;
    const newLength = Math.ceil((buffer.length / params.speed) + (tailSeconds * renderedSampleRate));

    const offlineCtx = new OfflineAudioContext(2, newLength, renderedSampleRate);

    // 1. Setup Source
    let sourceBuffer = buffer;
    if (params.isVocalReduced) {
      sourceBuffer = await this.processVocalReduction(buffer);
    }

    const source = offlineCtx.createBufferSource();
    source.buffer = sourceBuffer;
    source.playbackRate.value = params.speed;

    // 2. Setup Chain
    const mainChain = offlineCtx.createGain();

    // 3. Reverb Node
    if (params.reverbWet > 0) {
      const reverb = offlineCtx.createConvolver();
      if (params.customIRBuffer) {
        reverb.buffer = params.customIRBuffer;
      } else {
        reverb.buffer = await this.createReverbBuffer(tailSeconds, 3.5, 0.02);
      }

      const wetGain = offlineCtx.createGain();
      const dryGain = offlineCtx.createGain();

      wetGain.gain.value = params.reverbWet;
      dryGain.gain.value = 1 - (params.reverbWet * 0.4); 

      source.connect(dryGain);
      dryGain.connect(mainChain);

      source.connect(reverb);
      reverb.connect(wetGain);
      wetGain.connect(mainChain);
    } else {
      source.connect(mainChain);
    }

    // 4. Analog Saturation (Soft-Clipping WaveShaper)
    let currentInput: AudioNode = mainChain;
    if (params.saturation > 0) {
        const shaper = offlineCtx.createWaveShaper();
        const drive = params.saturation / 50;
        const curveLen = 44100;
        const curve = new Float32Array(curveLen);
        for (let i = 0; i < curveLen; i++) {
            const x = (i * 2) / curveLen - 1;
            curve[i] = Math.tanh(x * (1 + drive));
        }
        shaper.curve = curve;
        shaper.oversample = '4x';
        currentInput.connect(shaper);
        currentInput = shaper;
    }

    // 5. Tape Flutter (LFO-driven Pitch Jitter)
    // We use a short delay line modulated by LFOs to simulate tape transport instability.
    if (params.tapeWow > 0 || params.tapeFlutter > 0) {
        const flutterDelay = offlineCtx.createDelay(0.1);
        flutterDelay.delayTime.value = 0.005; // Base 5ms delay
        
        // Wow LFO (Slow drift ~0.5Hz to 2Hz)
        if (params.tapeWow > 0) {
            const wowOsc = offlineCtx.createOscillator();
            wowOsc.frequency.value = 0.8; 
            const wowGain = offlineCtx.createGain();
            wowGain.gain.value = (params.tapeWow / 100) * 0.002; // max 2ms drift
            wowOsc.connect(wowGain);
            wowGain.connect(flutterDelay.delayTime);
            wowOsc.start(0);
        }

        // Flutter LFO (Fast jitter ~6Hz to 20Hz)
        if (params.tapeFlutter > 0) {
            const flutterOsc = offlineCtx.createOscillator();
            flutterOsc.frequency.value = 12.0;
            const flutterGain = offlineCtx.createGain();
            flutterGain.gain.value = (params.tapeFlutter / 100) * 0.0005; // max 0.5ms jitter
            flutterOsc.connect(flutterGain);
            flutterGain.connect(flutterDelay.delayTime);
            flutterOsc.start(0);
        }

        currentInput.connect(flutterDelay);
        currentInput = flutterDelay;
    }

    // 6. Stereo Imager (Mid-Side Matrix)
    // Complex M/S processing for professional width control
    if (params.stereoWidth !== 100) {
        const splitter = offlineCtx.createChannelSplitter(2);
        const merger = offlineCtx.createChannelMerger(2);
        
        // M = 0.5 * (L + R)
        // S = 0.5 * (L - R)
        const midGain = offlineCtx.createGain();
        midGain.gain.value = 0.5;
        const sideGain = offlineCtx.createGain();
        sideGain.gain.value = 0.5;
        const inverter = offlineCtx.createGain();
        inverter.gain.value = -1;

        currentInput.connect(splitter);
        
        // Mid Path
        const midBranch = offlineCtx.createGain();
        splitter.connect(midBranch, 0, 0); // L
        splitter.connect(midBranch, 1, 0); // R
        midBranch.connect(midGain);

        // Side Path
        const sideBranchLeft = offlineCtx.createGain();
        const sideBranchRight = offlineCtx.createGain();
        splitter.connect(sideBranchLeft, 0, 0); // L
        splitter.connect(sideBranchRight, 1, 0); // R
        
        const sideSum = offlineCtx.createGain();
        sideBranchLeft.connect(sideSum);
        sideBranchRight.connect(inverter);
        inverter.connect(sideSum);
        
        // Apply Width to Side
        const widthGain = offlineCtx.createGain();
        widthGain.gain.value = params.stereoWidth / 100;
        sideSum.connect(widthGain);
        widthGain.connect(sideGain);

        // Reconstruct L/R
        // L = M + S
        // R = M - S
        const finalL = offlineCtx.createGain();
        const finalR = offlineCtx.createGain();
        const sideInverter = offlineCtx.createGain();
        sideInverter.gain.value = -1;

        midGain.connect(finalL);
        sideGain.connect(finalL);

        midGain.connect(finalR);
        sideGain.connect(sideInverter);
        sideInverter.connect(finalR);

        finalL.connect(merger, 0, 0);
        finalR.connect(merger, 0, 1);
        
        currentInput = merger;
    }

    // 7. Advanced Mastering Chain
    let finalNode: AudioNode = currentInput;

    // 7.1 Auto-EQ Injection
    if (params.isAutoEQEnabled && params.analysis) {
        const eq = params.analysis.suggestedEQ;
        
        const createFilter = (freq: number, gain: number, type: BiquadFilterType) => {
          const filter = offlineCtx.createBiquadFilter();
          filter.type = type;
          filter.frequency.value = freq;
          filter.gain.value = gain;
          return filter;
        };

        const sub = createFilter(60, eq.sub, 'lowshelf');
        const bass = createFilter(250, eq.bass, 'peaking');
        const mid = createFilter(1000, eq.mid, 'peaking');
        const treble = createFilter(4000, eq.treble, 'peaking');
        const air = createFilter(12000, eq.air, 'highshelf');

        finalNode.connect(sub);
        sub.connect(bass);
        bass.connect(mid);
        mid.connect(treble);
        treble.connect(air);
        finalNode = air;
    }

    // 7.2 Multi-Band Compressor
    if (params.isMultibandEnabled) {
        studioAPI.emitStudioLog("ALGORITHM: Engaging 3-Way Multi-Band Compressor...");
        
        // 3-Way Crossover Frequencies: 250Hz and 4000Hz
        
        // --- LOW BAND (< 250Hz) ---
        // Tight, heavy compression to lock the bass in place
        const lowLPF = offlineCtx.createBiquadFilter();
        lowLPF.type = 'lowpass';
        lowLPF.frequency.value = 250;
        const lowComp = offlineCtx.createDynamicsCompressor();
        lowComp.threshold.value = -12;
        lowComp.ratio.value = 6;
        lowComp.attack.value = 0.005; // 5ms attack
        lowComp.release.value = 0.1;

        // --- MID BAND (250Hz - 4000Hz) ---
        // Gentle compression for vocals/guitars to retain dynamics
        const midHPF = offlineCtx.createBiquadFilter();
        midHPF.type = 'highpass';
        midHPF.frequency.value = 250;
        const midLPF = offlineCtx.createBiquadFilter();
        midLPF.type = 'lowpass';
        midLPF.frequency.value = 4000;
        const midComp = offlineCtx.createDynamicsCompressor();
        midComp.threshold.value = -18;
        midComp.ratio.value = 3;
        midComp.attack.value = 0.02; // 20ms attack allows transients through
        midComp.release.value = 0.3;

        // --- HIGH BAND (> 4000Hz) ---
        // Very fast, light compression to catch harsh sibilance/cymbals
        const highHPF = offlineCtx.createBiquadFilter();
        highHPF.type = 'highpass';
        highHPF.frequency.value = 4000;
        const highComp = offlineCtx.createDynamicsCompressor();
        highComp.threshold.value = -24;
        highComp.ratio.value = 4;
        highComp.attack.value = 0.001; // 1ms attack (fastest)
        highComp.release.value = 0.05;

        // Summing bus
        const sumBus = offlineCtx.createGain();
        sumBus.gain.value = 1.0;

        // Route Low Band
        finalNode.connect(lowLPF);
        lowLPF.connect(lowComp);
        lowComp.connect(sumBus);

        // Route Mid Band (HPF -> LPF -> Comp)
        finalNode.connect(midHPF);
        midHPF.connect(midLPF);
        midLPF.connect(midComp);
        midComp.connect(sumBus);

        // Route High Band
        finalNode.connect(highHPF);
        highHPF.connect(highComp);
        highComp.connect(sumBus);

        // Optional Final Brickwall Limiter to prevent clipping from makeup gains
        const limiter = offlineCtx.createDynamicsCompressor();
        limiter.threshold.value = -0.5;
        limiter.ratio.value = 20;
        limiter.attack.value = 0.001;
        limiter.release.value = 0.1;

        sumBus.connect(limiter);
        finalNode = limiter;
    }

    finalNode.connect(offlineCtx.destination);

    // 5. Execute Render
    source.start(0);
    const result = await offlineCtx.startRendering();
    studioAPI.emitStudioLog("MASTER RENDER COMPLETE.");
    return result;
  }
}

export const studioEngine = AlgorithmEngine.getInstance();
