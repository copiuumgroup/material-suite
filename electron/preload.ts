const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getMusicPath: () => ipcRenderer.invoke('get-music-path'),
  getMetadata: (filePath: string) => ipcRenderer.invoke('get-metadata', filePath),
  saveFile: (fileName: string, arrayBuffer: ArrayBuffer) => 
    ipcRenderer.invoke('save-file', fileName, arrayBuffer),
  ytdlpDownload: (url: string, options?: { quality?: 'mp3' | 'wav' }) => 
    ipcRenderer.invoke('ytdlp-download', url, options),
  ytdlpCancel: () => ipcRenderer.invoke('ytdlp-cancel'),
  openMusicFolder: () => ipcRenderer.invoke('open-music-folder'),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  cacheAudioFile: (sourcePath: string | null, fileName: string, buffer?: ArrayBuffer) => 
    ipcRenderer.invoke('cache-audio-file', sourcePath, fileName, buffer),
  onYtdlpLog: (callback: (data: string) => void) => {
    const listener = (_event: any, data: string) => callback(data);
    ipcRenderer.on('ytdlp-log', listener);
    return () => ipcRenderer.removeListener('ytdlp-log', listener);
  }
});
