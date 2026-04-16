type LogCallback = (data: string) => void;

class MaterialStudioAPI {
  private studioLogListeners: Set<LogCallback> = new Set();
  private downloadLogListeners: Set<LogCallback> = new Set();
  private static instance: MaterialStudioAPI;

  private constructor() {
    // Initialize listeners for native bridge
    if (window.electronAPI) {
      window.electronAPI.onYtdlpLog((data) => {
        this.emitDownloadLog(data);
      });
    }
  }

  public static getInstance(): MaterialStudioAPI {
    if (!MaterialStudioAPI.instance) {
      MaterialStudioAPI.instance = new MaterialStudioAPI();
    }
    return MaterialStudioAPI.instance;
  }

  // --- STUDIO CONSOLE ---
  public emitStudioLog(message: string) {
    const timestamp = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const formatted = `[${timestamp}] ${message}`;
    this.studioLogListeners.forEach(cb => cb(formatted));
  }

  public subscribeToStudio(cb: LogCallback) {
    this.studioLogListeners.add(cb);
    return () => this.studioLogListeners.delete(cb);
  }

  // --- DOWNLOAD CONSOLE ---
  public emitDownloadLog(message: string) {
    this.downloadLogListeners.forEach(cb => cb(message));
  }

  public subscribeToDownloads(cb: LogCallback) {
    this.downloadLogListeners.add(cb);
    return () => this.downloadLogListeners.delete(cb);
  }

  // --- ENGINE API ---
  /**
   * Performs real-time spectral analysis for volume monitoring.
   * Calculates RMS (Root Mean Square) for perceptual loudness estimation.
   */
  public async getSpectralDNA(buffer: AudioBuffer) {
    this.emitStudioLog(`Analyzing Spectral DNA for ${buffer.length} samples...`);
    
    const data = buffer.getChannelData(0);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
        sum += data[i] * data[i];
    }
    const rms = Math.sqrt(sum / data.length);
    const db = 20 * Math.log10(rms);
    
    this.emitStudioLog(`Analysis Complete. RMS: ${db.toFixed(2)}dBFS`);

    return { 
        rms, 
        db,
        status: 'ready' 
    };
  }
}

export const studioAPI = MaterialStudioAPI.getInstance();
