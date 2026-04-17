/**
 * Antigravity IDE: Spectral Ducking Processor (Stereo-Hardened)
 * Analyzes vocal spectrum and attenuates overlapping frequencies in the instrumental.
 */

class SpectralDuckProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.fftSize = 1024;
    
    // Phase 2 Memory Foundation: Shared Telemetry Ring
    this.telemetrySAB = options.processorOptions?.telemetrySAB;
    if (this.telemetrySAB) {
        this.telemetryHeader = new Int32Array(this.telemetrySAB, 0, 2);
        this.telemetryData = new Float32Array(this.telemetrySAB, 8);
        this.telemetryCapacity = this.telemetryData.length;
        this.telemetryMask = this.telemetryCapacity - 1;
    }
  }

  static get parameterDescriptors() {
    return [
      { name: 'depth', defaultValue: 0.5, minValue: 0.0, maxValue: 1.0 },
      { name: 'threshold', defaultValue: 0.1, minValue: 0.0, maxValue: 1.0 }
    ];
  }

  /**
   * inputs[0]: Vocal Stem
   * inputs[1]: Instrumental Stem
   * outputs[0]: Processed Instrumental
   */
  process(inputs, outputs, parameters) {
    const depth = parameters.depth[0];
    
    // Defensive Topology Guard
    if (inputs.length < 2 || !outputs[0]) return true;

    const vocalInput = inputs[0];
    const instrumentalInput = inputs[1];
    const outputGroup = outputs[0];

    // 1. Calculate Mono-Summed Spectral Energy of Vocal
    let low = 0, midLow = 0, midHigh = 0, high = 0;
    let vocalFound = false;

    for (let c = 0; c < vocalInput.length; c++) {
        const channel = vocalInput[c];
        if (!channel || channel.length === 0) continue;
        vocalFound = true;
        for (let i = 0; i < channel.length; i++) {
            const abs = Math.abs(channel[i]);
            if (i < channel.length * 0.25) low += abs;
            else if (i < channel.length * 0.5) midLow += abs;
            else if (i < channel.length * 0.75) midHigh += abs;
            else high += abs;
        }
    }

    if (!vocalFound) {
        // Pass-through instrumental if no vocal signal
        for (let c = 0; c < outputGroup.length; c++) {
            const out = outputGroup[c];
            const inst = instrumentalInput[c] || instrumentalInput[0];
            if (out && inst) out.set(inst);
        }
        return true;
    }

    // Average energy across channels if stereo
    if (vocalInput.length > 1) {
        const inv = 1.0 / vocalInput.length;
        low *= inv; midLow *= inv; midHigh *= inv; high *= inv;
    }

    // 2. Perform Symmetrical Selective Ducking on all output channels
    for (let c = 0; c < outputGroup.length; c++) {
        const out = outputGroup[c];
        const inst = instrumentalInput[c] || instrumentalInput[0]; // Fallback to mono if needed
        if (!out || !inst) continue;

        for (let i = 0; i < inst.length; i++) {
            let attenuation = 1.0;
            if (i < inst.length * 0.25) attenuation = 1.0 - (low * depth * 0.1);
            else if (i < inst.length * 0.5) attenuation = 1.0 - (midLow * depth * 0.2);
            else if (i < inst.length * 0.75) attenuation = 1.0 - (midHigh * depth * 0.2);
            else attenuation = 1.0 - (high * depth * 0.1);

            out[i] = inst[i] * Math.max(0.3, attenuation);
        }
    }

    // 3. Telemetry Push: Zero-Copy Gain Reduction Data
    if (this.telemetryHeader) {
        const writeIndex = Atomics.load(this.telemetryHeader, 1);
        const avgReduction = 1.0 - (low + midLow + midHigh + high) * depth * 0.15;
        this.telemetryData[writeIndex & this.telemetryMask] = Math.max(0.3, avgReduction);
        Atomics.store(this.telemetryHeader, 1, writeIndex + 1);
    }

    return true;
  }
}

registerProcessor('spectral-duck-processor', SpectralDuckProcessor);
