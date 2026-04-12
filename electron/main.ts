import { app, BrowserWindow, protocol, net, ipcMain, session, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as mm from 'music-metadata';
import { spawn } from 'child_process';
import os from 'os';

const activeProcesses = new Map<string, any>();

const __dirname = path.dirname(fileURLToPath(import.meta.url));


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
          "style-src 'self' 'unsafe-inline' studio:; " +
          "font-src 'self' studio:; " +
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


ipcMain.handle('ytdlp-download', async (event, trackUrl, options) => {
  const quality = options?.quality || 'mp3';
  const musicPath = app.getPath('music');
  const win = BrowserWindow.fromWebContents(event.sender);

  return new Promise((resolve) => {
    const args = [
      '-x', '--audio-format', quality,
      '-o', path.join(musicPath, '%(uploader)s - %(title)s.%(ext)s'),
      '--embed-thumbnail',
      '--add-metadata',
      trackUrl
    ];

    if (quality === 'mp3') {
      args.splice(3, 0, '--audio-quality', '320K');
    }

    const process = spawn('yt-dlp', args);
    let errorLog = '';

    activeProcesses.set(trackUrl, process);

    const watchdog = setTimeout(() => {
      if (activeProcesses.has(trackUrl)) {
        process.kill();
        activeProcesses.delete(trackUrl);
        win?.webContents.send('ytdlp-log', 'ERROR: Process timed out after 5 minutes.');
      }
    }, 5 * 60 * 1000);

    process.stdout.on('data', (data) => {
      win?.webContents.send('ytdlp-log', data.toString());
    });

    process.stderr.on('data', (data) => {
      const msg = data.toString();
      errorLog += msg;
      win?.webContents.send('ytdlp-log', msg);
    });

    process.on('close', (code) => {
      clearTimeout(watchdog);
      activeProcesses.delete(trackUrl);

      if (code !== 0 && errorLog) {
        try {
          const logPath = path.join(musicPath, 'ytdlp_error_reports.log');
          fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] Failed: ${trackUrl}\n${errorLog}\n${'-'.repeat(40)}\n`);
        } catch (e) { console.error('Failed to write error log:', e); }
      }

      if (code === 0) resolve({ success: true });
      else resolve({ success: false, error: 'yt-dlp failed (see log)' });
    });
  });
});

ipcMain.handle('open-music-folder', async () => {
  const musicPath = app.getPath('music');
  shell.openPath(musicPath);
  return true;
});

ipcMain.handle('ytdlp-cancel', () => {
  console.log(`[IPC] Killing ${activeProcesses.size} active yt-dlp processes...`);
  activeProcesses.forEach((proc) => proc.kill());
  activeProcesses.clear();
  return true;
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

app.on('will-quit', () => {
  activeProcesses.forEach((proc) => proc.kill());
  activeProcesses.clear();
});
