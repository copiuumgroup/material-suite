import React from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, Music, Sparkles, Zap, MicOff, Folder, Share, X } from 'lucide-react';
import Waveform from '../Waveform';
import StudioVisualizer from '../StudioVisualizer';
import type { Track } from '../types';
import type { StudioEffectParams } from '../services/engine/AlgorithmEngine';

import type { ImpulseData } from '../db/database';

interface Props {
  track: Track | null;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  currentTime: number;
  duration: number;
  seekTo: (time: number) => void;
  analyser: AnalyserNode | null;
  effects: StudioEffectParams;
  setEffects: (effects: StudioEffectParams) => void;
  onExport: () => void;
  impulses: ImpulseData[];
  onIRUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onIRSelect: (id: number | null) => void;
  onIRDelete: (id: number) => void;
  uiMode: 'material' | 'metro';
}

const StudioView: React.FC<Props> = ({ 
  track, 
  isPlaying, 
  setIsPlaying, 
  currentTime, 
  duration, 
  seekTo, 
  analyser,
  effects,
  setEffects,
  onExport,
  impulses,
  onIRUpload,
  onIRSelect,
  onIRDelete,
  uiMode
}) => {
  const isMetro = uiMode === 'metro';
  
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
      setEffects({ ...effects, speed: 1.2, isNightcore: true, reverbWet: 0 });
    }
  };

  const toggleVocal = () => {
    setEffects({ ...effects, isVocalReduced: !effects.isVocalReduced });
  };

  const isSlowed = effects.speed === 0.8 && effects.reverbWet === 0.4;

  if (!track || !track.isReady) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center opacity-10">
        <Music className="w-32 h-32 mb-8 stroke-[1]" />
        <h2 className="text-4xl font-black uppercase tracking-tighter">Studio Standby</h2>
        <p className="text-sm font-bold uppercase tracking-[0.4em] mt-4">Load a source from the Vault to begin mastering</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: isMetro ? -100 : 0 }} 
      animate={{ opacity: 1, x: 0 }} 
      className="flex-1 flex flex-col gap-10 py-12 px-10 overflow-hidden relative"
    >
      {/* Giant Windows 8.1 Header Overlay */}
      {isMetro && (
           <div className="absolute top-[-20px] left-[-20px] pointer-events-none opacity-[0.03] select-none z-0">
               <h1 className="text-[240px] font-black uppercase tracking-tighter leading-none">STU<br/>DIO</h1>
               <p className="text-[20px] font-bold tracking-[1em] ml-4 mt-[-40px]">ADVANCED ENGINE NODE</p>
           </div>
       )}

      <div className="flex justify-between items-start shrink-0 relative z-10">
        <div className="flex flex-col gap-2">
          <h1 className={cn("font-black tracking-tighter uppercase leading-[0.7] text-[var(--color-on-surface)] select-none", isMetro ? "text-9xl" : "text-7xl")}>
            Material<br /><span className="text-[var(--color-primary)] opacity-20 italic">Studio</span>
          </h1>
          <span className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40 ml-1">Advanced Algorithm Engine</span>
        </div>

        <div className="flex gap-4">
             <button className={cn("m3-button opacity-40 hover:opacity-100", isMetro ? "rounded-none border border-[var(--color-outline)]" : "")}>
                <Folder className={cn("w-4 h-4", isMetro ? "fill-current" : "")} /> Config
             </button>
             <button onClick={onExport} className={cn("m3-button m3-button-primary", isMetro ? "rounded-none" : "")}>
                <Share className={cn("w-4 h-4", isMetro ? "fill-current" : "")} /> Render Master
             </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-10 min-h-0 relative z-10">
          {/* Main Visualizer & Waveform Workspace */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
              <div className={cn("flex-1 border border-[var(--color-outline)] overflow-hidden relative", isMetro ? "bg-black rounded-none" : "m3-glass-deep rounded-5xl shadow-2xl")}>
                  <StudioVisualizer analyser={analyser} audioCtx={null} />
                  <div className={cn("absolute inset-0 pointer-events-none", isMetro ? "bg-gradient-to-t from-black/80 to-transparent" : "bg-gradient-to-t from-[var(--color-surface)]/80 via-transparent to-transparent")} />
                  
                  <div className="absolute bottom-10 left-10 right-10 flex flex-col gap-6">
                      <div className="flex items-end justify-between px-2">
                          <div className="flex flex-col">
                              <h3 className="text-3xl font-black uppercase tracking-tighter truncate max-w-md">{track.metadata?.title || track.file.name}</h3>
                              <p className="text-sm font-bold opacity-40 uppercase tracking-widest">{track.metadata?.artist || 'Unknown Origin'}</p>
                          </div>
                          <div className="flex items-center gap-6 font-mono text-xs opacity-40">
                              <span>{formatTime(currentTime)}</span>
                              <div className="w-px h-4 bg-[var(--color-outline)]" />
                              <span>{formatTime(duration)}</span>
                          </div>
                      </div>
                      <div className={cn("h-24 flex items-center px-8 border border-[var(--color-outline)]", isMetro ? "bg-black rounded-none" : "m3-glass-subtle rounded-4xl")}>
                          <Waveform buffer={track.buffer!} currentTime={currentTime} duration={duration} onSeek={seekTo} />
                      </div>
                  </div>
              </div>

              <div className={cn("p-8 flex items-center justify-between border border-[var(--color-outline)]", isMetro ? "bg-black rounded-none" : "m3-glass-subtle rounded-4xl")}>
                  <div className="flex items-center gap-6">
                      <button className="p-4 opacity-30 hover:opacity-100 transition-all active:scale-95"><SkipBack className="w-6 h-6" /></button>
                      <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className={cn(
                            "w-20 h-20 bg-[var(--color-primary)] text-[var(--color-on-primary)] flex items-center justify-center transition-all duration-300",
                            isMetro ? "rounded-none" : "rounded-[40px] shadow-2xl hover:scale-105 active:scale-95"
                        )}
                      >
                        {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                      </button>
                      <button className="p-4 opacity-30 hover:opacity-100 transition-all active:scale-95"><SkipForward className="w-6 h-6" /></button>
                  </div>

                  <div className={cn("flex items-center gap-4 p-2 border border-[var(--color-outline)]", isMetro ? "bg-black rounded-none shadow-none" : "m3-glass-subtle rounded-[32px] shadow-inner")}>
                      <button 
                         onClick={toggleSlowed}
                         className={cn("px-8 py-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all", isSlowed ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "opacity-30 hover:opacity-100", isMetro ? "rounded-none" : "rounded-[24px]")}
                      >
                         <Sparkles className="w-4 h-4" /> Slowed + Reverb
                      </button>
                      <button 
                         onClick={toggleNightcore}
                         className={cn("px-8 py-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all", effects.isNightcore ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "opacity-30 hover:opacity-100", isMetro ? "rounded-none" : "rounded-[24px]")}
                      >
                         <Zap className="w-4 h-4" /> Nightcore
                      </button>
                      <div className="w-px h-8 bg-[var(--color-outline)] mx-2" />
                      <button 
                         onClick={toggleVocal}
                         className={cn("px-8 py-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all", effects.isVocalReduced ? "bg-red-600 text-white" : "opacity-30 hover:opacity-100", isMetro ? "rounded-none" : "rounded-[24px]")}
                      >
                         <MicOff className="w-4 h-4" /> Vocal Reducer
                      </button>
                      
                      <div className="w-px h-8 bg-[var(--color-outline)] mx-2" />
                      
                      <button 
                         onClick={() => setEffects({ ...effects, isAutoEQEnabled: !effects.isAutoEQEnabled })}
                         className={cn("px-8 py-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all", effects.isAutoEQEnabled ? "bg-cyan-500 text-white" : "opacity-30 hover:opacity-100", isMetro ? "rounded-none" : "rounded-[24px]")}
                      >
                         <Sparkles className="w-4 h-4" /> Auto-EQ
                      </button>
                  </div>
              </div>
          </div>

          {/* Right Panel: Rack/Details */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
              <div className={cn("flex-1 border border-[var(--color-outline)] p-10 flex flex-col gap-8", isMetro ? "bg-black rounded-none shadow-none" : "m3-glass-subtle rounded-5xl shadow-2xl")}>
                  <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black uppercase tracking-tighter">Chain Status</h3>
                      <div className="m3-chip">NODE-01</div>
                  </div>

                  <div className="flex flex-col gap-6">
                      <div className="flex flex-col gap-3">
                           <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Mastering Grade</span>
                           <div className={cn("flex p-1 border border-[var(--color-outline)]", isMetro ? "bg-[var(--color-surface)]/10 rounded-none" : "m3-glass-subtle rounded-2xl")}>
                               <button 
                                 onClick={() => setEffects({ ...effects, quality: 'fast' })}
                                 className={cn("flex-1 py-2 text-[9px] font-black uppercase transition-all", effects.quality === 'fast' ? "bg-[var(--color-surface)] text-[var(--color-on-surface)]" : "opacity-30", isMetro ? "rounded-none" : "rounded-xl")}
                               >
                                 Fast
                               </button>
                               <button 
                                 onClick={() => setEffects({ ...effects, quality: 'pro' })}
                                 className={cn("flex-1 py-2 text-[9px] font-black uppercase transition-all", effects.quality === 'pro' ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-lg" : "opacity-30", isMetro ? "rounded-none" : "rounded-xl")}
                               >
                                 Pro (Ultra)
                               </button>
                           </div>
                      </div>

                      <div className="flex flex-col gap-3">
                           <div className="flex justify-between items-center">
                               <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Impulse Vault</span>
                               <label className={cn("text-[8px] font-black uppercase tracking-widest bg-[var(--color-primary)] text-[var(--color-on-primary)] px-3 py-1 cursor-pointer transition-all", isMetro ? "rounded-none" : "rounded-full hover:scale-105 active:scale-95")}>
                                   Load .WAV
                                   <input type="file" accept=".wav" className="hidden" onChange={onIRUpload} />
                               </label>
                           </div>
                           <div className="flex flex-col gap-2 max-h-32 overflow-y-auto no-scrollbar">
                               <button 
                                 onClick={() => onIRSelect(null)}
                                 className={cn("text-left px-4 py-3 text-[9px] font-bold uppercase tracking-wider border border-[var(--color-outline)] transition-all", !effects.irId ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/40 text-[var(--color-primary)]" : "opacity-40 hover:opacity-100", isMetro ? "rounded-none" : "rounded-2xl")}
                               >
                                 System Engine (Mathematical)
                               </button>
                               {impulses.map((impulse: ImpulseData) => (
                                   <div key={impulse.id} className="relative group">
                                       <button 
                                         onClick={() => onIRSelect(impulse.id!)}
                                         className={cn("w-full text-left px-4 py-3 text-[9px] font-bold uppercase tracking-wider border border-[var(--color-outline)] transition-all flex justify-between items-center", effects.irId === impulse.id ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/40 text-[var(--color-primary)]" : "opacity-40 hover:opacity-100", isMetro ? "rounded-none" : "rounded-2xl")}
                                       >
                                         <span className="truncate pr-4">{impulse.name}</span>
                                         <span className="opacity-40 text-[8px]">{impulse.duration.toFixed(1)}s</span>
                                       </button>
                                       <button 
                                          onClick={() => onIRDelete(impulse.id!)}
                                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 text-red-500 hover:scale-110"
                                       >
                                          <X className="w-3 h-3" />
                                       </button>
                                   </div>
                               ))}
                           </div>
                      </div>

                      <div className="flex flex-col gap-2">
                           <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-40">
                               <span>Playback Rate</span>
                               <span>{effects.speed.toFixed(2)}x</span>
                           </div>
                           <div className={cn("h-1.5 w-full bg-[var(--color-surface)]/20 overflow-hidden", isMetro ? "rounded-none" : "rounded-full")}>
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${(effects.speed / 2) * 100}%` }}
                                 className="h-full bg-[var(--color-primary)] shadow-[0_0_15px_var(--color-primary)]"
                               />
                           </div>
                      </div>

                      <div className="flex flex-col gap-2">
                           <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-40">
                               <span>Reverb Wetness</span>
                               <span>{Math.round(effects.reverbWet * 100)}%</span>
                           </div>
                           <div className={cn("h-1.5 w-full bg-[var(--color-surface)]/20 overflow-hidden", isMetro ? "rounded-none" : "rounded-full")}>
                               <motion.div 
                                 initial={{ width: 0 }}
                                 animate={{ width: `${effects.reverbWet * 100}%` }}
                                 className="h-full bg-[var(--color-primary)] shadow-[0_0_15px_var(--color-primary)]"
                               />
                           </div>
                      </div>
                  </div>

                  <div className={cn("mt-auto p-6 border border-[var(--color-outline)] flex flex-col gap-4", isMetro ? "bg-black rounded-none" : "m3-glass-subtle rounded-4xl")}>
                      <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-[var(--color-primary)] animate-pulse" />
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Engine Telemetry</span>
                      </div>
                      <div className="font-mono text-[9px] opacity-30 leading-relaxed">
                          BUFFER_SIZE: 1024<br />
                          SAMPLE_RATE: 44100Hz<br />
                          BIT_DEPTH: 32bit_FLOAT<br />
                          CHANNELS: STEREO_L_R
                      </div>
                  </div>
              </div>
          </div>
      </div>
    </motion.div>
  );
};

function formatTime(s: number) {
  const m = Math.floor(s / 60);
  const rs = Math.floor(s % 60);
  return `${m}:${rs.toString().padStart(2, '0')}`;
}

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}

export default StudioView;
