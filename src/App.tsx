import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, Play, Pause, Download, Settings2, Music, X, Loader2, ListMusic, Plus, Zap, ShieldCheck, Activity, CheckCircle2, Home, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAudioEngine } from './useAudioEngine';
import type { EQSettings } from './useAudioEngine';
import { useExporter } from './useExporter';
import Waveform from './Waveform';
import StudioVisualizer from './StudioVisualizer';
import HubView from './views/HubView';
import { db } from './db/database';
import type { ProjectMetadata } from './db/database';
import { AnimatePresence, motion } from 'framer-motion';

declare global {
  interface Window {
    electronAPI?: {
      getMusicPath: () => Promise<string>;
      getMetadata: (path: string) => Promise<{ title?: string; artist?: string; album?: string; coverArt?: string } | null>;
      saveFile: (fileName: string, buffer: ArrayBuffer) => Promise<string>;
      ytdlpDownload: (url: string, options?: { quality?: 'mp3' | 'wav' }) => Promise<{ success: boolean; error?: string }>;
      ytdlpCancel: () => Promise<boolean>;
      openMusicFolder: () => Promise<boolean>;
      readFile: (path: string) => Promise<ArrayBuffer | null>;
      cacheAudioFile: (sourcePath: string | null, fileName: string, buffer?: ArrayBuffer) => Promise<string | null>;
      onYtdlpLog: (callback: (data: string) => void) => () => void;
    };
  }
}

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface Track {
  id: string;
  file: File;
  buffer: AudioBuffer | null;
  speed: number;
  reverbWet: number;
  nightcore: boolean;
  isReady: boolean;
  eq: EQSettings;
  attenuation: number;
  limiter: boolean;
  metadata?: {
    title?: string;
    artist?: string;
    coverArt?: string;
  };
  hasError?: boolean;
  errorMsg?: string;
  lastPreset?: string;
  prePresetSettings?: {
    speed: number;
    reverbWet: number;
    eq: EQSettings;
    limiter: boolean;
  };
  needsRelink?: boolean;
  internalPath?: string;
  detectedBpm?: number;
  detectedGenre?: string;
  suggestedEQ?: EQSettings;
  punch: number;
  tail: number;
  isElastic: boolean;
}

function App() {
  const [view, setView] = useState<'hub' | 'studio'>('hub');
  const [studioTab, setStudioTab] = useState<'master' | 'advanced'>('master');
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const isSavingRef = useRef(false);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [activeTrackId, setActiveTrackId] = useState<string | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [exportFormat, setExportFormat] = useState<'mp3' | 'wav'>('mp3');
  const [exportKbps] = useState('320');

  const [musicPath, setMusicPath] = useState<string | null>(null);
  const [showPathReview, setShowPathReview] = useState(false);
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null);

  const activeTrack = tracks.find(t => t.id === activeTrackId) || null;

  const {
    isPlaying,
    setIsPlaying,
    currentTime,
    duration,
    seekTo,
    renderBuffer,
    audioCtx,
    analyser
  } = useAudioEngine(
    activeTrack?.buffer || null,
    activeTrack?.speed || 1.0,
    activeTrack?.reverbWet || 0,
    activeTrack?.eq || { sub: 0, bass: 0, mid: 0, treble: 0, air: 0 },
    activeTrack?.attenuation || 1.0,
    activeTrack?.limiter || false,
    activeTrack?.punch || 0,
    activeTrack?.tail || 0,
    activeTrack?.isElastic || false,
    (bpm: number, genre: string, suggested: any) => {
      updateActiveTrack({ 
        detectedBpm: bpm, 
        detectedGenre: genre,
        suggestedEQ: suggested
      });
    }
  );

  const { exportAudio, isExporting, progress } = useExporter();

  useEffect(() => {
    document.body.classList.add('is-windows');
    if (window.electronAPI) {
      window.electronAPI.getMusicPath().then(path => {
        setMusicPath(path);
        setShowPathReview(true);
      });
    }
  }, []);

  useEffect(() => {
    if (!audioCtx) return;
    tracks.forEach(async (track) => {
      if (track.isReady || track.buffer || track.hasError || track.needsRelink || track.file.size === 0) return;
      try {
        const arrayBuffer = await track.file.arrayBuffer();
        const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        setTracks(prev => prev.map(t =>
          t.id === track.id ? { ...t, buffer: decodedBuffer, isReady: true, hasError: false } : t
        ));
      } catch (e: any) {
        setTracks(prev => prev.map(t =>
          t.id === track.id ? { ...t, hasError: true, errorMsg: e.message } : t
        ));
      }
    });
  }, [tracks, audioCtx]);

  useEffect(() => {
    if (view === 'studio' && activeTrack && !isSavingRef.current) {
      const saveProject = async () => {
        isSavingRef.current = true;
        try {
          const projectData: ProjectMetadata = {
            id: currentProjectId || undefined,
            name: activeTrack.metadata?.title || activeTrack.file.name,
            artist: activeTrack.metadata?.artist,
            coverArt: activeTrack.metadata?.coverArt,
            filePath: activeTrack.internalPath || (activeTrack.file as any).path,
            lastModified: Date.now(),
            settings: {
              speed: activeTrack.speed,
              reverbWet: activeTrack.reverbWet,
              eq: activeTrack.eq,
              attenuation: activeTrack.attenuation,
              limiter: activeTrack.limiter
            },
            detectedBpm: activeTrack.detectedBpm,
            detectedGenre: activeTrack.detectedGenre
          };
          const id = await db.projects.put(projectData);
          if (!currentProjectId) setCurrentProjectId(id as number);
        } finally {
          isSavingRef.current = false;
        }
      };
      const timer = setTimeout(saveProject, 500);
      return () => clearTimeout(timer);
    }
  }, [view, activeTrack?.speed, activeTrack?.eq, activeTrack?.reverbWet, activeTrack?.punch, activeTrack?.tail, activeTrack?.isElastic, activeTrack?.internalPath, currentProjectId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      const newTracks: Track[] = newFiles.map(file => ({
        id: Math.random().toString(36).substring(2, 9),
        file,
        buffer: null,
        speed: 1.0,
        reverbWet: 0.0,
        nightcore: false,
        isReady: false,
        eq: { sub: 0, bass: 0, mid: 0, treble: 0, air: 0 },
        attenuation: 1.0,
        limiter: false,
        punch: 0,
        tail: 0,
        isElastic: false
      }));
      setTracks(prev => [...prev, ...newTracks]);
      if (!activeTrackId) setActiveTrackId(newTracks[0].id);
      setView('studio');

      newTracks.forEach(async (track) => {
        if (window.electronAPI) {
          const path = (track.file as any).path;
          if (path) {
            const meta = await window.electronAPI.getMetadata(path);
            if (meta) setTracks(prev => prev.map(t => t.id === track.id ? { ...t, metadata: meta } : t));
            if (!path.includes('archives')) {
              const internalPath = await window.electronAPI.cacheAudioFile(path, track.file.name);
              if (internalPath) setTracks(prev => prev.map(t => t.id === track.id ? { ...t, internalPath } : t));
            }
          }
        }
      });
    }
  };

  const handleDeleteProject = async (id: number) => {
    await db.projects.delete(id);
    if (currentProjectId === id) {
      setCurrentProjectId(null);
      setTracks([]);
      setActiveTrackId(null);
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
      id: 'legacy-track',
      file: projectFile,
      buffer: null,
      speed: project.settings.speed,
      reverbWet: project.settings.reverbWet,
      nightcore: false,
      isReady: false,
      needsRelink,
      internalPath: project.filePath?.includes('archives') ? project.filePath : undefined,
      eq: project.settings.eq,
      attenuation: project.settings.attenuation,
      limiter: project.settings.limiter,
      punch: (project.settings as any).punch || 0,
      tail: (project.settings as any).tail || 0,
      isElastic: (project.settings as any).isElastic || false,
      metadata: {
        title: project.name,
        artist: project.artist,
        coverArt: project.coverArt
      }
    };
    setTracks([loadedTrack]);
    setActiveTrackId(loadedTrack.id);
    setCurrentProjectId(project.id!);
    setView('studio');
  };

  const updateActiveTrack = (updates: Partial<Track>) => {
    if (!activeTrackId) return;
    setTracks(prev => prev.map(t => t.id === activeTrackId ? { ...t, ...updates } : t));
  };

  const updateEQ = (band: keyof EQSettings, val: number) => {
    if (!activeTrack) return;
    const newEq = { ...activeTrack.eq, [band]: val };
    updateActiveTrack({ eq: newEq });
  };

  const applyPreset = (type: 'slowed' | 'nightcore' | 'quake' | 'crisp') => {
    if (!activeTrack) return;
    if (activeTrack.lastPreset === type && activeTrack.prePresetSettings) {
      updateActiveTrack({ ...activeTrack.prePresetSettings, lastPreset: undefined, prePresetSettings: undefined });
      return;
    }
    const currentSettings = { speed: activeTrack.speed, reverbWet: activeTrack.reverbWet, eq: activeTrack.eq, limiter: activeTrack.limiter };
    switch (type) {
      case 'slowed':
        updateActiveTrack({ speed: 0.78, reverbWet: 0.7, eq: { sub: 6, bass: 4, mid: -1, treble: -3, air: -2 }, nightcore: false, lastPreset: type, prePresetSettings: currentSettings });
        break;
      case 'nightcore':
        updateActiveTrack({ speed: 1.35, reverbWet: 0.1, nightcore: true, lastPreset: type, prePresetSettings: currentSettings });
        break;
      case 'quake':
        updateActiveTrack({ eq: { sub: 10, bass: 6, mid: -2, treble: -4, air: -2 }, limiter: true, lastPreset: type, prePresetSettings: currentSettings });
        break;
      case 'crisp':
        updateActiveTrack({ eq: { sub: -2, bass: 0, mid: 2, treble: 6, air: 8 }, lastPreset: type, prePresetSettings: currentSettings });
        break;
    }
  };

  const handleExport = async () => {
    if (!activeTrack || !activeTrack.buffer) return;
    setIsPlaying(false);
    const resultBuffer = await renderBuffer(activeTrack.buffer, {
      speed: activeTrack.speed,
      reverb: activeTrack.reverbWet,
      eq: activeTrack.eq,
      attenuation: activeTrack.attenuation,
      limiter: activeTrack.limiter
    });
    if (resultBuffer) {
      const blob = await exportAudio(resultBuffer, exportFormat, exportKbps, activeTrack.file.name);
      if (window.electronAPI && blob) {
        const arrayBuffer = await blob.arrayBuffer();
        const extension = exportFormat === 'mp3' ? '.mp3' : '.wav';
        const fileName = activeTrack.file.name.replace(/\.[^/.]+$/, "") + "_mastered" + extension;
        console.log("[App] Requesting save for:", fileName);
        const savedPath = await window.electronAPI.saveFile(fileName, arrayBuffer);
        console.log("[App] Save result:", savedPath);
        
        if (savedPath) {
          setSavedFilePath(savedPath);
          setShowExport(false);
        }
        // If savedPath is null, user canceled, stay on export modal or just stay in studio
      } else {
        setShowExport(false);
      }
    }
  };

  return (
    <div className={cn("w-full max-w-[1700px] mx-auto p-6 h-screen overflow-hidden flex flex-col transition-all duration-1000 is-windows")}>
      <div className="fixed top-0 left-0 w-full h-8 title-bar-drag z-[100] pointer-events-none" />
      <AnimatePresence mode="wait">
        {view === 'hub' ? (
          <HubView onUpload={handleFileUpload} onOpenProject={openProject} onDeleteProject={handleDeleteProject} />
        ) : (
          <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ ease: "easeOut" }} className="flex-1 flex flex-col">
            <div className="transition-all duration-700 flex flex-col items-center mb-6 mt-8">
              {!activeTrackId ? (
                <div className="text-center animate-in fade-in slide-in-from-top-4 duration-700 py-20">
                  <h1 className="text-8xl font-black tracking-tighter text-[var(--color-primary)]">Material Audio</h1>
                  <p className="text-xl text-[var(--color-on-surface-variant)] font-bold opacity-60">Mastering engine with all the popular audio tweaks you need</p>
                </div>
              ) : (
                <div className="w-full flex items-center justify-between px-4">
                  <div className="flex items-center gap-4 opacity-40 hover:opacity-100 transition-all cursor-pointer group title-bar-no-drag" onClick={() => setView('hub')}>
                    <div className="w-10 h-10 rounded-2xl bg-[var(--color-surface-variant)] flex items-center justify-center group-hover:bg-[var(--color-primary)] group-hover:text-[var(--color-on-primary)] transition-all">
                      <Home className="w-5 h-5" />
                    </div>
                    <h1 className="text-xl font-black tracking-tighter uppercase select-none group-hover:translate-x-1 transition-transform">Studio Workspace</h1>
                  </div>
                  <div className="flex items-center gap-3 title-bar-no-drag">
                    <div className="px-4 py-2 bg-[var(--color-surface-variant)] rounded-full border border-[var(--color-outline)] border-opacity-10 shadow-sm flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-[10px] font-black uppercase opacity-60">Live Persistence Active</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className={cn("flex-1 flex gap-8 transition-all duration-500", tracks.length === 0 ? "justify-center" : "flex-row")}>
              {tracks.length > 0 && (
                <div className="w-80 flex flex-col gap-4 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div className="flex items-center justify-between px-2">
                    <h2 className="text-sm font-black uppercase tracking-widest opacity-40 flex items-center gap-2">
                      <ListMusic className="w-4 h-4" /> Multi-Track
                    </h2>
                    <label className="p-2 rounded-full hover:bg-[var(--color-surface-variant)] cursor-pointer transition-colors">
                      <Plus className="w-5 h-5" />
                      <input type="file" accept="audio/*" multiple className="hidden" onChange={handleFileUpload} />
                    </label>
                  </div>
                  <div className="flex flex-col gap-3 overflow-y-auto max-h-[75vh] pr-2 custom-scrollbar">
                    {tracks.map(track => (
                      <div
                        key={track.id}
                        onClick={() => !track.hasError && setActiveTrackId(track.id)}
                        className={cn("p-4 rounded-[32px] cursor-pointer transition-all duration-300 flex items-center gap-4 group relative", track.hasError ? "status-error opacity-80" : activeTrackId === track.id ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-xl scale-[1.02]" : "bg-[var(--color-surface-variant)] hover:bg-[var(--color-surface)] border border-transparent hover:border-[var(--color-outline)]")}
                      >
                        <div className={cn("w-12 h-12 rounded-[20px] flex items-center justify-center shrink-0 transition-all overflow-hidden relative", track.hasError ? "bg-red-500/20" : activeTrackId === track.id ? "bg-[var(--color-on-primary)] rotate-12" : "bg-[var(--color-outline)]")}>
                          {track.metadata?.coverArt ? (
                            <img src={track.metadata.coverArt} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center" style={{ background: track.hasError ? 'transparent' : `linear-gradient(135deg, hsl(${(track.file?.name || 'default').length * 20 % 360}, 70%, 50%), hsl(${((track.file?.name || 'default').length * 20 + 60) % 360}, 70%, 30%))` }}>
                              {track.hasError ? <AlertTriangle className="w-5 h-5 text-red-500" /> : track.isReady ? <Music className={cn("w-5 h-5", activeTrackId === track.id ? "text-[var(--color-primary)]" : "text-[var(--color-surface)]")} /> : <Loader2 className="w-5 h-5 animate-spin" />}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 truncate">
                          <p className="font-bold text-sm truncate">{track.metadata?.title || track.file?.name || 'Unknown Track'}</p>
                          <p className="text-[10px] uppercase font-black opacity-60"> {track.hasError ? (track.errorMsg || 'Decoding Failed') : (track.metadata?.artist || 'Unknown Artist')} </p>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setTracks(prev => prev.filter(t => t.id !== track.id)); if (activeTrackId === track.id) setActiveTrackId(null); }} className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg z-10">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex-1 flex flex-col gap-6">
                {!activeTrackId ? (
                  <label className="my-card w-full max-w-4xl mx-auto flex-[0.8] flex flex-col items-center justify-center border-4 border-dashed border-[var(--color-outline)] border-opacity-20 cursor-pointer hover:bg-[var(--color-surface)] hover:border-[var(--color-primary)] transition-all group active:scale-95 shadow-2xl rounded-[48px]">
                    <UploadCloud className="w-24 h-24 mb-6 text-[var(--color-primary)] group-hover:scale-110 transition-transform" />
                    <span className="text-4xl font-black tracking-tight">Import Studio Session</span>
                    <span className="text-md text-[var(--color-on-surface-variant)] mt-4 opacity-60 font-medium">MP3, WAV, AIFF Support</span>
                    <input type="file" accept="audio/*" multiple className="hidden" onChange={handleFileUpload} />
                  </label>
                ) : (
                  <div className="flex-1 flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-500">
                    <div className="flex flex-col gap-4 relative">
                      <StudioVisualizer analyser={analyser} eq={activeTrack.eq} audioCtx={audioCtx} />
                      <div className="flex items-center justify-between px-4">
                        <div className="flex items-center gap-4">
                          <p className="text-xl font-black tracking-tighter truncate max-w-md">{activeTrack?.file.name}</p>
                          <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
                        </div>
                        <div className="flex gap-4">
                          {activeTrack.detectedBpm && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] rounded-2xl text-[10px] font-black uppercase">
                              <Activity className="w-3 h-3" /> {activeTrack.detectedBpm} BPM
                            </div>
                          )}
                          {activeTrack.detectedGenre && (
                            <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface-variant)] rounded-2xl text-[10px] font-black uppercase opacity-60">
                              <Music className="w-3 h-3" /> {activeTrack.detectedGenre}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col xl:flex-row gap-8 flex-1">
                      <div className="flex-1 flex flex-col gap-6">
                        {activeTrack.needsRelink ? (
                          <div className="my-card flex-1 flex flex-col items-center justify-center p-12 text-center bg-[var(--color-surface-variant)] border-2 border-dashed border-red-500/20">
                            <AlertTriangle className="w-16 h-16 text-red-500 mb-4 opacity-40" />
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Session File Missing</h2>
                            <p className="text-sm opacity-40 mt-2 mb-8 max-w-md">The original audio file loop could not be found. Re-link it to continue.</p>
                            <label className="my-button my-button-primary px-10 py-4 cursor-pointer">
                              Re-link Session
                              <input type="file" accept="audio/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) updateActiveTrack({ file: e.target.files[0], needsRelink: false, isReady: false, hasError: false }); }} />
                            </label>
                          </div>
                        ) : (
                          <div className="my-card bg-[var(--color-surface)] shadow-lg p-6">
                            <Waveform buffer={activeTrack.buffer || null} currentTime={currentTime} duration={duration} onSeek={seekTo} />
                          </div>
                        )}
                        <div className="flex gap-4">
                          <button className={cn("flex-1 my-button py-8 text-3xl font-black shadow-2xl transition-all duration-500 rounded-[32px]", isPlaying ? "bg-[var(--color-on-surface)] text-[var(--color-surface)]" : "my-button-primary")} onClick={() => setIsPlaying(!isPlaying)} disabled={!activeTrack?.isReady}>
                            {isPlaying ? <Pause className="w-10 h-10 fill-current" /> : <Play className="w-10 h-10 fill-current" />} {isPlaying ? 'PAUSE' : 'PLAY'}
                          </button>
                          <button onClick={() => setShowExport(true)} className="p-8 my-button bg-[var(--color-surface-variant)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-primary)] hover:text-[var(--color-on-primary)] transition-all rounded-[32px] shadow-lg group">
                            <Download className="w-10 h-10 group-hover:scale-110 transition-transform" />
                          </button>
                        </div>
                      </div>

                      <div className="xl:w-[420px] flex flex-col gap-6">
                        <div className="flex bg-[var(--color-surface-variant)] p-1 rounded-3xl border border-white/5">
                          <button onClick={() => setStudioTab('master')} className={cn("flex-1 py-3 text-[10px] font-black uppercase rounded-2xl transition-all", studioTab === 'master' ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-lg" : "opacity-40 hover:opacity-100")}>Master Chain</button>
                          <button onClick={() => setStudioTab('advanced')} className={cn("flex-1 py-3 text-[10px] font-black uppercase rounded-2xl transition-all", studioTab === 'advanced' ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-lg" : "opacity-40 hover:opacity-100")}>Advanced DSP</button>
                        </div>

                        <div className="my-card bg-[var(--color-surface-variant)] flex flex-col gap-6 shadow-xl border border-[var(--color-outline)] border-opacity-10">
                          {studioTab === 'master' ? (
                            <>
                              <div className="flex items-center justify-between">
                                <h2 className="text-sm font-black uppercase tracking-widest opacity-40 flex items-center gap-2"><Settings2 className="w-4 h-4" /> Mastering Suite</h2>
                                <div className="flex gap-2">
                                  <button onClick={() => activeTrack.suggestedEQ && updateActiveTrack({ eq: activeTrack.suggestedEQ })} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--color-secondary-container)] text-[var(--color-on-secondary-container)] hover:scale-105 transition-all">
                                    <Activity className="w-4 h-4" /> <span className="text-[10px] font-black uppercase">Auto-Level</span>
                                  </button>
                                  <button onClick={() => updateActiveTrack({ limiter: !activeTrack?.limiter })} className={cn("flex items-center gap-2 px-3 py-2 rounded-xl transition-all", activeTrack?.limiter ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "bg-[var(--color-surface)] opacity-40")}>
                                    <ShieldCheck className="w-4 h-4" /> <span className="text-[10px] font-black uppercase">Safe Limiter</span>
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                {(['slowed', 'nightcore', 'quake', 'crisp'] as const).map(p => (
                                  <button key={p} onClick={() => applyPreset(p)} className={cn("flex items-center gap-2 p-3 rounded-2xl transition-all text-[10px] font-black uppercase", activeTrack?.lastPreset === p ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "bg-[var(--color-surface)] hover:scale-[1.03]")}>
                                    <Zap className={cn("w-3 h-3", activeTrack?.lastPreset === p ? "text-[var(--color-on-primary)]" : "text-[var(--color-primary)] opacity-40")} /> {p}
                                  </button>
                                ))}
                              </div>
                              <div className="space-y-6 bg-black/10 p-6 rounded-[32px] shadow-inner">
                                {(['sub', 'bass', 'mid', 'treble', 'air'] as const).map(band => (
                                  <div key={band} className="flex flex-col">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-[10px] font-black uppercase opacity-60">{band}</span>
                                      <span className="text-[10px] font-black text-[var(--color-primary)]">{(activeTrack?.eq[band] || 0) > 0 ? '+' : ''}{activeTrack?.eq[band].toFixed(1)} dB</span>
                                    </div>
                                    <input type="range" min="-12" max="12" step="0.5" value={activeTrack?.eq[band] || 0} onChange={(e) => updateEQ(band, parseFloat(e.target.value))} className="my-slider-track !h-6" />
                                  </div>
                                ))}
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <p className="text-[10px] font-black uppercase opacity-40 ml-1">Volume</p>
                                  <input type="range" min="0" max="1.5" step="0.05" value={activeTrack?.attenuation || 1.0} onChange={(e) => updateActiveTrack({ attenuation: parseFloat(e.target.value) })} className="my-slider-track" />
                                </div>
                                <div className="space-y-2">
                                  <p className="text-[10px] font-black uppercase opacity-40 ml-1">Spacing</p>
                                  <input type="range" min="0" max="1" step="0.01" value={activeTrack?.reverbWet || 0} onChange={(e) => updateActiveTrack({ reverbWet: parseFloat(e.target.value) })} className="my-slider-track" />
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-right-4 duration-500">
                              <div className="flex items-center justify-between">
                                <h2 className="text-sm font-black uppercase tracking-widest opacity-40">Advanced Signal Logic</h2>
                                <div className="flex items-center gap-3">
                                  <span className="text-[10px] font-black uppercase opacity-40">Elastic Mode</span>
                                  <button onClick={() => updateActiveTrack({ isElastic: !activeTrack?.isElastic })} className={cn("w-12 h-6 rounded-full relative transition-all duration-500 border border-white/10", activeTrack?.isElastic ? "bg-[var(--color-primary)]" : "bg-black/20")}>
                                    <motion.div animate={{ x: activeTrack?.isElastic ? 24 : 2 }} className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-lg" />
                                  </button>
                                </div>
                              </div>
                              <div className="space-y-8">
                                <div className="p-6 bg-black/20 rounded-[32px] border border-white/5">
                                  <div className="flex items-center gap-3 mb-6"><Zap className="w-5 h-5 text-[var(--color-primary)]" /> <h3 className="text-xs font-black uppercase">Transient Shaping</h3></div>
                                  <div className="space-y-6">
                                    {[ ['Punch (Attack)', 'punch'], ['Body (Tail)', 'tail'] ].map(([label, key]) => (
                                      <div key={key} className="flex flex-col gap-2">
                                        <div className="flex justify-between items-center text-[10px] font-black uppercase">
                                          <span className="opacity-40">{label}</span>
                                          <span className="text-[var(--color-primary)]">+{Math.round((activeTrack as any)[key] * 100)}%</span>
                                        </div>
                                        <input type="range" min="-1" max="1" step="0.01" value={(activeTrack as any)[key]} onChange={(e) => updateActiveTrack({ [key]: parseFloat(e.target.value) })} className="my-slider-track" />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="p-6 bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] rounded-[32px] border border-white/10">
                                  <p className="text-[10px] opacity-60 leading-relaxed font-bold">{activeTrack.isElastic ? "Elastic: Phase Vocoder enabled. Preserves pitch." : "Generic: Time domain stretching. Pitch drifts with speed."}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {(showExport || isExporting) && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[var(--color-background)]/90 backdrop-blur-xl animate-in fade-in duration-300">
                <div className="my-card w-full max-w-sm flex flex-col gap-8 shadow-2xl animate-in zoom-in-95 duration-300 border border-[var(--color-outline)] border-opacity-20">
                  <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-black tracking-tighter uppercase">Studio Export</h2>
                    {!isExporting && <button onClick={() => setShowExport(false)} className="p-3 -mr-3 rounded-full hover:bg-[var(--color-surface-variant)]"><X className="w-6 h-6" /></button>}
                  </div>
                  {isExporting ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-8">
                      <div className="relative"><Loader2 className="w-24 h-24 animate-spin text-[var(--color-primary)]" /><div className="absolute inset-0 flex items-center justify-center font-black text-sm">{progress}%</div></div>
                      <div className="text-center truncate w-full"><p className="text-2xl font-black uppercase tracking-widest truncate px-4">{activeTrack?.file.name}</p></div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-8">
                      <div className="flex gap-2 p-2 bg-[var(--color-surface)] rounded-[24px]">
                        {['mp3', 'wav'].map(f => <button key={f} className={cn("flex-1 py-3 px-4 rounded-[18px] font-black uppercase text-xs", exportFormat === f ? "my-button-primary" : "opacity-40")} onClick={() => setExportFormat(f as any)}>{f}</button>)}
                      </div>
                      <button className="my-button render-button w-full py-6 text-xl font-black shadow-2xl" onClick={handleExport}><Download className="w-6 h-6" /> RENDER MASTER</button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <DesktopModals showPathReview={showPathReview} setShowPathReview={setShowPathReview} musicPath={musicPath} savedFilePath={savedFilePath} setSavedFilePath={setSavedFilePath} />
    </div>
  );
}

function DesktopModals({ showPathReview, setShowPathReview, musicPath, savedFilePath, setSavedFilePath }: any) {
  return (
    <>
      {showPathReview && !savedFilePath && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="my-card w-full max-w-md flex flex-col gap-6 shadow-2xl border border-white/10 p-8 text-center items-center">
            <Music className="w-12 h-12 text-[var(--color-primary)]" />
            <h2 className="text-2xl font-black tracking-tighter uppercase">System Link Active</h2>
            <p className="text-sm opacity-60">Mastered tracks will be saved directly to your music folder:</p>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 font-mono text-[10px] break-all opacity-80">{musicPath}</div>
            <button onClick={() => setShowPathReview(false)} className="my-button my-button-primary w-full py-4 font-black uppercase tracking-widest">Confirm Link</button>
          </div>
        </div>
      )}
      {savedFilePath && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in zoom-in-95 duration-500">
          <div className="my-card w-full max-w-md flex flex-col items-center gap-6 shadow-[0_0_100px_rgba(255,255,255,0.1)] border border-white/20 p-10 text-center">
            <CheckCircle2 className="w-20 h-20 text-[var(--color-primary)] mb-2" />
            <h2 className="text-3xl font-black tracking-tighter uppercase">Master Rendered</h2>
            <p className="text-sm opacity-60">Your high-fidelity master has been saved successfully:</p>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 font-mono text-[10px] break-all opacity-40 w-full">
              {savedFilePath}
            </div>
            <button onClick={() => setSavedFilePath(null)} className="my-button my-button-primary w-full py-4 font-black uppercase">Continue Studio</button>
          </div>
        </div>
      )}
    </>
  );
}

export default function Root() {
  return <App />;
}
