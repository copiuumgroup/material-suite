import { app, BrowserWindow, protocol, net, ipcMain, session, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as mm from 'music-metadata';
import axios from 'axios';
import NodeID3 from 'node-id3';
import { spawn } from 'child_process';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COBALT_MIRRORS = [
  'https://api.cobalt.tools',
  'https://cobalt.meowing.de',
  'https://api.vxtwitter.com', // Sometimes redirects to cobalt
  'https://cobalt.instavideo.io'
];

protocol.registerSchemesAsPrivileged([
  { scheme: 'studio', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true, stream: true } }
]);

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#ffffff',
      height: 32
    },
    transparent: true,
    backgroundColor: '#00000000',
  });

  const osRelease = os.release().split('.');
  if (parseInt(osRelease[0]) >= 10 && parseInt(osRelease[2]) >= 22000) {
    win.setBackgroundMaterial('mica');
  } else {
    win.setBackgroundMaterial('acrylic');
  }

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadURL('studio://app/index.html');
  }

  win.once('ready-to-show', () => {
    win.maximize();
    win.show();
  });
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' studio:; " +
          "script-src 'self' 'unsafe-eval' 'unsafe-inline' studio: blob:; " +
          "style-src 'self' 'unsafe-inline' studio: https://fonts.googleapis.com; " +
          "font-src 'self' studio: https://fonts.gstatic.com; " +
          "img-src 'self' studio: data: blob: *; " +
          "media-src 'self' studio: blob: data: *; " +
          "connect-src 'self' studio: *;"
        ]
      }
    });
  });

  protocol.handle('studio', async (request) => {
    const url = request.url.replace('studio://app/', '');
    const filePath = path.join(__dirname, '../dist', url);
    try {
      const response = await net.fetch(`file://${filePath}`);
      const headers = new Headers(response.headers);
      headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      headers.set('Access-Control-Allow-Origin', '*');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
    } catch (e) {
      return new Response('Not Found', { status: 404 });
    }
  });

  createWindow();
});

// NATIVE HANDLERS
ipcMain.handle('get-music-path', () => app.getPath('music'));

ipcMain.handle('get-metadata', async (_event, filePath) => {
  try {
    const metadata = await mm.parseFile(filePath);
    const picture = metadata.common.picture?.[0];
    let coverArtDataUrl = '';
    if (picture) {
      coverArtDataUrl = `data:${picture.format};base64,${Buffer.from(picture.data).toString('base64')}`;
    }
    return { title: metadata.common.title, artist: metadata.common.artist, coverArt: coverArtDataUrl };
  } catch (e) { return null; }
});

ipcMain.handle('cobalt-api-call', async (_event, trackUrl) => {
  let lastError = '';

  for (const instance of COBALT_MIRRORS) {
    try {
      console.log(`Trying Cobalt Mirror: ${instance}`);
      const response = await axios.post(`${instance}/api/json`, {
        url: trackUrl,
        audioFormat: 'mp3',
        audioBitrate: '320',
        filenameStyle: 'basic'
      }, {
        timeout: 8000,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Origin': instance,
          'Referer': instance + '/'
        }
      });

      if (response.data?.url) return { success: true, url: response.data.url, mirror: instance };
      lastError = 'No download URL returned from this mirror';
    } catch (e: any) {
      lastError = e.response?.data?.text || e.message;
      if (lastError.includes('turnstile')) {
        console.warn(`Mirror ${instance} blocked by Turnstile. Cycling...`);
      } else {
        console.warn(`Mirror ${instance} failed: ${lastError}`);
      }
      continue; // Try next mirror
    }
  }

  return { success: false, error: `All Cobalt mirrors failed. Last error: ${lastError}` };
});

ipcMain.handle('ytdlp-download', async (_event, trackUrl) => {
  const musicPath = app.getPath('music');
  return new Promise((resolve) => {
    const process = spawn('yt-dlp', [
      '-x', '--audio-format', 'mp3',
      '--audio-quality', '320K',
      '-o', path.join(musicPath, '%(uploader)s - %(title)s.%(ext)s'),
      '--embed-thumbnail',
      '--add-metadata',
      trackUrl
    ]);

    let errorOutput = '';
    process.stderr.on('data', (data) => { errorOutput += data.toString(); });

    process.on('close', (code) => {
      if (code === 0) resolve({ success: true });
      else resolve({ success: false, error: errorOutput || 'yt-dlp failed' });
    });
  });
});

ipcMain.handle('download-with-metadata', async (_event, url, metadata) => {
  const musicPath = app.getPath('music');
  const safeTitle = (metadata.title || 'Unknown').replace(/[\\/:*?"<>|]/g, '');
  const safeArtist = (metadata.artist || 'Unknown').replace(/[\\/:*?"<>|]/g, '');
  const fileName = `${safeArtist} - ${safeTitle}.mp3`;
  const filePath = path.join(musicPath, fileName);

  try {
    const response = await axios({ url, method: 'GET', responseType: 'arraybuffer' });
    let buffer = Buffer.from(response.data);

    // Tagging
    const tags: any = {
      title: metadata.title,
      artist: metadata.artist,
      album: metadata.album
    };

    if (metadata.coverArtUrl) {
      const imgRes = await axios({ url: metadata.coverArtUrl, method: 'GET', responseType: 'arraybuffer' });
      tags.image = {
        mime: 'image/jpeg',
        type: { id: 3, name: 'front cover' },
        description: 'Cover Art',
        imageBuffer: Buffer.from(imgRes.data)
      };
    }

    const success = NodeID3.write(tags, buffer);
    if (success) buffer = success;

    fs.writeFileSync(filePath, buffer);
    return { success: true, path: filePath };
  } catch (e: any) {
    console.error('Download Error:', e);
    return { success: false, error: e.message };
  }
});

ipcMain.handle('read-file', async (_event, filePath) => {
  try {
    console.log(`[IPC] Reading Vaulted File: ${filePath}`);
    if (!fs.existsSync(filePath)) {
      console.error(`[IPC] File Not Found: ${filePath}`);
      return null;
    }
    return fs.readFileSync(filePath);
  } catch (e: any) {
    console.error(`[IPC] Read Error: ${e.message}`);
    return null;
  }
});

ipcMain.handle('cache-audio-file', async (_event, sourcePath, fileName, buffer?) => {
  try {
    const archivesPath = path.join(app.getPath('userData'), 'archives');
    if (!fs.existsSync(archivesPath)) fs.mkdirSync(archivesPath, { recursive: true });
    
    // Check source size for unique naming if from disk
    let fileSize = 0;
    if (sourcePath && fs.existsSync(sourcePath)) {
      fileSize = fs.statSync(sourcePath).size;
    } else if (buffer) {
      fileSize = buffer.byteLength;
    }

    const safeName = fileName.replace(/[\\/:*?"<>|]/g, '');
    const vaultName = `${fileSize}-${safeName}`;
    const targetPath = path.join(archivesPath, vaultName);

    // Idempotency check: if file already vaulted, don't copy again
    if (fs.existsSync(targetPath)) return targetPath;

    if (buffer) {
      fs.writeFileSync(targetPath, Buffer.from(buffer));
    } else if (sourcePath) {
      fs.copyFileSync(sourcePath, targetPath);
    } else {
      return null;
    }
    
    return targetPath;
  } catch (e) {
    console.error('Cache Audio Error:', e);
    return null;
  }
});

ipcMain.handle('save-file', async (event, fileName, arrayBuffer) => {
  console.log(`[IPC] save-file requested for: ${fileName}`);
  const sender = event.sender;
  const win = BrowserWindow.fromWebContents(sender);

  const { filePath, canceled } = await dialog.showSaveDialog(win as BrowserWindow, {
    title: 'Export Mastered Audio',
    defaultPath: path.join(app.getPath('music'), fileName),
    filters: [
      { name: 'Audio Files', extensions: fileName.toLowerCase().endsWith('.mp3') ? ['mp3'] : ['wav'] }
    ],
    buttonLabel: 'Export Master',
    properties: ['createDirectory', 'showOverwriteConfirmation']
  });

  if (canceled || !filePath) {
    console.log('[IPC] Save dialog canceled');
    return null;
  }

  try {
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    console.log(`[IPC] Successfully saved master to: ${filePath}`);
    return filePath;
  } catch (e) {
    console.error(`[IPC] Failed to save file at ${filePath}:`, e);
    return null;
  }
});

app.on('window-all-closed', () => { app.quit(); });
