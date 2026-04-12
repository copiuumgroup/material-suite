/**
 * Audio Analyzer Service
 * Handles BPM detection and spectral analysis for local audio buffers.
 */

export interface AnalysisResult {
  bpm: number;
  genreHint: string;
  energyProfile: {
    low: number;
    mid: number;
    high: number;
  };
  suggestedEQ: {
    sub: number;
    bass: number;
    mid: number;
    treble: number;
    air: number;
  };
}

/**
 * Detects BPM using a simple energy-peak detection algorithm.
 */
export async function analyzeAudio(buffer: AudioBuffer): Promise<AnalysisResult> {
  const data = buffer.getChannelData(0); // Use first channel
  const sampleRate = buffer.sampleRate;
  
  // 1. Downsample for faster processing (optional, but good for performance)
  // 2. Filter frequencies (100-150Hz is Usually where the "kick" lives)
  // For simplicity in this first version, we'll use a moving window average
  
  const peaks: number[] = [];
  const threshold = 0.8; // Peak threshold
  const minInterval = sampleRate * 0.3; // Min 0.3s between beats (~200 BPM max)
  
  let lastPeak = 0;
  for (let i = 0; i < data.length; i++) {
    const energy = Math.abs(data[i]);
    if (energy > threshold && (i - lastPeak) > minInterval) {
      peaks.push(i);
      lastPeak = i;
    }
  }
  
  // Calculate average interval between peaks
  let bpm = 0;
  if (peaks.length > 1) {
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    bpm = Math.round((60 * sampleRate) / avgInterval);
  }

  // 3. Spectral Analysis (Simple 3-band energy distribution)
  let low = 0, mid = 0, high = 0;
  const step = Math.floor(data.length / 1000); // Sample 1000 points
  for (let i = 0; i < data.length; i += step) {
    const val = Math.abs(data[i]);
    // This is a VERY crude estimation. In a real scenario, we'd use FFT.
    // For now, we provide the structure for future FFT integration.
    if (i < data.length * 0.2) low += val;
    else if (i < data.length * 0.7) mid += val;
    else high += val;
  }

  // 4. Genre Hinting (Naive)
  let genreHint = 'Generic';
  if (low > mid && low > high) genreHint = 'Bass Heavy (Phonk/EDM)';
  else if (mid > low && mid > high) genreHint = 'Vocal/Acoustic';
  else if (high > low && high > mid) genreHint = 'Bright/Electronic';

  // 5. Suggested EQ (Normalize towards a balanced curve)
  // Target: mid should be roughly the average of low and high for a "flat" commercial mix
  const avgEnergy = (low + mid + high) / 3;
  const suggestedEQ = {
    sub: Math.max(-6, Math.min(6, (avgEnergy - low) * 2)),
    bass: Math.max(-6, Math.min(6, (avgEnergy - low) * 1.5)),
    mid: Math.max(-6, Math.min(6, (avgEnergy - mid) * 1)),
    treble: Math.max(-6, Math.min(6, (avgEnergy - high) * 1.5)),
    air: Math.max(-6, Math.min(6, (avgEnergy - high) * 2)),
  };

  return {
    bpm: bpm || 120,
    genreHint,
    energyProfile: { low, mid, high },
    suggestedEQ
  };
}
