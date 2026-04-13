import React, { useState, useEffect } from 'react';
import { useAudioEngine } from './useAudioEngine';
import VaultView from './views/VaultView';
import StudioView from './views/StudioView';
import TransmissionView from './views/TransmissionView';
import SidebarRail from './components/SidebarRail';
import type { ViewType } from './components/SidebarRail';
import { db } from './db/database';
import type { ProjectMetadata } from './db/database';
import type { Track } from './types';
import { studioEngine } from './services/engine/AlgorithmEngine';
import type { StudioEffectParams } from './services/engine/AlgorithmEngine';
import { AnimatePresence, motion } from 'framer-motion';
import MatrixBackground from './components/MatrixBackground';
import FloatingPlayer from './components/FloatingPlayer';
import { useExporter } from './useExporter';

declare global {
  interface Window {
    electronAPI?: {
      getMusicPath: () => Promise<string>;
      getMetadata: (path: string) => Promise<{ title?: string; artist?: string; album?: string; coverArt?: string } | null>;
      saveFile: (fileName: string, buffer: ArrayBuffer) => Promise<string>;
      selectDownloadDirectory: () => Promise<string | null>;
      ytdlpDownload: (url: string, options?: { quality?: 'mp3' | 'wav'; mode?: 'audio' | 'video'; destinationPath?: string }) => Promise<{ success: boolean; error?: string }>;
      ytdlpGetInfo: (url: string) => Promise<{ success: boolean; info?: any; error?: string }>;
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
    };
  }
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('studio-theme');
    return (saved as 'light' | 'dark') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  });

  useEffect(() => {
    localStorage.setItem('studio-theme', theme);
    document.documentElement.className = theme;
  }, [theme]);

  const [currentView, setCurrentView] = useState<ViewType>('vault');
  const { exportAudio } = useExporter();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);

  const activeTrack = tracks.find((t: Track) => t.id === activeTrackId) || null;

  const [effects, setEffects] = useState<StudioEffectParams>({
    speed: 1.0,
    reverbWet: 0,
    isNightcore: false,
    isVocalReduced: false
  });

  const {
    isPlaying,
    setIsPlaying,
    currentTime,
    duration,
    seekTo,
    audioCtx,
    analyser
  } = useAudioEngine(activeTrack?.buffer || null, effects);

  useEffect(() => {
    document.body.classList.add('is-windows');
  }, []);

  useEffect(() => {
    if (!audioCtx) return;
    tracks.forEach(async (track: Track) => {
      if (track.isReady || track.buffer || track.file.size === 0) return;
      try {
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
      } catch (err: any) {
        console.error('Decoding Error:', err);
      }
    });
  }, [tracks, audioCtx]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const newTracks: Track[] = newFiles.map((file: File) => ({
        id: Math.random().toString(36).substring(2, 9),
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
      id: Math.random().toString(36).substring(2, 9),
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
      }
    } catch (error) {
      console.error('Export Failed:', error);
    }
  };

  return (
    <div className={cn("w-full h-screen overflow-hidden flex transition-all duration-1000 is-windows bg-[var(--color-surface)]")}>
      <div className="fixed top-0 left-0 w-full h-8 title-bar-drag z-[100] pointer-events-none" />
      
      <SidebarRail 
        currentView={currentView} 
        setView={setCurrentView} 
        onOpenAppData={async () => {
          if (window.electronAPI) await window.electronAPI.openAppDataFolder();
        }}
        theme={theme}
        setTheme={setTheme}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-[var(--color-surface)]">
        <div className="flex-1 flex flex-col relative z-20 overflow-hidden">
          <AnimatePresence mode="wait">
          {currentView === 'vault' && (
            <VaultView 
              key="vault"
              onUpload={handleFileUpload} 
              onOpenProject={openProject} 
              onDeleteProject={async (id) => await db.projects.delete(id)} 
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
            />
          )}
          {currentView === 'transmission' && (
            <TransmissionView key="transmission" />
          )}
        </AnimatePresence>
        </div>

        {/* Backdrop Matrix */}
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden pb-16">
            <MatrixBackground />
        </div>
      </main>

      {/* Mini Player for non-studio views */}
      <AnimatePresence>
        {activeTrack && activeTrack.isReady && currentView !== 'studio' && (
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
             />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}

export default App;
