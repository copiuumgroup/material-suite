const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getMusicPath: () => ipcRenderer.invoke('get-music-path'),
  getMetadata: (filePath: string) => ipcRenderer.invoke('get-metadata', filePath),
  saveFile: (fileName: string, arrayBuffer: ArrayBuffer) => 
    ipcRenderer.invoke('save-file', fileName, arrayBuffer),
  cobaltApiCall: (url: string) => ipcRenderer.invoke('cobalt-api-call', url),
  downloadWithMetadata: (url: string, metadata: any) => 
    ipcRenderer.invoke('download-with-metadata', url, metadata),
  ytdlpDownload: (url: string) => ipcRenderer.invoke('ytdlp-download', url),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  cacheAudioFile: (sourcePath: string | null, fileName: string, buffer?: ArrayBuffer) => 
    ipcRenderer.invoke('cache-audio-file', sourcePath, fileName, buffer)
});
