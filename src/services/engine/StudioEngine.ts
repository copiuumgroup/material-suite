import { studioAPI } from './MaterialStudioAPI';
import { RingBuffer } from './RingBuffer';
import { webGPUManager } from './WebGPUManager';
import { getAudioContext } from './audioContext'; // Shared singleton — prevents dual-context IR bugs

export interface StudioEffects {
  speed: number;
  reverbWet: number;
  saturation: number;
  stereoWidth: number;
  tapeWow: number;
  tapeFlutter: number;
  vocalPitch: number;
  vocalTone: number;
  isAutoEQEnabled: boolean;
  isMultibandEnabled: boolean;
  isVocalFocusEnabled: boolean;
  isNightcore: boolean; // Legacy but used for tagging/UI
  isVocalReduced: boolean; // Legacy but used for UI state
  irId?: number; // DB persistence
  
  // Phase 7: Spatial Audio (3D Matrix)
  isSpatialEnabled: boolean;
  spatialVocal: { x: number; y: number; z: number };
  spatialInstrumental: { x: number; y: number; z: number };

  // Phase 5/8: GPU Acceleration (Final Frontier)
  isGPUAccelerated: boolean;
  gpuGains?: { low: number; mid: number; high: number };

  limiter?: {
    threshold: number;
    ratio: number;
    attack: number;
    release: number;
  };
  reverbRoomSize?: number;
  customIRBuffer?: AudioBuffer | null;
  analysis?: any;
}

class StudioEngine {
  private static instance: StudioEngine;
  private ctx: AudioContext | null = null;
  private isWorkletReady = false;
  private lastSaturation: number = -1;

  // Shared Memory Pool (Phase 2)
  private telemetrySAB: SharedArrayBuffer | null = null;
  private telemetryRing: RingBuffer | null = null;

  // Persistent Graph Nodes
  private mainIn: GainNode | null = null;
  private mainOut: GainNode | null = null;
  private spectralDuck: AudioWorkletNode | null = null;
  
  private saturationNode: WaveShaperNode | null = null;
  private limiterNode: DynamicsCompressorNode | null = null;
  
  // Mid/Side Matrix
  private msSplitter: ChannelSplitterNode | null = null;
  private sideInverter: GainNode | null = null;
  private msMerger: ChannelMergerNode | null = null;
  private midGain: GainNode | null = null;
  private sideGain: GainNode | null = null;

  // Tape FX Chain
  private wowFlutterGain: GainNode | null = null;
  private tapeLFO: OscillatorNode | null = null;
  private tapeDelay: DelayNode | null = null;

  // Reverb Parallel Path
  private reverbNode: ConvolverNode | null = null;
  private reverbWet: GainNode | null = null;
  private dryPath: GainNode | null = null;

  // Phase 7: Spatial Panners
  private vocalPanner: PannerNode | null = null;
  private instrumentalPanner: PannerNode | null = null;
  
  // Analyser for UI
  private analyser: AnalyserNode | null = null;

  // Playback
  private source: AudioBufferSourceNode | null = null;
  private vocalSource: AudioBufferSourceNode | null = null;
  private instrumentalSource: AudioBufferSourceNode | null = null;
  private activeBuffer: AudioBuffer | null = null;
  private stems: { vocals: AudioBuffer | null, instrumental: AudioBuffer | null } | null = null;

  private constructor() {
    this.initContext();
  }

  public static getInstance(): StudioEngine {
    if (!StudioEngine.instance) {
      StudioEngine.instance = new StudioEngine();
    }
    return StudioEngine.instance;
  }

  private async initContext() {
    if (this.ctx) return;
    this.ctx = getAudioContext(); // Use shared singleton — same context for decoding and playback
    
    try {
        // Initialize Phase 2 Memory Foundation
        this.telemetrySAB = RingBuffer.create(512); // Sample window for peak/FFT
        this.telemetryRing = new RingBuffer(this.telemetrySAB);

        await this.ctx.audioWorklet.addModule('/worklets/granular-processor.js');
        await this.ctx.audioWorklet.addModule('/worklets/spectral-duck-processor.js');
        this.isWorkletReady = true;

        // Final Frontier: WebGPU Handshake
        const gpuActive = await webGPUManager.init();
        if (gpuActive) {
            studioAPI.emitStudioLog("[ENGINE] WebGPU Final Frontier Engaged.");
        }

        studioAPI.emitStudioLog("[ENGINE] Memory Foundation (SAB Ring) Operational.");
    } catch (e) {
        console.error("[ENGINE] Critical Error: Worklet Load Failure", e);
    }
    this.buildFullGraph();
    // Initialize reverb with a default mathematical IR so Reverb Wet works
    // immediately without requiring a custom IR file to be loaded first.
    this.createReverbBuffer(1.5, 5).then(buf => {
        if (this.reverbNode) this.reverbNode.buffer = buf;
    });
  }

  private buildFullGraph() {
      if (!this.ctx) return;
      const ctx = this.ctx;

      this.mainIn = ctx.createGain();
      this.mainOut = ctx.createGain();
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      
      // Direct, phase-neutral signal path.
      // Crossover is de-activated by default to eliminate phase coloring at unity.
      this.mainIn.connect(this.mainOut);

      // 2. Mid/Side Matrix (Stereo Width)
      // Single, clean node creation — no duplicates
      this.msSplitter = ctx.createChannelSplitter(2);
      this.msMerger = ctx.createChannelMerger(2);
      this.midGain = ctx.createGain();
      this.sideGain = ctx.createGain();
      this.sideInverter = ctx.createGain();
      this.sideInverter.gain.value = -1.0;

      this.mainOut.connect(this.msSplitter);

      // Encode: Mid = L + R, Side = L - R
      this.msSplitter.connect(this.midGain, 0); // L → mid
      this.msSplitter.connect(this.midGain, 1); // R → mid  (Web Audio sums: L+R)
      this.msSplitter.connect(this.sideGain, 0); // L → side
      this.msSplitter.connect(this.sideInverter, 1); // R → inverter (-R) → side (L-R)
      this.sideInverter.connect(this.sideGain);

      // Decode: SEPARATE scalers for L and R — prevents mono collapse
      // L_out = (Mid + Side) * 0.5 = ((L+R) + (L-R)) * 0.5 = L
      const leftScale = ctx.createGain();
      leftScale.gain.value = 0.5;
      const leftSum = ctx.createGain();
      this.midGain.connect(leftSum);
      this.sideGain.connect(leftSum);
      leftSum.connect(leftScale);
      leftScale.connect(this.msMerger, 0, 0);

      // R_out = (Mid - Side) * 0.5 = ((L+R) - (L-R)) * 0.5 = R
      const rightScale = ctx.createGain();
      rightScale.gain.value = 0.5;
      const sideNeg = ctx.createGain();
      sideNeg.gain.value = -1.0;
      this.sideGain.connect(sideNeg);
      const rightSum = ctx.createGain();
      this.midGain.connect(rightSum);
      sideNeg.connect(rightSum);
      rightSum.connect(rightScale);
      rightScale.connect(this.msMerger, 0, 1);

      // 3. Effect Chain: Tape -> Saturation -> Limiter
      this.tapeDelay = ctx.createDelay(0.1);
      this.tapeLFO = ctx.createOscillator();
      this.wowFlutterGain = ctx.createGain();
      this.tapeLFO.frequency.value = 5; // 5Hz wow
      this.wowFlutterGain.gain.value = 0; // Start bypassed — frequency=0 causes DC offset
      this.tapeLFO.connect(this.wowFlutterGain);
      this.wowFlutterGain.connect(this.tapeDelay.delayTime);
      this.tapeLFO.start();

      this.saturationNode = ctx.createWaveShaper();
      this.saturationNode.oversample = '4x'; // Better quality when active
      // curve is null by default — transparent until saturation > 0

      this.limiterNode = ctx.createDynamicsCompressor();
      // True peak limiter: hard-knee, high-ratio, very high threshold
      // Acts only as a safety clipping net — not a compressor
      this.limiterNode.threshold.value = -0.5;  // Only triggers on true overs
      this.limiterNode.knee.value = 0;           // Hard knee — no soft compression below threshold
      this.limiterNode.ratio.value = 20;         // 20:1 = effectively a limiter
      this.limiterNode.attack.value = 0.001;     // 1ms fast attack
      this.limiterNode.release.value = 0.1;      // 100ms release

      this.msMerger.connect(this.tapeDelay);
      this.tapeDelay.connect(this.saturationNode);
      this.saturationNode.connect(this.limiterNode);

      // 4. Parallel Reverb
      this.reverbNode = ctx.createConvolver();
      this.reverbWet = ctx.createGain();
      this.dryPath = ctx.createGain();

      this.limiterNode.connect(this.dryPath);
      this.limiterNode.connect(this.reverbNode);
      this.reverbNode.connect(this.reverbWet);

      // Final Assembly
      const finalOut = ctx.createGain();
      this.dryPath.connect(finalOut);
      this.reverbWet.connect(finalOut);

      // Spatial HRTF panners reserved for future ASIO driver support.
      // Removed from active graph — standard Windows drivers can't fulfil
      // the HRTF model and cause instability.

      finalOut.connect(this.analyser);
      this.analyser.connect(ctx.destination);
      
      studioAPI.emitStudioLog("[ENGINE] Advanced Mastering Matrix Engaged.");
  }

  public async play(offset: number, effects: StudioEffects) {
      if (!this.ctx || !this.activeBuffer) return;
      this.stop();
      this.updateEffects(effects);
      
      const ctx = this.ctx;
      let playbackBuffer = this.activeBuffer;

      // Final Frontier: GPU Pre-Processing
      if (effects.isGPUAccelerated && webGPUManager.isReady()) {
          playbackBuffer = await this.computeGPUEffects(this.activeBuffer, effects);
      }
      
      if (this.stems?.vocals && this.stems?.instrumental && this.isWorkletReady) {
          // ... (Existing stem logic, potentially also GPU accelerated if needed)
          // For now focusing on main buffer GPU acceleration
          this.vocalSource = ctx.createBufferSource();
          this.instrumentalSource = ctx.createBufferSource();
          this.vocalSource.buffer = this.stems.vocals;
          this.instrumentalSource.buffer = this.stems.instrumental;
          
          this.spectralDuck = new AudioWorkletNode(ctx, 'spectral-duck-processor', {
              numberOfInputs: 2,
              numberOfOutputs: 1,
              outputChannelCount: [2],
              processorOptions: { telemetrySAB: this.telemetrySAB }
          });
          
          this.vocalSource.connect(this.spectralDuck, 0, 0);
          this.instrumentalSource.connect(this.spectralDuck, 0, 1);
          
          if (effects.isSpatialEnabled && this.vocalPanner && this.instrumentalPanner) {
              // 💎 Surgical Route: Sources -> Processor/Pannners -> mainIn
              this.vocalSource.connect(this.vocalPanner);
              this.spectralDuck.connect(this.instrumentalPanner);
              
              // Ensure the dry instrumental doesn't leak into the spatial matrix
              this.vocalPanner.connect(this.mainIn!);
              this.instrumentalPanner.connect(this.mainIn!);
          } else {
              // 💎 Surgical Route: SpectralDuck (Instrumental) + vocalSource (Dry)
              this.spectralDuck.connect(this.mainIn!);
              this.vocalSource.connect(this.mainIn!); 
          }
          
          this.vocalSource.playbackRate.value = effects.speed;
          this.instrumentalSource.playbackRate.value = effects.speed;
          
          this.vocalSource.start(0, offset);
          this.instrumentalSource.start(0, offset);
      } else {
          this.source = ctx.createBufferSource();
          this.source.buffer = playbackBuffer;
          this.source.playbackRate.value = effects.speed;
          
          if (effects.isSpatialEnabled && this.instrumentalPanner) {
              this.source.connect(this.instrumentalPanner);
              this.instrumentalPanner.connect(this.mainIn!);
          } else {
              this.source.connect(this.mainIn!);
          }
          this.source.start(0, offset);
      }
  }

  public stop() {
      [this.source, this.vocalSource, this.instrumentalSource].forEach(s => {
          if (s) { s.stop(); s.disconnect(); }
      });
      this.source = this.vocalSource = this.instrumentalSource = null;
      if (this.spectralDuck) { this.spectralDuck.disconnect(); this.spectralDuck = null; }
  }

  public updateEffects(effects: StudioEffects) {
      if (!this.ctx) return;
      const ctx = this.ctx;

      // 0. Real-time Speed/Nightcore Sync (Reactive Pipeline)
      [this.source, this.vocalSource, this.instrumentalSource].forEach(s => {
          if (s && s.playbackRate) {
              s.playbackRate.setTargetAtTime(effects.speed, ctx.currentTime, 0.1);
          }
      });

      // 1. Ducking & Parallel Logic
      if (this.spectralDuck) {
          const depth = effects.isVocalFocusEnabled ? 0.8 : 0.0;
          this.spectralDuck.parameters.get('depth')?.setTargetAtTime(depth, ctx.currentTime, 0.1);
      }

      // 2. Mid/Side Matrix (Stereo Width)
      if (this.midGain && this.sideGain) {
          // If Spatial is enabled, we bypass M/S Width to avoid phase artifacts
          const width = effects.isSpatialEnabled ? 100 : (effects.stereoWidth / 100);
          this.midGain.gain.setTargetAtTime(1, ctx.currentTime, 0.1);
          this.sideGain.gain.setTargetAtTime(width, ctx.currentTime, 0.1);
      }


      // 3. Tape Wow/Flutter
      if (this.wowFlutterGain) {
          const wowAmount = (effects.tapeWow / 100) * 0.002;
          const flutterAmount = (effects.tapeFlutter / 100) * 0.0005;
          const totalAmount = wowAmount + flutterAmount;
          // Drive via gain, not frequency — setting freq=0 produces a DC offset smear
          this.wowFlutterGain.gain.setTargetAtTime(totalAmount, ctx.currentTime, 0.1);
          if (this.tapeLFO && totalAmount > 0) {
              // Set a real frequency only when the effect is active
              const freq = effects.tapeWow > 0 ? 5 : 15;
              this.tapeLFO.frequency.setTargetAtTime(freq, ctx.currentTime, 0.1);
          }
      }

      // 4. Dynamic Saturation — bypass completely at 0 (null curve = transparent pass-through)
      if (this.saturationNode) {
          if (effects.saturation === 0) {
              // Null curve = transparent WaveShaperNode, no distortion, no gain change
              if (this.saturationNode.curve !== null) {
                  this.saturationNode.curve = null;
                  this.lastSaturation = 0;
              }
          } else if (effects.isGPUAccelerated && webGPUManager.isReady()) {
              this.saturationNode.curve = null;
          } else if (this.lastSaturation !== effects.saturation) {
              this.lastSaturation = effects.saturation;
              const drive = effects.saturation / 50;
              const curve = new Float32Array(44100);
              // Headroom Calibration: 1.1 baseline for +2dB safe ceiling
              for (let i = 0; i < 44100; i++) {
                  const x = (i * 2) / 44100 - 1;
                  curve[i] = Math.tanh(x * (1.1 + drive));
              }
              this.saturationNode.curve = curve;
          }
      }

      // 5. Mastering Limiter
      if (this.limiterNode) {
          const settings = effects.limiter || { threshold: -1.0, ratio: 12, attack: 0.003, release: 0.25 };
          this.limiterNode.threshold.setTargetAtTime(settings.threshold, ctx.currentTime, 0.1);
          this.limiterNode.ratio.setTargetAtTime(settings.ratio, ctx.currentTime, 0.1);
          this.limiterNode.attack.setTargetAtTime(settings.attack, ctx.currentTime, 0.1);
          this.limiterNode.release.setTargetAtTime(settings.release, ctx.currentTime, 0.1);
      }

      // 6. Parallel Reverb (with dry-path compensation)
      if (this.reverbWet && this.dryPath) {
          this.reverbWet.gain.setTargetAtTime(effects.reverbWet, ctx.currentTime, 0.1);
          // Compensate dry gain: as wet increases, reduce dry to maintain constant perceived loudness
          const dryGain = 1.0 - (effects.reverbWet * 0.4);
          this.dryPath.gain.setTargetAtTime(dryGain, ctx.currentTime, 0.1);
          
          if (effects.customIRBuffer && this.reverbNode) {
              if (this.reverbNode.buffer !== effects.customIRBuffer) {
                  this.reverbNode.buffer = effects.customIRBuffer;
              }
          }
      }
  }

  public async createReverbBuffer(duration: number, decay: number, roomSizeMultiplier: number = 1.0): Promise<AudioBuffer> {
    if (!this.ctx) throw new Error("AudioContext not initialized");
    const effectiveDuration = duration * roomSizeMultiplier;
    const impulse = this.ctx.createBuffer(2, this.ctx.sampleRate * effectiveDuration, this.ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const data = impulse.getChannelData(c);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, decay);
      }
    }
    return impulse;
  }

  public setBuffers(main: AudioBuffer | null, stems?: { vocals: AudioBuffer | null, instrumental: AudioBuffer | null }) {
      this.activeBuffer = main;
      this.stems = stems || null;
  }

  public getTelemetrySAB() { return this.telemetrySAB; }
  
  /**
   * Phase 2: Zero-Copy Telemetry Read
   * Allows the UI to pull current ducking/reduction levels without postMessage.
   */
  public getReductionTelemetry(): number {
    if (!this.telemetryRing) return 1.0;
    const items = new Float32Array(1);
    const count = this.telemetryRing.pop(items);
    return count > 0 ? items[0] : 1.0;
  }

  public getContext() { return this.ctx; }
  public getAnalyser() { return this.analyser; }

  /**
   * Phase 5/8: Surgical GPU Processing Loop (Final Frontier)
   */
  public async computeGPUEffects(buffer: AudioBuffer, effects: StudioEffects): Promise<AudioBuffer> {
    if (!this.ctx) return buffer;
    const output = this.ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    
    for (let c = 0; c < buffer.numberOfChannels; c++) {
        const inputData = buffer.getChannelData(c);
        const processed = await webGPUManager.process_spectral(
            inputData as any, 
            effects.saturation, 
            effects.gpuGains || { low: 1, mid: 1, high: 1 }
        );
        output.copyToChannel(processed as any, c);
    }
    
    return output;
  }

  /**
   * High-Performance Offline Master Render
   * Applies the full DSP Protocol graph to a buffer at processing speed.
   */
  public async renderMaster(buffer: AudioBuffer, effects: StudioEffects): Promise<AudioBuffer> {
    studioAPI.emitStudioLog(`[RENDER] Master Mastering Chain Engaged: ${effects.speed}x speed...`);
    
    const offlineCtx = new OfflineAudioContext(
        buffer.numberOfChannels, 
        (buffer.length / (effects.speed || 1)), 
        buffer.sampleRate
    );
    
    const source = offlineCtx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = effects.speed || 1.0;

    const mainIn = offlineCtx.createGain();
    const mainOut = offlineCtx.createGain();
    
    // Direct, phase-neutral path (mirrors the live engine bypass)
    mainIn.connect(mainOut);

    // 2. Mid/Side
    const msSplitter = offlineCtx.createChannelSplitter(2);
    const msMerger = offlineCtx.createChannelMerger(2);
    const midGain = offlineCtx.createGain();
    const sideGain = offlineCtx.createGain();
    const sideInverter = offlineCtx.createGain();
    sideInverter.gain.value = -1.0;
    
    const width = effects.stereoWidth / 100;
    midGain.gain.value = 1.0;
    sideGain.gain.value = width;

    mainOut.connect(msSplitter);
    
    // Mid = (L + R) * 0.5
    msSplitter.connect(midGain, 0);
    msSplitter.connect(midGain, 1);
    
    // Side = (L - R) * 0.5
    msSplitter.connect(sideGain, 0);
    msSplitter.connect(sideInverter, 1);
    sideInverter.connect(sideGain);

    // Decode: SEPARATE scalers for L and R — prevents mono collapse in offline master
    // L_out = (Mid + Side) * 0.5 = ((L+R) + (L-R)) * 0.5 = L
    const leftScale = offlineCtx.createGain();
    leftScale.gain.value = 0.5;
    const leftSum = offlineCtx.createGain();
    midGain.connect(leftSum);
    sideGain.connect(leftSum);
    leftSum.connect(leftScale);
    leftScale.connect(msMerger, 0, 0);

    // R_out = (Mid - Side) * 0.5 = ((L+R) - (L-R)) * 0.5 = R
    const rightScale = offlineCtx.createGain();
    rightScale.gain.value = 0.5;
    const sideNeg = offlineCtx.createGain();
    sideNeg.gain.value = -1.0;
    sideGain.connect(sideNeg);
    const rightSum = offlineCtx.createGain();
    midGain.connect(rightSum);
    sideNeg.connect(rightSum);
    rightSum.connect(rightScale);
    rightScale.connect(msMerger, 0, 1);

    // 3. Tape & Saturation (Bypass LFO for offline)
    const saturation = offlineCtx.createWaveShaper();
    if (effects.saturation > 0) {
        const drive = effects.saturation / 50;
        const curve = new Float32Array(44100);
        for (let i = 0; i < 44100; i++) {
            const x = (i * 2) / 44100 - 1;
            curve[i] = Math.tanh(x * (1 + drive));
        }
        saturation.curve = curve;
    }

    const limiter = offlineCtx.createDynamicsCompressor();
    const settings = effects.limiter || { threshold: -1.0, ratio: 12, attack: 0.003, release: 0.25 };
    limiter.threshold.value = settings.threshold;
    limiter.ratio.value = settings.ratio;
    limiter.attack.value = settings.attack;
    limiter.release.value = settings.release;

    // Connect Primary Chain
    msMerger.connect(saturation);
    saturation.connect(limiter);

    // 4. Parallel Reverb
    const reverbNode = offlineCtx.createConvolver();
    const reverbWet = offlineCtx.createGain();
    const dryPath = offlineCtx.createGain();
    
    reverbWet.gain.value = effects.reverbWet;
    dryPath.gain.value = 1.0;

    if (effects.customIRBuffer) {
        reverbNode.buffer = effects.customIRBuffer;
    }

    // 5. Phase 7: Spatial Matrix (Offline)
    let spatialOut: GainNode | null = null;
    if (effects.isSpatialEnabled) {
        const vPanner = offlineCtx.createPanner();
        const iPanner = offlineCtx.createPanner();
        [vPanner, iPanner].forEach(p => {
            p.panningModel = 'HRTF';
            p.positionX.value = p === vPanner ? effects.spatialVocal.x : effects.spatialInstrumental.x;
            p.positionY.value = p === vPanner ? effects.spatialVocal.y : effects.spatialInstrumental.y;
            p.positionZ.value = p === vPanner ? effects.spatialVocal.z : effects.spatialInstrumental.z;
        });

        spatialOut = offlineCtx.createGain();
        // This is a simplified offline routing for the demo/protocol
        source.connect(vPanner);
        vPanner.connect(spatialOut);
        
        // Connect to the chain
        spatialOut.connect(mainIn);
    } else {
        source.connect(mainIn);
    }

    limiter.connect(dryPath);
    limiter.connect(reverbNode);
    reverbNode.connect(reverbWet);

    const finalOut = offlineCtx.createGain();
    dryPath.connect(finalOut);
    reverbWet.connect(finalOut);
    finalOut.connect(offlineCtx.destination);

    source.start(0);
    return await offlineCtx.startRendering();
  }
}

export const studioEngine = StudioEngine.getInstance();
