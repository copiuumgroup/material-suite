import React, { useState, useEffect } from 'react';
import { useAudioEngine } from './useAudioEngine';
import VaultView from './views/VaultView';
import StudioView from './views/StudioView';
import YTDLPView from './views/YTDLPView';
import SidebarRail from './components/SidebarRail';
import { SettingsModal } from './components/SettingsModal';
import type { ViewType } from './components/SidebarRail';
import { db, type ProjectMetadata, type ImpulseData } from './db/database';
import type { Track } from './types';
import { studioEngine, type StudioEffectParams } from './services/engine/AlgorithmEngine';
import { AnimatePresence, motion } from 'framer-motion';
import MatrixBackground from './components/MatrixBackground';
import FloatingPlayer from './components/FloatingPlayer';
import { cn, generateId } from './utils';
import { getAudioContext, resumeAudioContext } from './services/engine/audioContext';
import { useToaster } from './components/Toaster';
import { useExporter } from './useExporter';

declare global {
  interface Window {
    electronAPI?: {
      getMusicPath: () => Promise<string>;
      getMetadata: (path: string) => Promise<{ title?: string; artist?: string; album?: string; coverArt?: string } | null>;
      saveFile: (fileName: string, buffer: ArrayBuffer) => Promise<string>;
      selectDownloadDirectory: () => Promise<string | null>;
      ytdlpDownload: (url: string, options?: { quality?: 'mp3' | 'wav'; mode?: 'audio' | 'video'; destinationPath?: string }) => Promise<{ success: boolean; error?: string }>;
      ytdlpGetInfo: (url: string) => Promise<{ success: boolean; info?: any; infos?: any[]; error?: string }>;
      ytdlpCancel: () => Promise<boolean>;
      openMusicFolder: () => Promise<boolean>;
      openAppDataFolder: () => Promise<boolean>;
      checkSystemBinary: () => Promise<{ ytdlp: boolean; ffmpeg: boolean; dotnet: boolean }>;
      purgeArchives: () => Promise<boolean>;
      getEngineMetrics: () => Promise<{ electron: string; chrome: string; node: string; v8: string }>;
      readFile: (path: string) => Promise<ArrayBuffer | null>;
      cacheAudioFile: (sourcePath: string | null, fileName: string, buffer?: ArrayBuffer) => Promise<string | null>;
      extractAudio: (path: string) => Promise<ArrayBuffer | null>;
      onYtdlpLog: (callback: (data: string) => void) => () => void;
      updateTitleBarOverlay: (settings: { color: string; symbolColor: string; height?: number }) => Promise<boolean>;
    };
  }
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('studio-theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  const [uiMode, setUiMode] = useState<'material' | 'metro'>(() => {
    const saved = localStorage.getItem('ui-mode');
    return (saved as 'material' | 'metro') || 'material';
  });

  useEffect(() => {
    localStorage.setItem('ui-mode', uiMode);
    // Add or remove metro class on body for global CSS overrides
    if (uiMode === 'metro') {
        document.body.classList.add('metro-mode');
    } else {
        document.body.classList.remove('metro-mode');
    }
  }, [uiMode]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [limiterSettings, setLimiterSettings] = useState({
    threshold: -3.0,
    ratio: 12,
    attack: 0.003,
    release: 0.25
  });

  // Sync Limiter Settings to Effects
  useEffect(() => {
    setEffects(prev => ({ ...prev, limiter: limiterSettings }));
  }, [limiterSettings]);

  useEffect(() => {
    localStorage.setItem('studio-theme', theme);
    document.documentElement.className = theme;
  }, [theme]);

  const [currentView, setCurrentView] = useState<ViewType>('vault');
  const [isPlayerDismissed, setIsPlayerDismissed] = useState(false);
  const { exportAudio } = useExporter();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);

  const activeTrack = tracks.find((t: Track) => t.id === activeTrackId) || null;

  const [effects, setEffects] = useState<StudioEffectParams>({
    speed: 1.0,
    reverbWet: 0,
    isNightcore: false,
    isVocalReduced: false,
    quality: 'fast',
    isAutoEQEnabled: false,
    customIRBuffer: null
  });

  // Sync Title Bar to Theme/Mode
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.updateTitleBarOverlay({
        color: '#00000000',
        symbolColor: theme === 'dark' ? '#ffffff' : '#000000',
        height: 38
      });
    }
  }, [theme, uiMode]);

  // Sync Analysis to Effects
  useEffect(() => {
    if (activeTrack?.analysis) {
        setEffects(prev => ({ ...prev, analysis: activeTrack.analysis }));
    }
  }, [activeTrackId, tracks]);

  const [impulses, setImpulses] = useState<ImpulseData[]>([]);

  // Load Impulses from DB
  useEffect(() => {
    const loadImpulses = async () => {
        const data = await db.impulses.toArray();
        setImpulses(data);
    };
    loadImpulses();
  }, []);

  const { toast } = useToaster();

  const {
    isPlaying,
    setIsPlaying,
    currentTime,
    duration,
    seekTo,
    analyser
  } = useAudioEngine(activeTrack?.buffer || null, effects);

  const audioCtx = getAudioContext();

  useEffect(() => {
    document.body.classList.add('is-windows');
  }, []);

  // Optimized Background Decoding
  useEffect(() => {
    tracks.forEach(async (track: Track) => {
      if (track.isReady || track.buffer || track.file.size === 0) return;
      
      try {
        await resumeAudioContext();
        const arrayBuffer = await track.file.arrayBuffer();
        let decodedBuffer: AudioBuffer;

        try {
          decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        } catch (err) {
          const filePath = (track.file as any).path;
          if (window.electronAPI && filePath) {
            const nativeBuffer = await window.electronAPI.extractAudio(filePath);
            if (nativeBuffer) {
              decodedBuffer = await audioCtx.decodeAudioData(nativeBuffer);
            } else {
              throw new Error('Native extraction failed');
            }
          } else {
            throw err;
          }
        }

        setTracks((prev: Track[]) => prev.map((t: Track) =>
          t.id === track.id ? { ...t, buffer: decodedBuffer, isReady: true } : t
        ));
        toast(`Ready: ${track.file.name}`, 'success');
      } catch (err: any) {
        console.error(`Decoding Error [${track.file.name}]:`, err);
        toast(`Failed to load ${track.file.name}`, 'error');
      }
    });
  }, [tracks, audioCtx]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const newTracks: Track[] = newFiles.map((file: File) => ({
        id: generateId(),
        file,
        buffer: null,
        isReady: false
      }));
      setTracks((prev: Track[]) => [...prev, ...newTracks]);
      setActiveTrackId(newTracks[0].id);

      newTracks.forEach(async (track: Track) => {
        if (window.electronAPI) {
          const path = (track.file as any).path;
          if (path) {
            const meta = await window.electronAPI.getMetadata(path);
            if (meta) setTracks((prev: Track[]) => prev.map((t: Track) => t.id === track.id ? { ...t, metadata: meta } : t));
            const internalPath = await window.electronAPI.cacheAudioFile(path, track.file.name);
            if (internalPath) setTracks((prev: Track[]) => prev.map((t: Track) => t.id === track.id ? { ...t, internalPath } : t));
          }
        }
      });
      // Automatically switch to studio view when uploading
      setCurrentView('studio');
      setIsPlayerDismissed(false);
      resumeAudioContext();
    }
  };

  const handleIRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        const file = e.target.files[0];
        try {
            const arrayBuffer = await file.arrayBuffer();
            const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
            
            const impulse: ImpulseData = {
                name: file.name,
                data: arrayBuffer,
                duration: decoded.duration,
                addedAt: Date.now()
            };
            
            const id = await db.impulses.add(impulse);
            impulse.id = id as number;
            setImpulses(prev => [...prev, impulse]);
            setEffects(prev => ({ ...prev, customIRBuffer: decoded, irId: impulse.id }));
            toast(`Impulse Loaded: ${file.name}`, 'success');
        } catch (err) {
            console.error('IR Load Error:', err);
            toast('Failed to load IR (.wav only)', 'error');
        }
    }
  };

  const selectImpulse = async (id: number | null) => {
    if (id === null) {
        setEffects(prev => ({ ...prev, customIRBuffer: null, irId: undefined }));
        return;
    }
    const impulse = impulses.find(i => i.id === id);
    if (impulse) {
        const decoded = await audioCtx.decodeAudioData(impulse.data.slice(0));
        setEffects(prev => ({ ...prev, customIRBuffer: decoded, irId: impulse.id }));
    }
  };

  const openProject = async (project: ProjectMetadata) => {
    let projectFile = new File([""], project.name, { type: "audio/mpeg" });
    let needsRelink = false;
    if (window.electronAPI && project.filePath) {
      const buffer = await window.electronAPI.readFile(project.filePath);
      if (buffer) {
        projectFile = new File([buffer], project.name, { type: "audio/mpeg" });
        (projectFile as any).path = project.filePath;
      } else {
        needsRelink = true;
      }
    } else {
      needsRelink = true;
    }

    const loadedTrack: Track = {
      id: generateId(),
      file: projectFile,
      buffer: null,
      isReady: false,
      needsRelink,
      metadata: {
        title: project.name,
        artist: project.artist,
        coverArt: project.coverArt
      }
    };
    setTracks([loadedTrack]);
    setActiveTrackId(loadedTrack.id);
    setCurrentView('studio');
    setIsPlayerDismissed(false);
    resumeAudioContext();
  };

  const handleExport = async () => {
    if (!activeTrack || !activeTrack.buffer) return;
    
    try {
      // Phase 1: Offline Mastering
      const masteredBuffer = await studioEngine.renderMaster(activeTrack.buffer, effects);
      
      // Phase 2: Encode to 320kbps MP3
      const blob = await exportAudio(masteredBuffer, 'mp3', '320', activeTrack.file.name);
      
      if (blob && window.electronAPI) {
        const arrayBuffer = await blob.arrayBuffer();
        await window.electronAPI.saveFile(activeTrack.file.name, arrayBuffer);
        toast(`Exported: ${activeTrack.file.name}`, 'success');
      }
    } catch (error) {
      console.error('Export Failed:', error);
      toast('Export Failed', 'error');
    }
  };

  return (
    <div className={cn(
        "w-full h-screen overflow-hidden flex transition-all duration-1000 is-windows bg-[var(--color-surface)]",
        uiMode === 'metro' ? 'metro-mode' : ''
    )}>
      <div className="fixed top-0 left-0 w-[calc(100%-144px)] h-[38px] title-bar-drag z-[100]" />
      
      <SidebarRail 
        currentView={currentView} 
        setView={setCurrentView} 
        theme={theme}
        setTheme={setTheme}
        uiMode={uiMode}
        setUiMode={setUiMode}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        uiMode={uiMode}
        setUiMode={setUiMode}
        limiter={limiterSettings}
        setLimiter={setLimiterSettings}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[var(--color-surface)]">
        <div className="flex-1 flex flex-col relative z-20 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={uiMode === 'metro' ? { x: 50, opacity: 0 } : { opacity: 0, scale: 0.98 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={uiMode === 'metro' ? { x: -50, opacity: 0 } : { opacity: 0, scale: 0.98 }}
              transition={uiMode === 'metro' ? { duration: 0.15, ease: [0.1, 0.9, 0.2, 1] } : { duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className="flex-1 flex flex-col min-h-0"
            >
          {currentView === 'vault' && (
            <VaultView 
              key="vault"
              onUpload={handleFileUpload} 
              onOpenProject={openProject} 
              onDeleteProject={async (id) => await db.projects.delete(id)} 
              uiMode={uiMode}
            />
          )}
          {currentView === 'studio' && (
            <StudioView 
              key="studio"
              track={activeTrack}
              isPlaying={isPlaying}
              setIsPlaying={setIsPlaying}
              currentTime={currentTime}
              duration={duration}
              seekTo={seekTo}
              analyser={analyser}
              effects={effects}
              setEffects={setEffects}
              onExport={handleExport}
              impulses={impulses}
              onIRUpload={handleIRUpload}
              onIRSelect={selectImpulse}
              onIRDelete={async (id) => {
                  await db.impulses.delete(id);
                  setImpulses(prev => prev.filter(i => i.id !== id));
                  if (effects.irId === id) selectImpulse(null);
              }}
              uiMode={uiMode}
            />
          )}
          {currentView === 'yt-dlp' && (
            <YTDLPView key="yt-dlp" uiMode={uiMode} />
          )}
          </motion.div>
        </AnimatePresence>
        </div>

        {/* Backdrop Matrix */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden pb-16">
            {uiMode !== 'metro' && <MatrixBackground />}
        </div>
      </main>

      {/* Mini Player for non-studio views */}
      <AnimatePresence>
        {activeTrack && activeTrack.isReady && currentView !== 'studio' && !isPlayerDismissed && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-0 left-20 right-0 z-[70]">
             <FloatingPlayer 
               track={activeTrack}
               isPlaying={isPlaying}
               setIsPlaying={setIsPlaying}
               currentTime={currentTime}
               duration={duration}
               seekTo={seekTo}
               analyser={analyser}
               effects={effects}
               setEffects={setEffects}
               onClose={() => setIsPlayerDismissed(true)}
               onExport={handleExport}
               uiMode={uiMode}
             />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
