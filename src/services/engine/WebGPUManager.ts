/**
 * Antigravity IDE: WebGPU Manager (Type-Agnostic Edition)
 * Orchestrates GPU-accelerated DSP processing using WGSL compute shaders.
 */
import spectralShader from './shaders/spectral_shaper.wgsl?raw';

export class WebGPUManager {
  private static instance: WebGPUManager;
  private adapter: any = null;
  private device: any = null;
  private pipeline: any = null;
  
  private constructor() {}

  public static getInstance(): WebGPUManager {
    if (!WebGPUManager.instance) {
      WebGPUManager.instance = new WebGPUManager();
    }
    return WebGPUManager.instance;
  }

  public async init() {
    const gpu = (navigator as any).gpu;
    if (!gpu) {
      console.warn("[WEBGPU] Browser does not support WebGPU. Falling back to CPU DSP.");
      return false;
    }

    this.adapter = await gpu.requestAdapter();
    if (!this.adapter) return false;

    this.device = await this.adapter.requestDevice();
    if (!this.device) return false;

    await this.setupPipeline();
    return true;
  }

  private async setupPipeline() {
    if (!this.device) return;

    const shaderModule = this.device.createShaderModule({ code: spectralShader });
    this.pipeline = await this.device.createComputePipelineAsync({
      layout: 'auto',
      compute: { module: shaderModule, entryPoint: 'main' }
    });
  }

  public async process_spectral(input: Float32Array<any>, drive: number, gains: { low: number, mid: number, high: number }): Promise<Float32Array> {
    if (!this.device || !this.pipeline) return input as any;
    const ctx = this.device;
    const GBU = (window as any).GPUBufferUsage;

    const inputBuffer = ctx.createBuffer({
      size: input.byteLength,
      usage: GBU.STORAGE | GBU.COPY_SRC,
      mappedAtCreation: true,
    });
    new Float32Array(inputBuffer.getMappedRange()).set(input);
    inputBuffer.unmap();

    const outputBuffer = ctx.createBuffer({
      size: input.byteLength,
      usage: GBU.STORAGE | GBU.COPY_SRC | GBU.COPY_DST,
    });

    const paramBuffer = ctx.createBuffer({
        size: 20,
        usage: GBU.UNIFORM | GBU.COPY_DST,
    });
    const paramData = new Float32Array([drive, gains.low, gains.mid, gains.high, 44100]);
    ctx.queue.writeBuffer(paramBuffer, 0, paramData);

    const bindGroup = ctx.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: inputBuffer } },
        { binding: 1, resource: { buffer: outputBuffer } },
        { binding: 2, resource: { buffer: paramBuffer } },
      ],
    });

    const commandEncoder = ctx.createCommandEncoder();
    const passEncoder = commandEncoder.beginComputePass();
    passEncoder.setPipeline(this.pipeline);
    passEncoder.setBindGroup(0, bindGroup);
    passEncoder.dispatchWorkgroups(Math.ceil(input.length / 64));
    passEncoder.end();

    const readBuffer = ctx.createBuffer({
        size: input.byteLength,
        usage: GBU.MAP_READ | GBU.COPY_DST,
    });
    commandEncoder.copyBufferToBuffer(outputBuffer, 0, readBuffer, 0, input.byteLength);

    ctx.queue.submit([commandEncoder.finish()]);

    await readBuffer.mapAsync((window as any).GPUMapMode.READ);
    const result = new Float32Array(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();

    // Cleanup
    [inputBuffer, outputBuffer, paramBuffer, readBuffer].forEach(b => b.destroy());

    return result;
  }

  public isReady() { return this.device !== null; }
}

export const webGPUManager = WebGPUManager.getInstance();
