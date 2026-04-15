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
  
  // 1. Low-pass Filter for Beat Detection (Focus on 40-150Hz)
  // We use a simple 1st-order IIR filter for performance
  const filteredData = new Float32Array(data.length);
  const cutoff = 150;
  const rc = 1.0 / (cutoff * 2 * Math.PI);
  const dt = 1.0 / sampleRate;
  const alpha = dt / (rc + dt);
  
  let previous = 0;
  for (let i = 0; i < data.length; i++) {
    filteredData[i] = alpha * Math.abs(data[i]) + (1 - alpha) * previous;
    previous = filteredData[i];
  }
  
  // 2. Peak Detection on Filtered Data
  const peaks: number[] = [];
  const threshold = 0.15; // Lower threshold since we filtered and took absolute
  const minInterval = sampleRate * 0.35; // ~170 BPM max
  
  let lastPeak = 0;
  for (let i = 0; i < filteredData.length; i++) {
    if (filteredData[i] > threshold && (i - lastPeak) > minInterval) {
      peaks.push(i);
      lastPeak = i;
    }
  }
  
  // Calculate average interval between peaks
  let bpm = 0;
  if (peaks.length > 2) {
    const intervals = [];
    for (let i = 1; i < peaks.length; i++) {
      intervals.push(peaks[i] - peaks[i - 1]);
    }
    // Filter out outliers (intervals that are too different from the median)
    const sortedIntervals = [...intervals].sort((a, b) => a - b);
    const medianInterval = sortedIntervals[Math.floor(sortedIntervals.length / 2)];
    const validIntervals = intervals.filter(v => Math.abs(v - medianInterval) < medianInterval * 0.2);
    
    if (validIntervals.length > 0) {
      const avgInterval = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
      bpm = Math.round((60 * sampleRate) / avgInterval);
    }
  }

  // Normalize BPM to common ranges if it's double/half
  if (bpm > 180) bpm /= 2;
  if (bpm < 60 && bpm > 0) bpm *= 2;

  // 3. Spectral Analysis (Crude 3-band)
  let low = 0, mid = 0, high = 0;
  const step = Math.floor(data.length / 2000); 
  for (let i = 0; i < data.length; i += step) {
    const val = Math.abs(data[i]);
    if (i < data.length * 0.15) low += val;
    else if (i < data.length * 0.6) mid += val;
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
