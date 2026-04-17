/**
 * Lock-free Single-Producer Single-Consumer (SPSC) Ring Buffer.
 * Uses SharedArrayBuffer and Atomics for zero-copy thread synchronization.
 */
export class RingBuffer {
  private capacity: number;
  private mask: number;
  private header: Int32Array; // [readIndex, writeIndex]
  private data: Float32Array;

  constructor(buffer: SharedArrayBuffer) {
    // Layout: [2 x Int32 (8 bytes)] [Data Float32]
    this.header = new Int32Array(buffer, 0, 2);
    this.data = new Float32Array(buffer, 8);
    this.capacity = this.data.length;
    this.mask = this.capacity - 1;

    // Verify capacity is power of two for bitwise mask performance
    if ((this.capacity & this.mask) !== 0) {
      console.warn("[MEMORY] RingBuffer capacity is not power of two. Performance may be degraded.");
    }
  }

  /**
   * Pushes data into the ring buffer.
   * Only the Producer should call this.
   */
  public push(elements: Float32Array): number {
    const writeIndex = Atomics.load(this.header, 1);
    const readIndex = Atomics.load(this.header, 0);

    const available = this.capacity - (writeIndex - readIndex);
    const toWrite = Math.min(available, elements.length);

    for (let i = 0; i < toWrite; i++) {
        this.data[(writeIndex + i) & this.mask] = elements[i];
    }

    Atomics.store(this.header, 1, writeIndex + toWrite);
    return toWrite;
  }

  /**
   * Pulls data from the ring buffer.
   * Only the Consumer should call this.
   */
  public pop(elements: Float32Array): number {
    const readIndex = Atomics.load(this.header, 0);
    const writeIndex = Atomics.load(this.header, 1);

    const available = writeIndex - readIndex;
    const toRead = Math.min(available, elements.length);

    for (let i = 0; i < toRead; i++) {
        elements[i] = this.data[(readIndex + i) & this.mask];
    }

    Atomics.store(this.header, 0, readIndex + toRead);
    return toRead;
  }

  public getAvailableRead(): number {
    return Atomics.load(this.header, 1) - Atomics.load(this.header, 0);
  }

  public getAvailableWrite(): number {
    return this.capacity - this.getAvailableRead();
  }

  /**
   * Factory method to create a new shared buffer of specified samples.
   */
  public static create(samples: number): SharedArrayBuffer {
    // 8 bytes for header + samples * 4 bytes for Float32
    const size = 8 + (samples * 4);
    return new SharedArrayBuffer(size);
  }
}
