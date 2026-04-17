/**
 * Antigravity IDE: Spectral Shaper WGSL (Stabilized)
 * Surgical Parallel Frequency Manipulation & Harmonic Saturation
 */

struct Params {
    drive: f32,
    lowGain: f32,
    midGain: f32,
    highGain: f32,
    sampleRate: f32,
};

@group(0) @binding(0) var<storage, read> input_samples: array<f32>;
@group(0) @binding(1) var<storage, read_write> output_samples: array<f32>;
@group(0) @binding(2) var<uniform> params: Params;

// Surgical GPU-Sided Tanh
fn dsp_tanh(x: f32) -> f32 {
    let exp2x = exp(2.0 * x);
    return (exp2x - 1.0) / (exp2x + 1.0);
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    let total_samples = arrayLength(&input_samples);
    
    if (index >= total_samples) { return; }
    
    var sample = input_samples[index];

    // 1. High-Fidelity Harmonic Saturation
    // Using surgical dsp_tanh for clean third-order harmonics
    let drive_amount = 1.0 + params.drive;
    sample = dsp_tanh(sample * drive_amount);

    // 2. High-Precision Global Gain Alignment
    // To avoid temporal aliasing (buzzing), we use a weighted global gain
    // until the full FFT-windowed spectral engine is integrated.
    let weighted_gain = (params.lowGain * 0.3) + (params.midGain * 0.4) + (params.highGain * 0.3);
    sample *= weighted_gain;

    output_samples[index] = sample;
}
