import React from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, Music, Sparkles, Zap, MicOff, Folder, Share, X } from 'lucide-react';
import Waveform from '../components/studio/Waveform';
import StudioVisualizer from '../components/studio/StudioVisualizer';
import type { Track } from '../types';
import type { StudioEffectParams } from '../services/engine/AlgorithmEngine';
import { AudioKnob } from '../components/common/AudioKnob';
import { cn } from '../utils';

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
  hardwareMetrics: { cpuPercent: number; memoryWorkingSetMB: number; memoryPrivateMB: number } | null;
  onEject: () => void;
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
  hardwareMetrics,
  onEject
}) => {
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
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="flex-1 flex flex-col gap-6 py-6 px-10 overflow-hidden relative"
    >

      {/* Slim Header Bar */}
      <div className="flex justify-between items-center shrink-0 relative z-10 px-4 py-2 border-b border-[var(--color-outline)] suite-glass-subtle rounded-[var(--radius-container)]">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h1 className="text-xl font-black tracking-tighter uppercase leading-none text-[var(--color-on-surface)]">
              Material <span className="text-[var(--color-primary)] italic">Studio</span>
            </h1>
            <span className="text-[8px] font-black uppercase tracking-[0.4em] opacity-30">Advanced Algorithm Engine</span>
          </div>
          
          <div className="h-6 w-px bg-[var(--color-outline)]" />
          
          <div className="flex items-center gap-3">
             <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)] animate-pulse" />
             <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Connected to Backend</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <button onClick={onEject} className="suite-button-ghost text-xs opacity-40 hover:opacity-100 hover:text-red-500">
              <X className="w-3.5 h-3.5" /> Eject
            </button>
            <button className="suite-button-ghost text-xs opacity-40 hover:opacity-100">
              <Folder className="w-3.5 h-3.5" /> Config
            </button>
            <div className="w-px h-6 bg-[var(--color-outline)] mx-2" />
            <button onClick={onExport} className="suite-button suite-button-primary h-9 text-xs px-6 uppercase font-black tracking-widest">
              <Share className="w-3.5 h-3.5" /> Render Master
            </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-10 min-h-0 relative z-10 overflow-hidden">
          {/* Main Visualizer & Waveform Workspace */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 min-h-0">
              <div className="flex-1 border border-[var(--color-outline)] overflow-hidden relative suite-glass-deep rounded-[var(--radius-container)] shadow-2xl">
                  <StudioVisualizer analyser={analyser} audioCtx={null} />
                  <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[var(--color-surface)]/80 via-transparent to-transparent" />
                  
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
                      <div className="h-20 flex items-center px-8 border border-[var(--color-outline)] suite-glass-subtle rounded-[var(--radius-container)]">
                          <Waveform buffer={track.buffer!} currentTime={currentTime} duration={duration} onSeek={seekTo} />
                      </div>
                  </div>
              </div>

              <div className="p-6 flex items-center justify-between border border-[var(--color-outline)] shrink-0 suite-glass-subtle rounded-[var(--radius-container)]">
                  <div className="flex items-center gap-6">
                      <button className="p-4 opacity-30 hover:opacity-100 transition-all active:scale-95"><SkipBack className="w-6 h-6" /></button>
                      <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="w-16 h-16 bg-[var(--color-primary)] text-[var(--color-on-primary)] flex items-center justify-center transition-all duration-300 rounded-full shadow-2xl hover:scale-105 active:scale-95"
                      >
                        {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
                      </button>
                      <button className="p-4 opacity-30 hover:opacity-100 transition-all active:scale-95"><SkipForward className="w-6 h-6" /></button>
                  </div>

                  <div className="flex items-center gap-4 p-2 border border-[var(--color-outline)] suite-glass-subtle rounded-[var(--radius-container)] shadow-inner">
                      <button 
                         onClick={toggleSlowed}
                         className={cn("px-6 py-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all rounded-[var(--radius-element)]", isSlowed ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "opacity-30 hover:opacity-100")}
                      >
                         <Sparkles className="w-3.5 h-3.5" /> Slow + Reverb
                      </button>
                      <button 
                         onClick={toggleNightcore}
                         className={cn("px-6 py-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all rounded-[var(--radius-element)]", effects.isNightcore ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "opacity-30 hover:opacity-100")}
                      >
                         <Zap className="w-3.5 h-3.5" /> Nightcore
                      </button>
                      <div className="w-px h-6 bg-[var(--color-outline)] mx-1" />
                      <button 
                         onClick={toggleVocal}
                         className={cn("px-6 py-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all rounded-[var(--radius-element)]", effects.isVocalReduced ? "bg-red-600 text-white" : "opacity-30 hover:opacity-100")}
                      >
                         <MicOff className="w-3.5 h-3.5" /> Vocal Reducer
                      </button>
                      
                      <div className="w-px h-6 bg-[var(--color-outline)] mx-1" />
                      
                      <button 
                         onClick={() => setEffects({ ...effects, isAutoEQEnabled: !effects.isAutoEQEnabled })}
                         className={cn("px-6 py-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all rounded-[var(--radius-element)]", effects.isAutoEQEnabled ? "bg-cyan-500 text-white" : "opacity-30 hover:opacity-100")}
                      >
                         <Sparkles className="w-3.5 h-3.5" /> Auto-EQ
                      </button>
                      <button 
                         onClick={() => setEffects({ ...effects, isMultibandEnabled: !effects.isMultibandEnabled })}
                         className={cn("px-6 py-3 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all rounded-[var(--radius-element)]", effects.isMultibandEnabled ? "bg-amber-500 text-white" : "opacity-30 hover:opacity-100")}
                      >
                         <Zap className="w-3.5 h-3.5" /> Multi-Band Comp
                      </button>
                  </div>
              </div>
          </div>

          {/* Right Panel: Rack/Details */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 min-h-0">
              <div className="flex-1 border border-[var(--color-outline)] p-8 flex flex-col gap-6 min-h-0 suite-glass-subtle rounded-[var(--radius-container)] shadow-2xl">
                  <div className="flex items-center justify-between shrink-0">
                      <h3 className="text-lg font-black uppercase tracking-tighter">Chain Status</h3>
                      <div className="suite-chip text-[9px]">NODE-01</div>
                  </div>

                  {/* Scrollable Rack Container */}
                  <div className="flex-1 flex flex-col gap-6 min-h-0 overflow-hidden">
                      <div className="flex flex-col gap-3 shrink-0">
                           <div className="flex justify-between items-center">
                               <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Impulse Vault</span>
                               <label className="text-[8px] font-black uppercase tracking-widest bg-[var(--color-primary)] text-[var(--color-on-primary)] px-3 py-1 cursor-pointer transition-all rounded-full hover:scale-105 active:scale-95">
                                   Load .WAV
                                   <input type="file" accept=".wav" className="hidden" onChange={onIRUpload} />
                               </label>
                           </div>
                           <div className="flex flex-col gap-2 max-h-24 overflow-y-auto no-scrollbar border-b border-[var(--color-outline)] pb-2">
                               <button 
                                 onClick={() => onIRSelect(null)}
                                 className={cn("text-left px-3 py-2 text-[8px] font-bold uppercase tracking-wider border border-[var(--color-outline)] transition-all rounded-[var(--radius-element)]", !effects.irId ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/40 text-[var(--color-primary)]" : "opacity-40 hover:opacity-100")}
                               >
                                 System Engine (Mathematical)
                               </button>
                               {impulses.map((impulse: ImpulseData) => (
                                   <div key={impulse.id} className="relative group">
                                       <button 
                                         onClick={() => onIRSelect(impulse.id!)}
                                         className={cn("w-full text-left px-3 py-2 text-[8px] font-bold uppercase tracking-wider border border-[var(--color-outline)] transition-all flex justify-between items-center rounded-[var(--radius-element)]", effects.irId === impulse.id ? "bg-[var(--color-primary)]/10 border-[var(--color-primary)]/40 text-[var(--color-primary)]" : "opacity-40 hover:opacity-100")}
                                       >
                                         <span className="truncate pr-4">{impulse.name}</span>
                                         <span className="opacity-40 text-[7px]">{impulse.duration.toFixed(1)}s</span>
                                       </button>
                                       <button 
                                          onClick={() => onIRDelete(impulse.id!)}
                                          className="absolute right-2 top-1/2 -translate-y-1/2 p-2 opacity-0 group-hover:opacity-100 text-red-500 hover:scale-110"
                                       >
                                          <X className="w-2.5 h-2.5" />
                                       </button>
                                   </div>
                               ))}
                           </div>
                      </div>

                      {/* Multi-Column Knob Rack - The actual scrollable part */}
                      <div className="flex-1 overflow-y-auto p-2 grid grid-cols-2 gap-y-6 gap-x-2 no-scrollbar border-b border-[var(--color-outline)]">
                          <AudioKnob 
                            label="Playback Rate"
                            value={effects.speed * 100}
                            min={50}
                            max={150}
                            defaultValue={100}
                            suffix="%"
                            onChange={(v) => setEffects({ ...effects, speed: v / 100 })}
                          />
                          <AudioKnob 
                            label="Saturation"
                            value={effects.saturation}
                            min={0}
                            max={100}
                            defaultValue={0}
                            onChange={(v) => setEffects({ ...effects, saturation: v })}
                          />
                          <AudioKnob 
                            label="Reverb Wet"
                            value={effects.reverbWet * 100}
                            min={0}
                            max={100}
                            defaultValue={0}
                            onChange={(v) => setEffects({ ...effects, reverbWet: v / 100 })}
                          />
                          <AudioKnob 
                            label="Room Size"
                            value={effects.reverbRoomSize * 10}
                            min={1}
                            max={80}
                            defaultValue={10}
                            suffix="ds"
                            onChange={(v) => setEffects({ ...effects, reverbRoomSize: v / 10 })}
                          />
                          <AudioKnob 
                            label="Stereo Width"
                            value={effects.stereoWidth}
                            min={0}
                            max={200}
                            defaultValue={100}
                            onChange={(v) => setEffects({ ...effects, stereoWidth: v })}
                          />
                          <AudioKnob 
                            label="Tape Wow"
                            value={effects.tapeWow}
                            min={0}
                            max={100}
                            defaultValue={0}
                            onChange={(v) => setEffects({ ...effects, tapeWow: v })}
                          />
                          <AudioKnob 
                            label="Tape Flutter"
                            value={effects.tapeFlutter}
                            min={0}
                            max={100}
                            defaultValue={0}
                            onChange={(v) => setEffects({ ...effects, tapeFlutter: v })}
                          />
                      </div>
                  </div>

                  <div className="mt-auto p-5 border border-[var(--color-outline)] flex flex-col gap-3 shrink-0 suite-glass-subtle rounded-[var(--radius-container)]">
                      <div className="flex items-center gap-3">
                          <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
                          <span className="text-[9px] font-black uppercase tracking-widest opacity-60">Engine Telemetry</span>
                      </div>
                      <div className="font-mono text-[8px] opacity-60 leading-relaxed grid grid-cols-2 gap-x-4">
                          <span className="opacity-30">CPU_USAGE:</span> <span>{hardwareMetrics?.cpuPercent || 0}%</span>
                          <span className="opacity-30">WORKING_SET:</span> <span>{hardwareMetrics?.memoryWorkingSetMB || 0}MB</span>
                          <span className="opacity-30">PRIVATE_MEM:</span> <span>{hardwareMetrics?.memoryPrivateMB || 0}MB</span>
                          <span className="opacity-30">SAMPLE_RATE:</span> <span>44.1kHz</span>
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

export default StudioView;
