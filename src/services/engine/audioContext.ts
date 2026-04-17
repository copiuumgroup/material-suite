/**
 * Singleton AudioContext provider
 */

class AudioContextManager {
  private static instance: AudioContext | null = null;

  public static getInstance(): AudioContext {
    if (!this.instance) {
      this.instance = new (window.AudioContext || (window as any).webkitAudioContext)({
        latencyHint: 'playback', // Stable buffer for standard Windows drivers
        sampleRate: 44100, // Standardize sample rate
      });
    }
    return this.instance;
  }

  /**
   * Resumes the context if it's suspended.
   * Browsers require user interaction to start the AudioContext.
   */
  public static async resume(): Promise<void> {
    const ctx = this.getInstance();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  }
}

export const getAudioContext = () => AudioContextManager.getInstance();
export const resumeAudioContext = () => AudioContextManager.resume();
