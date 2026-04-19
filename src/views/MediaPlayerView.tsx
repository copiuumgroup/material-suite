import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, ListMusic, Sparkles, Zap, FolderOpen, Library, SkipBack, SkipForward, Repeat, Shuffle } from 'lucide-react';
import { db, type ProjectMetadata } from '../db/database';
import type { StudioEffects } from '../services/engine/StudioEngine';
import { useLiveEngine } from '../hooks/useLiveEngine';

interface Props {
  effects: StudioEffects;
  setEffects: (effects: StudioEffects) => void;
}

type QueueType = 'vault' | 'local';

interface ActiveFileMetadata {
  title?: string;
  artist?: string;
  coverArt?: string;
}

const MediaPlayerView: React.FC<Props> = ({ effects, setEffects }) => {
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [localFiles, setLocalFiles] = useState<{ file: File; metadata?: ActiveFileMetadata }[]>([]);
  const [activeItem, setActiveItem] = useState<{ 
    type: 'vault'; 
    data: ProjectMetadata; 
    metadata?: ActiveFileMetadata 
  } | { 
    type: 'local'; 
    data: File; 
    url: string; 
    metadata?: ActiveFileMetadata 
  } | null>(null);
  
  const [queueType, setQueueType] = useState<QueueType>('vault');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isRepeating, setIsRepeating] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffleQueue, setShuffleQueue] = useState<number[]>([]);
  const [shuffleIndex, setShuffleIndex] = useState(-1);

  const videoRef = useRef<HTMLVideoElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  useLiveEngine(videoRef, effects);

  useEffect(() => {
    loadProjects();
    return () => {
      if (activeItem?.type === 'local') {
        URL.revokeObjectURL(activeItem.url);
      }
    };
  }, []);

  const loadProjects = async () => {
    const data = await db.projects.orderBy('lastModified').reverse().toArray();
    setProjects(data);
  };

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(f => 
        f.type.startsWith('video/') || f.type.startsWith('audio/') || 
        f.name.endsWith('.mp3') || f.name.endsWith('.wav') || f.name.endsWith('.mp4') || f.name.endsWith('.m4a')
      ).map(f => ({ file: f }));
      
      setLocalFiles(files);
      setQueueType('local');
      setIsShuffling(false);

      // Background metadata extraction
      files.forEach(async (item, idx) => {
          const path = (item.file as any).path;
          if (path && window.electronAPI) {
              const meta = await window.electronAPI.getMetadata(path);
              if (meta) {
                  setLocalFiles(prev => prev.map((f, i) => i === idx ? { ...f, metadata: meta } : f));
              }
          }
      });
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play();
      setIsPlaying(!isPlaying);
    }
  };

  const handleSelectVault = async (project: ProjectMetadata) => {
    if (activeItem?.type === 'local') {
      URL.revokeObjectURL(activeItem.url);
    }
    setActiveItem({ type: 'vault', data: project });
    resetAndPlay();
  };

  const handleSelectLocal = async (file: File) => {
    if (activeItem?.type === 'local') {
      URL.revokeObjectURL(activeItem.url);
    }
    const url = URL.createObjectURL(file);
    setActiveItem({ type: 'local', data: file, url });
    
    // Just-in-time Metadata extraction
    /* @ts-ignore */
    const path = file.path;
    if (path) {
        try {
            /* @ts-ignore */
            const meta = await window.electronAPI.getMetadata(path);
            if (meta) {
                setActiveItem(prev => {
                    if (prev?.type === 'local' && prev.data === file) {
                        return { ...prev, metadata: meta };
                    }
                    return prev;
                });
            }
        } catch (e) {
            console.warn("Metadata extraction failed:", e);
        }
    }
    
    resetAndPlay();
  };

  const resetAndPlay = () => {
    setIsPlaying(true);
    setCurrentTime(0);
    setEffects({ ...effects, speed: 1.0, isNightcore: false, reverbWet: 0 });
    setTimeout(() => {
      if (videoRef.current) {
          videoRef.current.play().catch(e => console.error("Playback restriction:", e));
      }
    }, 100);
  };

  // --- Transport Logic ---

  const list = queueType === 'vault' ? projects : localFiles;

  const getNextIndex = () => {
    if (isShuffling && shuffleQueue.length > 0) {
        if (shuffleIndex < shuffleQueue.length - 1) {
            return shuffleQueue[shuffleIndex + 1];
        }
        return -1; // Stop at end of shuffle
    }

    const currentData = activeItem?.data;
    const idx = list.findIndex(item => {
        const itemData = queueType === 'local' ? (item as any).file : item;
        return itemData === currentData;
    });
    if (idx !== -1 && idx < list.length - 1) {
        return idx + 1;
    }
    return -1; // Stop at end
  };

  const getPrevIndex = () => {
    if (isShuffling && shuffleQueue.length > 0) {
        if (shuffleIndex > 0) {
            return shuffleQueue[shuffleIndex - 1];
        }
        return -1;
    }

    const currentData = activeItem?.data;
    const idx = list.findIndex(item => {
        const itemData = queueType === 'local' ? (item as any).file : item;
        return itemData === currentData;
    });
    if (idx > 0) {
        return idx - 1;
    }
    return -1;
  };

  const handleNext = () => {
    const nextIdx = getNextIndex();
    if (nextIdx !== -1) {
        if (isShuffling) setShuffleIndex(prev => prev + 1);
        if (queueType === 'vault') handleSelectVault(projects[nextIdx] as ProjectMetadata);
        else handleSelectLocal(localFiles[nextIdx].file);
    }
  };

  const handlePrevious = () => {
    // If we've played more than 3 seconds, reset current track instead of going back
    if (videoRef.current && videoRef.current.currentTime > 3) {
        videoRef.current.currentTime = 0;
        return;
    }

    const prevIdx = getPrevIndex();
    if (prevIdx !== -1) {
        if (isShuffling) setShuffleIndex(prev => prev - 1);
        if (queueType === 'vault') handleSelectVault(projects[prevIdx] as ProjectMetadata);
        else handleSelectLocal(localFiles[prevIdx].file);
    }
  };

  const toggleShuffle = () => {
    const newShuffle = !isShuffling;
    setIsShuffling(newShuffle);
    if (newShuffle) {
        // Create truly random shuffle queue
        const indices = Array.from({ length: list.length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j] as number, indices[i] as number];
        }
        setShuffleQueue(indices);
        
        // Find current track's position in shuffle
        const currentData = activeItem?.data;
        const currentIdx = list.findIndex(item => {
            const itemData = queueType === 'local' ? (item as any).file : item;
            return itemData === currentData;
        });
        const idxInShuffle = indices.indexOf(currentIdx);
        setShuffleIndex(idxInShuffle !== -1 ? idxInShuffle : 0);
    }
  };

  const handleEnded = () => {
    if (isRepeating) {
        if (videoRef.current) {
            videoRef.current.currentTime = 0;
            videoRef.current.play();
        }
    } else {
        handleNext();
    }
  };

  const toggleSlowed = () => {
    if (effects.speed === 0.8 && effects.reverbWet === 0.4) {
      setEffects({ ...effects, speed: 1.0, reverbWet: 0 });
    } else {
      setEffects({ ...effects, speed: 0.8, reverbWet: 0.4, isNightcore: false });
    }
  };

  const toggleNightcore = () => {
    if (effects.isNightcore) {
      setEffects({ ...effects, speed: 1.0, isNightcore: false });
    } else {
      setEffects({ ...effects, speed: 1.25, isNightcore: true, reverbWet: 0 });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) {
        videoRef.current.currentTime = val;
        setCurrentTime(val);
    }
  };

  // --- Helpers ---

  const isSlowed = effects.speed === 0.8 && effects.reverbWet === 0.4;
  const videoSrc = activeItem?.type === 'vault' 
    ? `media://${activeItem.data.filePath}` 
    : (activeItem?.type === 'local' ? activeItem.url : "");

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full h-full flex gap-6 p-6">
      
      {/* Primary Canvas Area */}
      <div className="flex-1 flex flex-col suite-card overflow-hidden relative">
        <div className="flex-1 bg-black relative flex items-center justify-center">
            {activeItem ? (
              <video 
                ref={videoRef}
                src={videoSrc}
                className="w-full h-full object-contain"
                onEnded={handleEnded}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
                crossOrigin="anonymous"
              />
            ) : (
                <div className="opacity-20 flex flex-col items-center">
                    <ListMusic className="w-16 h-16 animate-pulse" />
                    <span className="mt-4 text-xs font-black uppercase tracking-[0.3em]">Load Artifact to Canvas</span>
                </div>
            )}
        </div>

        {/* Streaming Transport Controls */}
        <div className="h-40 suite-glass-deep border-t border-[var(--color-outline)] px-8 py-6 flex flex-col gap-4 z-10">
          
          {/* Progress Bar (Scrubber) */}
          <div className="flex flex-col gap-1 w-full">
              <input 
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                className="w-full h-1 bg-[var(--color-outline)] rounded-full appearance-none cursor-pointer accent-[var(--color-primary)] hover:h-2 transition-all duration-200"
              />
              <div className="flex justify-between items-center text-[10px] font-mono opacity-40 uppercase tracking-widest px-1">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
              </div>
          </div>

          <div className="flex flex-row items-center justify-between flex-1">
            <div className="flex items-center gap-4 w-[320px]">
                <div className="w-16 h-16 rounded-[var(--radius-element)] border border-[var(--color-outline)] bg-[var(--color-surface)] overflow-hidden shrink-0 shadow-2xl">
                    {activeItem?.type === 'vault' ? (
                        activeItem.data.coverArt ? (
                            <img src={activeItem.data.coverArt} className="w-full h-full object-cover" alt="cover" />
                        ) : <div className="w-full h-full bg-[var(--color-primary)]/10" />
                    ) : (
                        activeItem?.metadata?.coverArt ? (
                            <img src={activeItem.metadata.coverArt} className="w-full h-full object-cover" alt="cover" />
                        ) : <div className="w-full h-full bg-[var(--color-primary)]/10 flex items-center justify-center"><ListMusic className="w-6 h-6 opacity-20" /></div>
                    )}
                </div>
                <div className="flex flex-col truncate">
                    <span className="text-base font-black uppercase tracking-tight truncate text-[var(--color-primary)]">
                        {activeItem?.type === 'vault' ? activeItem.data.name : (activeItem?.metadata?.title || activeItem?.data.name || "System Idle")}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40 truncate">
                        {activeItem?.type === 'vault' ? (activeItem.data.artist || "Vault Artifact") : (activeItem?.metadata?.artist || "Local Media")}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-8">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={toggleShuffle}
                        className={`p-2 rounded-full transition-all ${isShuffling ? "text-[var(--color-primary)] opacity-100" : "opacity-30 hover:opacity-100"}`}
                        title="Truly Random Shuffle"
                    >
                        <Shuffle className="w-5 h-5" />
                    </button>
                    <button 
                        onClick={handlePrevious}
                        disabled={!activeItem}
                        className="p-2 opacity-50 hover:opacity-100 disabled:opacity-10 active:scale-90 transition-all"
                    >
                        <SkipBack className="w-7 h-7 fill-current" />
                    </button>
                </div>

                <button 
                    disabled={!activeItem}
                    onClick={togglePlay}
                    className="w-16 h-16 rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-xl disabled:opacity-20 border-4 border-black/10"
                >
                    {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                </button>

                <div className="flex items-center gap-4">
                    <button 
                        onClick={handleNext}
                        disabled={!activeItem}
                        className="p-2 opacity-50 hover:opacity-100 disabled:opacity-10 active:scale-90 transition-all"
                    >
                        <SkipForward className="w-7 h-7 fill-current" />
                    </button>
                    <button 
                        onClick={() => setIsRepeating(!isRepeating)}
                        className={`p-2 rounded-full transition-all ${isRepeating ? "text-[var(--color-primary)] opacity-100" : "opacity-30 hover:opacity-100"}`}
                        title="Repeat Track"
                    >
                        <Repeat className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-end gap-3 w-[320px]">
                 <button 
                    onClick={toggleSlowed}
                    className={`p-3 rounded-[var(--radius-element)] transition-all border ${isSlowed ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-outline)] shadow-lg" : "bg-[var(--color-primary)]/5 opacity-40 hover:opacity-100 border-[var(--color-outline)]"}`}
                    title="Slowed + Reverb (Native Speed Hack)"
                 >
                    <Sparkles className="w-5 h-5" />
                 </button>
                 <button 
                    onClick={toggleNightcore}
                    className={`p-3 rounded-[var(--radius-element)] transition-all border ${effects.isNightcore ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-outline)] shadow-lg" : "bg-[var(--color-primary)]/5 opacity-40 hover:opacity-100 border-[var(--color-outline)]"}`}
                    title="Nightcore (Native Resampling)"
                 >
                    <Zap className="w-5 h-5" />
                 </button>
            </div>
          </div>
        </div>
      </div>

      {/* Queue Sidebar */}
      <div className="w-[350px] suite-card flex flex-col relative overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-[var(--color-outline)] suite-glass-deep sticky top-0 z-20 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex flex-col">
                    <h2 className="text-xs font-black uppercase tracking-[0.3em] text-[var(--color-primary)]">The Queue</h2>
                    <span className="text-[8px] font-bold opacity-30 uppercase tracking-widest">{queueType} mode</span>
                </div>
                <div className="flex gap-2">
                    <button 
                        onClick={() => setQueueType('vault')}
                        className={`p-2 rounded-[var(--radius-element)] border transition-all ${queueType === 'vault' ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-outline)] shadow-lg' : 'bg-transparent border-transparent opacity-40 hover:opacity-100'}`}
                        title="Vault Library"
                    >
                        <Library className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setQueueType('local')}
                        className={`p-2 rounded-[var(--radius-element)] border transition-all ${queueType === 'local' ? 'bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-outline)] shadow-lg' : 'bg-transparent border-transparent opacity-40 hover:opacity-100'}`}
                        title="Local Folder"
                    >
                        <FolderOpen className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {queueType === 'local' && (
                <button 
                    onClick={() => folderInputRef.current?.click()}
                    className="w-full p-3 suite-glass-subtle border border-[var(--color-outline)] rounded-[var(--radius-element)] text-[10px] font-black uppercase tracking-widest hover:bg-[var(--color-primary)]/10 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                >
                    <FolderOpen className="w-4 h-4" />
                    Select Media Folder
                </button>
            )}
            <input 
                type="file" 
                ref={folderInputRef}
                onChange={handleFolderSelect}
                className="hidden"
                /* @ts-ignore */
                webkitdirectory=""
                directory=""
                multiple
            />
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            {queueType === 'vault' ? (
                projects.map((proj) => (
                    <button
                        key={proj.id}
                        onClick={() => handleSelectVault(proj)}
                        className={`group w-full text-left p-3 rounded-[var(--radius-element)] flex items-center gap-3 transition-all border ${activeItem?.type === 'vault' && activeItem.data.id === proj.id ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30' : 'border-transparent hover:bg-[var(--color-surface-variant)]'}`}
                    >
                        <div className="w-10 h-10 rounded shadow-md overflow-hidden bg-[var(--color-surface)] border border-[var(--color-outline)] shrink-0 transition-transform group-hover:scale-110">
                           {proj.coverArt && <img src={proj.coverArt} className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-xs font-bold uppercase truncate text-[var(--color-on-surface)]">{proj.name}</span>
                            {proj.mediaType === 'video' && <span className="text-[8px] tracking-[0.2em] font-black text-[var(--color-primary)] animate-pulse">STREAM</span>}
                        </div>
                    </button>
                ))
            ) : (
                localFiles.map((item, idx) => (
                    <button
                        key={idx}
                        onClick={() => handleSelectLocal(item.file)}
                        className={`group w-full text-left p-3 rounded-[var(--radius-element)] flex items-center gap-3 transition-all border ${activeItem?.type === 'local' && activeItem.data === item.file ? 'bg-[var(--color-primary)]/10 border-[var(--color-primary)]/30' : 'border-transparent hover:bg-[var(--color-surface-variant)]'}`}
                    >
                        <div className="w-10 h-10 rounded shadow-md overflow-hidden bg-[var(--color-surface)] border border-[var(--color-outline)] shrink-0 flex items-center justify-center transition-transform group-hover:scale-110">
                           {item.metadata?.coverArt ? (
                               <img src={item.metadata.coverArt} className="w-full h-full object-cover" />
                           ) : <ListMusic className="w-5 h-5 opacity-20" />}
                        </div>
                        <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-xs font-bold uppercase truncate text-[var(--color-on-surface)] group-hover:text-[var(--color-primary)] transition-colors">{item.metadata?.title || item.file.name}</span>
                            <span className="text-[8px] tracking-widest opacity-40 uppercase truncate">{item.metadata?.artist || 'Offline Node'}</span>
                        </div>
                    </button>
                ))
            )}
            
            {(queueType === 'vault' && projects.length === 0) || (queueType === 'local' && localFiles.length === 0) ? (
                <div className="p-12 text-center opacity-20 flex flex-col items-center gap-4">
                    <ListMusic className="w-12 h-12" />
                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">
                        {queueType === 'vault' ? "Vault Empty" : "No Folder Armed"}
                    </span>
                </div>
            ) : null}
        </div>
      </div>
    </div>
  );
};

export default MediaPlayerView;
