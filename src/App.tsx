import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useAudioEngine } from './hooks/useAudioEngine';
const VaultView = lazy(() => import('./views/VaultView'));
const StudioView = lazy(() => import('./views/StudioView'));
const YTDLPView = lazy(() => import('./views/YTDLPView'));
import SidebarRail from './components/SidebarRail';
import { SettingsModal } from './components/SettingsModal';
import { RenderModal, type RenderConfig } from './components/studio/RenderModal';
import type { ViewType } from './components/SidebarRail';
import { db, type ProjectMetadata, type ImpulseData } from './db/database';
import type { Track } from './types';
import { studioEngine, type StudioEffects } from './services/engine/StudioEngine';
import { AnimatePresence, motion } from 'framer-motion';
import MatrixBackground from './components/common/MatrixBackground';
import FloatingPlayer from './components/FloatingPlayer';
import { generateId } from './utils';
import { getAudioContext, resumeAudioContext } from './services/engine/audioContext';
import { useToaster } from './components/Toaster';
import { useExporter } from './hooks/useExporter';
import { useDesignSystem } from './hooks/useDesignSystem';

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
      getEngineMetrics: () => Promise<{ cpuPercent: number; memoryWorkingSetMB: number; memoryPrivateMB: number }>;
      readFile: (path: string) => Promise<ArrayBuffer | null>;
      cacheAudioFile: (sourcePath: string | null, fileName: string, buffer?: ArrayBuffer) => Promise<string | null>;
      extractAudio: (path: string) => Promise<ArrayBuffer | null>;
      onYtdlpLog: (callback: (data: string) => void) => () => void;
      updateTitleBarOverlay: (settings: { color: string; symbolColor: string; height?: number }) => Promise<boolean>;
      getSystemAccent: () => Promise<string>;
      getTempPath: () => Promise<string>;
      studioEngine: {
        command: (cmd: any) => Promise<any>;
        onLog: (callback: (data: string) => void) => () => void;
      };
    };
  }
}

function App() {
  useDesignSystem(); // Asset-First OS-Sync
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('studio-theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRenderModalOpen, setIsRenderModalOpen] = useState(false);
  const [limiterSettings, setLimiterSettings] = useState({
    threshold: -0.5,  // Only catches true digital overs — not a compressor
    ratio: 20,        // 20:1 = true limiting behaviour
    attack: 0.001,    // 1ms fast attack
    release: 0.1      // 100ms release
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
  const { exportAudio, exportVideo, isExporting, progress } = useExporter();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);

  const activeTrack = tracks.find((t: Track) => t.id === activeTrackId) || null;

  const [effects, setEffects] = useState<StudioEffects>({
    speed: 1.0,
    reverbWet: 0,
    saturation: 0,
    stereoWidth: 100,
    tapeWow: 0,
    tapeFlutter: 0,
    vocalPitch: 0,
    vocalTone: 0,
    isAutoEQEnabled: false,
    isMultibandEnabled: false,
    isVocalFocusEnabled: false,
    isNightcore: false,
    isVocalReduced: false,
    isSpatialEnabled: false,
    spatialVocal: { x: 0, y: 0, z: 0 },
    spatialInstrumental: { x: 0, y: 0, z: 0 },
    isGPUAccelerated: false,
    gpuGains: { low: 1.0, mid: 1.0, high: 1.0 },
    limiter: {
      threshold: -1.0,
      ratio: 12,
      attack: 0.003,
      release: 0.25
    },
    irId: undefined,
    reverbRoomSize: 1.0,
    customIRBuffer: null,
  });

  const [hardwareMetrics, setHardwareMetrics] = useState<{ cpuPercent: number; memoryWorkingSetMB: number; memoryPrivateMB: number } | null>(null);

  // Poll Hardware Telemetry (Local only)
  useEffect(() => {
    if (!window.electronAPI) return;
    const interval = setInterval(async () => {
        const stats = await window.electronAPI!.getEngineMetrics();
        setHardwareMetrics(stats);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Sync Title Bar to Theme
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.updateTitleBarOverlay({
        color: theme === 'dark' ? '#000000' : '#ffffff',
        symbolColor: theme === 'dark' ? '#ffffff' : '#000000'
      });
    }
  }, [theme]);

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

  const [stemBuffers, setStemBuffers] = useState<{ vocals: AudioBuffer | null, instrumental: AudioBuffer | null }>({ vocals: null, instrumental: null });

  useEffect(() => {
    const loadStems = async () => {
        if (!activeTrack?.stems || !window.electronAPI) {
            setStemBuffers({ vocals: null, instrumental: null });
            return;
        }
        const ctx = getAudioContext();
        try {
            const results: { vocals: AudioBuffer | null, instrumental: AudioBuffer | null } = { vocals: null, instrumental: null };
            if (activeTrack.stems.vocals) {
                const vocalData = await window.electronAPI.readFile(activeTrack.stems.vocals);
                if (vocalData) results.vocals = await ctx.decodeAudioData(vocalData);
            }
            if (activeTrack.stems.instrumental) {
                const instData = await window.electronAPI.readFile(activeTrack.stems.instrumental);
                if (instData) results.instrumental = await ctx.decodeAudioData(instData);
            }
            setStemBuffers(results);
        } catch (e) {
            console.error('[ENGINE] Stem Decode Failure:', e);
        }
    };
    loadStems();
  }, [activeTrackId, activeTrack?.stems]);

  const { toast } = useToaster();

  const {
    isPlaying,
    setIsPlaying,
    currentTime,
    duration,
    seekTo,
    analyser
  } = useAudioEngine(activeTrack?.buffer || null, effects, stemBuffers);

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

  const handleExportClick = () => setIsRenderModalOpen(true);

  const executeRender = async (config: RenderConfig) => {
    if (!activeTrack || !activeTrack.buffer) return;
    
    try {
      // Phase 1: Smart Filename Generation
      const tags: string[] = [];
      if (effects.speed === 0.8 && effects.reverbWet === 0.4) {
        tags.push("Slowed + Reverb");
      } else if (effects.speed !== 1.0) {
        tags.push(`${Math.round(effects.speed * 100)}% Speed`);
      }
      if (effects.isVocalFocusEnabled) tags.push("Surgical Vocal Focus");
      if (effects.isMultibandEnabled) tags.push("Reference Multiband");
      if (effects.saturation > 10) tags.push("Material Saturation");

      const tagString = tags.length > 0 ? ` (${tags.join(', ')})` : '';
      const baseName = activeTrack.file.name.replace(/\.[^/.]+$/, "");
      const smartFilename = `${baseName}${tagString}`;

      // Phase 2: Offline Audio Mastering
      const masteredBuffer = await studioEngine.renderMaster(activeTrack.buffer, effects);
      
      // Phase 3: Execute Export
      let blob: Blob | null = null;
      let finalFilename = '';
      
      if (config.type === 'audio') {
        blob = await exportAudio(masteredBuffer, config.audioFormat, '320', smartFilename);
        finalFilename = `${smartFilename}.${config.audioFormat}`;
      } else {
        blob = await exportVideo({
          audioBuffer: masteredBuffer,
          filename: smartFilename,
          resolution: config.videoResolution,
          preset: config.videoPreset,
          profile: config.videoProfile,
          coverArtBase64: activeTrack.metadata?.coverArt
        });
        finalFilename = `${smartFilename}.mp4`;
      }
      
      // Phase 4: Save to Disk
      if (blob && window.electronAPI) {
        const arrayBuffer = await blob.arrayBuffer();
        await window.electronAPI.saveFile(finalFilename, arrayBuffer);
        toast(`Exported: ${finalFilename}`, 'success');
      }
    } catch (error) {
      console.error('Export Failed:', error);
      toast('Export Failed', 'error');
    }
  };

  return (
    <div className="w-full h-screen overflow-hidden flex transition-all duration-1000 is-windows bg-[var(--color-surface)]">
      <div className="fixed top-0 left-0 w-[calc(100%-144px)] h-[38px] title-bar-drag z-[100]" />
      
      <SidebarRail 
        currentView={currentView} 
        setView={setCurrentView} 
        theme={theme}
        setTheme={setTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        limiter={limiterSettings}
        setLimiter={setLimiterSettings}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[var(--color-surface)]">
         <div className="flex-1 overflow-hidden relative z-10">
         <AnimatePresence mode="wait">
         <Suspense fallback={
            <div className="flex-1 flex flex-col items-center justify-center opacity-20">
                <div className="w-16 h-1 bg-[var(--color-primary)] animate-pulse" />
                <p className="mt-4 text-[10px] font-black uppercase tracking-[0.5em]">Linking_Chunks...</p>
            </div>
         }>
          <motion.div
            key={currentView}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
            className="w-full h-full flex flex-col"
          >
          {currentView === 'vault' && (
            <VaultView 
              key="vault"
              onUpload={handleFileUpload} 
              onOpenProject={openProject} 
              onDeleteProject={async (id) => await db.projects.delete(id)} 
            />
          )}
          {currentView === 'studio' && activeTrack && (
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
              onExport={handleExportClick}
              impulses={impulses}
              onIRUpload={handleIRUpload}
              onIRSelect={selectImpulse}
              onIRDelete={async (id) => {
                  await db.impulses.delete(id);
                  setImpulses(prev => prev.filter(i => i.id !== id));
                  if (effects.irId === id) selectImpulse(null);
              }}
              hardwareMetrics={hardwareMetrics}
              onEject={() => setActiveTrackId(null)}
              setTracks={setTracks}
            />
          )}
          {currentView === 'yt-dlp' && (
            <YTDLPView key="yt-dlp" />
          )}
          {currentView === 'studio' && activeTrack && (
              <div className="hidden">
                  {/* Telemetry Debug Slot */}
                  {JSON.stringify(hardwareMetrics)}
              </div>
          )}
          </motion.div>
          </Suspense>
        </AnimatePresence>
        </div>

        {/* Backdrop Matrix */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden pb-16">
            <MatrixBackground />
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
               onExport={handleExportClick}
             />
          </motion.div>
        )}
      </AnimatePresence>

      <RenderModal 
        isOpen={isRenderModalOpen}
        onClose={() => setIsRenderModalOpen(false)}
        onRender={executeRender}
      />
      
      {/* Global Exporting Overlay */}
      <AnimatePresence>
        {isExporting && (
           <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center">
               <div className="w-64 h-2 bg-[var(--color-surface)] rounded-full overflow-hidden border border-[var(--color-outline)]">
                   <div className="h-full bg-[var(--color-primary)] transition-all duration-300" style={{ width: `${progress}%` }} />
               </div>
               <span className="mt-4 text-xs font-black uppercase tracking-widest text-[var(--color-primary)]">
                   {progress}% Rendered
               </span>
           </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
