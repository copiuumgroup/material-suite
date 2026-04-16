import { app, BrowserWindow, protocol, net, ipcMain, session, dialog, shell, systemPreferences, type IpcMainInvokeEvent } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import * as mm from 'music-metadata';
import { spawn } from 'child_process';
import os from 'os';

const activeProcesses = new Map<string, any>();
const MAX_BUFFER_SIZE = 512 * 1024 * 1024; // 512MB Limit
let mainWindow: BrowserWindow | null = null;

function isPathSafe(filePath: string) {
  try {
    const musicPath = path.resolve(app.getPath('music'));
    const userDataPath = path.resolve(app.getPath('userData'));
    const resolvedPath = path.resolve(filePath);
    return resolvedPath.startsWith(musicPath) || resolvedPath.startsWith(userDataPath);
  } catch (e) { return false; }
}

function cleanupPartialFiles() {
  const musicPath = app.getPath('music');
  try {
    if (!fs.existsSync(musicPath)) return;
    const files = fs.readdirSync(musicPath);
    files.forEach((file: string) => {
      if (file.endsWith('.part') || file.endsWith('.ytdl')) {
        try { fs.unlinkSync(path.join(musicPath, file)); } catch (e) {}
      }
    });
  } catch (e) {
    console.error('[SYSTEM] Partial Cleanup Error:', e);
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));


protocol.registerSchemesAsPrivileged([
  { scheme: 'studio', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true, stream: true } },
  { scheme: 'media', privileges: { standard: true, secure: true, supportFetchAPI: true, bypassCSP: true, stream: true } }
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
      height: 38,
      color: '#00000000',
      symbolColor: '#ffffff'
    },
    transparent: false,
    backgroundColor: '#000000',
  });

  mainWindow = win;

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
  session.defaultSession.webRequest.onHeadersReceived((details: any, callback: any) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' studio:; " +
          "script-src 'self' " + (process.env.VITE_DEV_SERVER_URL ? "'unsafe-eval' " : "") + "'unsafe-inline' studio: blob:; " +
          "style-src 'self' 'unsafe-inline' studio:; " +
          "font-src 'self' studio:; " +
          "img-src 'self' studio: data: blob:; " +
          "media-src 'self' studio: media: blob: data:; " +
          "connect-src 'self' studio:;"
        ]
      }
    });
  });

  protocol.handle('studio', async (request: Request) => {
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

  protocol.handle('media', async (request: Request) => {
    const rawPath = request.url.replace('media://', '');
    const decodedPath = decodeURIComponent(rawPath);
    const filePath = fileURLToPath('file:///' + decodedPath);
    
    if (!isPathSafe(filePath)) {
      console.warn('[SECURITY] Blocked non-safe media access:', filePath);
      return new Response('Forbidden', { status: 403 });
    }

    try {
      return await net.fetch(`file://${filePath}`);
    } catch (e) {
      return new Response('Not Found', { status: 404 });
    }
  });

  createWindow();
});

// NATIVE HANDLERS
ipcMain.handle('get-system-accent', () => {
  try {
    return systemPreferences.getAccentColor();
  } catch (e) {
    return 'ffffff';
  }
});

ipcMain.handle('get-music-path', () => app.getPath('music'));

ipcMain.handle('update-titlebar-overlay', (_event: IpcMainInvokeEvent, settings: any) => {
  if (mainWindow) {
    mainWindow.setTitleBarOverlay(settings);
    return true;
  }
  return false;
});

ipcMain.handle('get-engine-metrics', async () => {
  const memory = await process.getProcessMemoryInfo();
  const cpu = process.getCPUUsage();
  
  return {
    memoryWorkingSetMB: Math.round(memory.residentSet / 1024),
    memoryPrivateMB: Math.round(memory.private / 1024),
    cpuPercent: Math.round(cpu.percentCPUUsage)
  };
});

ipcMain.handle('extract-audio', async (_event: IpcMainInvokeEvent, filePath: string) => {
  if (!isPathSafe(filePath)) return null;

  return new Promise((resolve) => {
    const args = [
      '-i', filePath,
      '-f', 'wav',
      '-ar', '44100',
      '-ac', '2',
      '-vn',
      'pipe:1'
    ];
    const ff = spawn('ffmpeg', args);
    const jobId = `ffmpeg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
    activeProcesses.set(jobId, ff);

    let chunks: Buffer[] = [];
    let totalSize = 0;
    
    ff.stdout.on('data', (data: Buffer) => {
      totalSize += data.length;
      if (totalSize > MAX_BUFFER_SIZE) {
        console.error('[SECURITY] Memory Limit Exceeded (512MB). Killing extraction.');
        ff.kill();
        resolve(null);
        return;
      }
      chunks.push(data);
    });

    ff.on('close', (code: number) => {
      activeProcesses.delete(jobId);
      if (code === 0 && totalSize <= MAX_BUFFER_SIZE) {
        const fullBuffer = Buffer.concat(chunks);
        resolve(fullBuffer.buffer.slice(fullBuffer.byteOffset, fullBuffer.byteOffset + fullBuffer.byteLength));
      } else {
        resolve(null);
      }
    });

    ff.on('error', () => {
      activeProcesses.delete(jobId);
      resolve(null);
    });
  });
});

ipcMain.handle('get-metadata', async (_event: IpcMainInvokeEvent, filePath: string) => {
  if (!isPathSafe(filePath)) return null;
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


ipcMain.handle('ytdlp-get-info', async (_event: IpcMainInvokeEvent, trackUrl: string) => {
  return new Promise((resolve) => {
    // --flat-playlist gives us metadata without downloading
    const args = ['--dump-json', '--flat-playlist', '--no-warnings', '--', trackUrl];
    const process = spawn('yt-dlp', args);
    let output = '';
    
    process.stdout.on('data', (data: Buffer) => { output += data.toString(); });
    process.on('close', (code: number) => {
      if (code === 0) {
        try {
          // Playlist/Profiles return multiple lines of JSON
          const lines = output.trim().split('\n');
          const results = lines.map(line => {
            try {
              const info = JSON.parse(line);
              return {
                title: info.title || info.display_id || 'Untitled',
                uploader: info.uploader || info.channel || info.uploader_id,
                duration: info.duration || 0,
                thumbnail: info.thumbnail || (info.thumbnails && info.thumbnails[0]?.url),
                webpage_url: info.webpage_url || trackUrl
              };
            } catch (e) { return null; }
          }).filter(Boolean);

          if (results.length > 0) {
            resolve({ success: true, infos: results });
          } else {
            resolve({ success: false, error: 'No valid metadata found in output' });
          }
        } catch (e) { resolve({ success: false, error: 'Corrupt metadata stream' }); }
      } else { resolve({ success: false, error: 'yt-dlp failed to fetch metadata' }); }
    });
    process.on('error', (err: any) => resolve({ success: false, error: err.message }));
  });
});

ipcMain.handle('ytdlp-download', async (event: IpcMainInvokeEvent, trackUrl: string, options: any) => {
  const mode = options?.mode || 'audio';
  const quality = options?.quality || 'mp3';
  const win = BrowserWindow.fromWebContents(event.sender);
  
  // Security Hardening: Ensure destination path is safe
  let musicPath = options?.destinationPath || app.getPath('music');
  if (options?.destinationPath && !isPathSafe(options.destinationPath)) {
    console.warn('[SECURITY] Blocked unsafe download path:', options.destinationPath);
    console.warn('[SECURITY] Redirecting to default music path.');
    musicPath = app.getPath('music');
  }

  return new Promise((resolve) => {
    let args: string[] = [];
    
    if (mode === 'audio') {
      args = [
        '-x', '--audio-format', quality,
        '-o', path.join(musicPath, '%(uploader)s - %(title)s.%(ext)s'),
        '--embed-thumbnail',
        '--add-metadata',
        '--', // End of options
        trackUrl
      ];
      if (quality === 'mp3') {
        args.splice(3, 0, '--audio-quality', '320K'); // Force 320kbps CBR
      }
    } else {
      args = [
        '-f', 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
        '-o', path.join(musicPath, '%(uploader)s - %(title)s.mp4'),
        '--embed-thumbnail',
        '--add-metadata',
        '--', // End of options
        trackUrl
      ];
    }
    
    const process = spawn('yt-dlp', args);
    const jobId = `ytdlp-${trackUrl}-${Date.now()}`; 
    activeProcesses.set(jobId, process);
    
    let errorLog = '';

    process.on('error', (err: any) => {
      activeProcesses.delete(jobId);
      const errMsg = `FATAL: Failed to launch yt-dlp. (${err.message})`;
      win?.webContents.send('ytdlp-log', errMsg);
      resolve({ success: false, error: 'YT-DLP launch failed' });
    });

    const watchdog = setTimeout(() => {
      if (activeProcesses.has(jobId)) {
        process.kill();
        activeProcesses.delete(jobId);
        win?.webContents.send('ytdlp-log', 'ERROR: Process timed out after 5 minutes.');
      }
    }, 5 * 60 * 1000);

    process.stdout.on('data', (data: Buffer) => {
      win?.webContents.send('ytdlp-log', data.toString());
    });

    process.stderr.on('data', (data: Buffer) => {
      const msg = data.toString();
      errorLog += msg;
      win?.webContents.send('ytdlp-log', msg);
    });

    process.on('close', (code: number) => {
      clearTimeout(watchdog);
      activeProcesses.delete(jobId);

      if (code !== 0 && errorLog) {
        try {
          const logDir = app.getPath('userData');
          const logPath = path.join(logDir, 'ytdlp_error_reports.log');
          fs.appendFileSync(logPath, `\n[${new Date().toISOString()}] Failed: ${trackUrl}\n${errorLog}\n${'-'.repeat(40)}\n`);
        } catch (e) {}
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

ipcMain.handle('select-download-directory', async (event: IpcMainInvokeEvent) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Studio Download Destination',
    buttonLabel: 'Select Folder'
  });
  if (canceled) return null;
  return filePaths[0];
});

ipcMain.handle('check-system-binary', async () => {
  const check = (cmd: string, arg = '--version') => new Promise<boolean>((resolve) => {
    try {
      const proc = spawn(cmd, [arg]);
      proc.on('error', () => resolve(false));
      proc.on('close', (code: number | null) => resolve(code === 0));
    } catch (e) { resolve(false); }
  });

  const ytdlp = await check('yt-dlp');
  const ffmpeg = await check('ffmpeg', '-version');
  const dotnet = await check('dotnet', '--list-runtimes');
  return { ytdlp, ffmpeg, dotnet };
});

ipcMain.handle('purge-archives', async () => {
  try {
    const archivesPath = path.join(app.getPath('userData'), 'archives');
    if (fs.existsSync(archivesPath)) {
      fs.rmSync(archivesPath, { recursive: true, force: true });
      fs.mkdirSync(archivesPath);
    }
    return true;
  } catch (e) {
    console.error('[SYSTEM] Purge Failed:', e);
    return false;
  }
});

ipcMain.handle('ytdlp-cancel', () => {
  console.log(`[SYSTEM] Killing ${activeProcesses.size} active yt-dlp processes...`);
  activeProcesses.forEach((proc) => proc.kill());
  activeProcesses.clear();
  cleanupPartialFiles();
  return true;
});

ipcMain.handle('open-appdata-folder', async () => {
  const userDataPath = app.getPath('userData');
  shell.openPath(userDataPath);
  return true;
});

ipcMain.handle('read-file', async (_event: IpcMainInvokeEvent, filePath: string) => {
  if (!isPathSafe(filePath)) return null;
  try {
    if (!fs.existsSync(filePath)) return null;
    return fs.readFileSync(filePath);
  } catch (e: any) {
    return null;
  }
});

ipcMain.handle('cache-audio-file', async (_event: IpcMainInvokeEvent, sourcePath: string | null, fileName: string, buffer?: any) => {
  try {
    const archivesPath = path.join(app.getPath('userData'), 'archives');
    if (!fs.existsSync(archivesPath)) fs.mkdirSync(archivesPath, { recursive: true });
    
    let fileSize = 0;
    if (sourcePath && fs.existsSync(sourcePath)) {
      fileSize = fs.statSync(sourcePath).size;
    } else if (buffer) {
      fileSize = buffer.byteLength;
    }

    const safeName = fileName.replace(/[\\/:*?"<>|]/g, '');
    const vaultName = `${fileSize}-${safeName}`;
    const targetPath = path.join(archivesPath, vaultName);

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
    return null;
  }
});

ipcMain.handle('save-file', async (event: IpcMainInvokeEvent, fileName: string, arrayBuffer: any) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  const { filePath, canceled } = await dialog.showSaveDialog(win as BrowserWindow, {
    title: 'Export Mastered Audio',
    defaultPath: path.join(app.getPath('music'), fileName),
    filters: [
      { name: 'Audio Files', extensions: fileName.toLowerCase().endsWith('.mp3') ? ['mp3'] : ['wav'] }
    ],
    buttonLabel: 'Export Master',
    properties: ['createDirectory', 'showOverwriteConfirmation']
  });

  if (canceled || !filePath) return null;

  try {
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    return filePath;
  } catch (e) {
    return null;
  }
});

app.on('window-all-closed', () => { app.quit(); });

app.on('will-quit', () => {
  activeProcesses.forEach((proc) => proc.kill());
  activeProcesses.clear();
  cleanupPartialFiles();
});
