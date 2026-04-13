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
  public async getSpectralDNA(buffer: AudioBuffer) {
    this.emitStudioLog(`Analyzing Spectral DNA for ${buffer.length} samples...`);
    // Placeholder for future AI integration
    return { status: 'ready' };
  }
}

export const studioAPI = MaterialStudioAPI.getInstance();
