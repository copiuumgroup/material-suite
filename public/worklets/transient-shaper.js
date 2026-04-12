/**
 * Transient Shaper Audio Worklet
 * 
 * Logic:
 * Uses two envelope followers (Fast and Slow) to detect transients.
 * Attack = Fast Envelope - Slow Envelope
 * Sustain = Slow Envelope relative to the overall amplitude
 */

class TransientShaperProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'attack', defaultValue: 0, minValue: -1, maxValue: 1 },
      { name: 'sustain', defaultValue: 0, minValue: -1, maxValue: 1 }
    ];
  }

  constructor() {
    super();
    this.envFast = 0;
    this.envSlow = 0;
    
    // Constants for envelope followers
    this.attackAlpha = 0.999;
    this.releaseAlpha = 0.99;
    
    // Attack detection constants
    this.fastAlpha = 0.9;
    this.slowAlpha = 0.999;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const output = outputs[0];
    
    const attackAmount = parameters.attack[0];
    const sustainAmount = parameters.sustain[0];

    for (let channel = 0; channel < input.length; channel++) {
      const inputChannel = input[channel];
      const outputChannel = output[channel];

      for (let i = 0; i < inputChannel.length; i++) {
        const x = Math.abs(inputChannel[i]);

        // Fast envelope (transients)
        this.envFast = this.fastAlpha * this.envFast + (1 - this.fastAlpha) * x;
        // Slow envelope (body)
        this.envSlow = this.slowAlpha * this.envSlow + (1 - this.slowAlpha) * x;

        // The transient is the difference
        const transient = this.envFast - this.envSlow;
        
        // Final gain calculation
        // If attackAmount > 0, boost transients. If sustainAmount > 0, boost body.
        let gain = 1.0;
        gain += transient * attackAmount * 5.0; // Scaled for audible effect
        gain += this.envSlow * sustainAmount * 2.0;

        outputChannel[i] = inputChannel[i] * Math.max(0, gain);
      }
    }
    return true;
  }
}

registerProcessor('transient-shaper-processor', TransientShaperProcessor);
