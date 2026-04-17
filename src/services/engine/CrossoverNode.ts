/**
 * Linkwitz-Riley crossover matrix for 3-band processing.
 * Uses cascaded BiQuad filters to ensure -6dB at crossover and flat summing.
 */
export class CrossoverMatrix {
  public low: GainNode;
  public mid: GainNode;
  public high: GainNode;

  private lowLP1: BiquadFilterNode;
  private lowLP2: BiquadFilterNode;
  
  private midHP1: BiquadFilterNode;
  private midHP2: BiquadFilterNode;
  private midLP1: BiquadFilterNode;
  private midLP2: BiquadFilterNode;

  private highHP1: BiquadFilterNode;
  private highHP2: BiquadFilterNode;

  constructor(ctx: AudioContext, lowFreq: number = 150, highFreq: number = 2500) {
    // 1. Create Band Outputs
    this.low = ctx.createGain();
    this.mid = ctx.createGain();
    this.high = ctx.createGain();

    // 2. Low Band Initialization (Cascaded LowPass)
    this.lowLP1 = ctx.createBiquadFilter();
    this.lowLP2 = ctx.createBiquadFilter();
    this.lowLP1.type = this.lowLP2.type = 'lowpass';
    this.lowLP1.frequency.value = this.lowLP2.frequency.value = lowFreq;
    this.lowLP1.Q.value = this.lowLP2.Q.value = 0.707; // Butterworth

    // 3. Mid Band Initialization (HP -> LP cascade)
    this.midHP1 = ctx.createBiquadFilter();
    this.midHP2 = ctx.createBiquadFilter();
    this.midLP1 = ctx.createBiquadFilter();
    this.midLP2 = ctx.createBiquadFilter();
    this.midHP1.type = this.midHP2.type = 'highpass';
    this.midLP1.type = this.midLP2.type = 'lowpass';
    this.midHP1.frequency.value = this.midHP2.frequency.value = lowFreq;
    this.midLP1.frequency.value = this.midLP2.frequency.value = highFreq;
    this.midHP1.Q.value = this.midHP2.Q.value = 0.707;
    this.midLP1.Q.value = this.midLP2.Q.value = 0.707;

    // 4. High Band Initialization (Cascaded HighPass)
    this.highHP1 = ctx.createBiquadFilter();
    this.highHP2 = ctx.createBiquadFilter();
    this.highHP1.type = this.highHP2.type = 'highpass';
    this.highHP1.frequency.value = this.highHP2.frequency.value = highFreq;
    this.highHP1.Q.value = this.highHP2.Q.value = 0.707;

    // Internal Connections
    this.lowLP1.connect(this.lowLP2);
    this.lowLP2.connect(this.low);

    this.midHP1.connect(this.midHP2);
    this.midHP2.connect(this.midLP1);
    this.midLP1.connect(this.midLP2);
    this.midLP2.connect(this.mid);

    this.highHP1.connect(this.highHP2);
    this.highHP2.connect(this.high);
  }

  public connect(input: AudioNode) {
    input.connect(this.lowLP1);
    input.connect(this.midHP1);
    input.connect(this.highHP1);
  }

  public updateCrossover(low: number, high: number) {
    this.lowLP1.frequency.setTargetAtTime(low, this.lowLP1.context.currentTime, 0.1);
    this.lowLP2.frequency.setTargetAtTime(low, this.lowLP1.context.currentTime, 0.1);
    this.midHP1.frequency.setTargetAtTime(low, this.lowLP1.context.currentTime, 0.1);
    this.midHP2.frequency.setTargetAtTime(low, this.lowLP1.context.currentTime, 0.1);
    
    this.midLP1.frequency.setTargetAtTime(high, this.lowLP1.context.currentTime, 0.1);
    this.midLP2.frequency.setTargetAtTime(high, this.lowLP1.context.currentTime, 0.1);
    this.highHP1.frequency.setTargetAtTime(high, this.lowLP1.context.currentTime, 0.1);
    this.highHP2.frequency.setTargetAtTime(high, this.lowLP1.context.currentTime, 0.1);
  }

  public disconnect() {
    this.low.disconnect();
    this.mid.disconnect();
    this.high.disconnect();
  }
}
