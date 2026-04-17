import type { Stems } from '../../types';

class StemEngineService {
  private isProcessing = false;
  private stems: Stems | null = null;

  async separateStems(filePath: string): Promise<Stems | null> {
    if (this.isProcessing) return null;
    this.isProcessing = true;

    try {
      const response = await (window as any).electronAPI.studioEngine.command({
        command: 'separate',
        path: filePath
      });

      if (response && response.success) {
        this.stems = response.stems;
        return this.stems;
      } else {
        throw new Error(response?.error || 'Unknown Engine Error');
      }
    } catch (e: any) {
      console.error('[STEM ENGINE] Failure:', e);
      throw e;
    } finally {
      this.isProcessing = false;
    }
  }

  async pitchVocals(vocalPath: string, semitones: number): Promise<string | null> {
    try {
      const response = await (window as any).electronAPI.studioEngine.command({
        command: 'pitch',
        path: vocalPath,
        semitones
      });

      if (response && response.success) {
        return response.output;
      }
      return null;
    } catch (e) {
      console.error('[STEM ENGINE] Pitching failed:', e);
      return null;
    }
  }

  getIsProcessing() {
    return this.isProcessing;
  }
}

export const StemEngine = new StemEngineService();
