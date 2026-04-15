import React from 'react';
import { Play, Pause, SkipForward, SkipBack, ListMusic, Sparkles, Zap, MicOff, X } from 'lucide-react';
import { motion } from 'framer-motion';
import Waveform from '../Waveform';
import StudioVisualizer from '../StudioVisualizer';
import type { Track } from '../types';
import type { StudioEffectParams } from '../services/engine/AlgorithmEngine';

interface Props {
  track: Track;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  currentTime: number;
  duration: number;
  seekTo: (time: number) => void;
  analyser: AnalyserNode | null;
  effects: StudioEffectParams;
  setEffects: (effects: StudioEffectParams) => void;
  onClose?: () => void;
  onExport?: () => void;
  uiMode: 'material' | 'metro';
}

const FloatingPlayer: React.FC<Props> = ({ 
  track, 
  isPlaying, 
  setIsPlaying, 
  currentTime, 
  duration, 
  seekTo, 
  analyser,
  effects,
  setEffects,
  onClose,
  onExport,
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

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-6xl px-4 z-50">
      <motion.div 
        initial={{ y: 100, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 100, opacity: 0, scale: 0.95 }}
        className="m3-glass-deep rounded-5xl border border-[var(--color-outline)] p-6 flex items-center gap-8 shadow-2xl overflow-hidden relative"
      >
        {onClose && (
          <button 
            onClick={onClose}
            className="absolute top-4 right-6 p-2 opacity-20 hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 rounded-full transition-all z-[20]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
        {/* Visualizer Background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none">
             <StudioVisualizer analyser={analyser} audioCtx={null} />
        </div>

        {/* Track Info */}
        <div className="flex items-center gap-6 w-[280px] shrink-0 relative z-10">
          <div className="w-14 h-14 rounded-3xl overflow-hidden shadow-2xl m3-glass-subtle flex-shrink-0 relative group border border-[var(--color-outline)]">
            {track.metadata?.coverArt ? (
              <img src={track.metadata.coverArt} className="w-full h-full object-cover" alt="" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-surface)] flex items-center justify-center">
                <ListMusic className="w-5 h-5 opacity-40" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-black uppercase tracking-tight truncate text-[var(--color-on-surface)]">{track.metadata?.title || track.file.name}</h3>
            <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest truncate">{track.metadata?.artist || 'Unknown Origin'}</p>
          </div>
        </div>

        {/* Controls & Progress */}
        <div className="flex-1 flex flex-col gap-3 max-w-xl mx-auto relative z-10">
          <div className="flex items-center justify-center gap-8">
            <div className="flex items-center gap-2 mr-4">
               <button 
                  onClick={toggleSlowed}
                  className={cn("p-3 rounded-2xl transition-all border", isSlowed ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-outline)]" : "bg-[var(--color-primary)]/5 opacity-40 hover:opacity-100 border-[var(--color-outline)]")}
                  title="Slowed + Reverb (0.8x)"
               >
                  <Sparkles className="w-4 h-4" />
               </button>
               <button 
                  onClick={toggleNightcore}
                  className={cn("p-3 rounded-2xl transition-all border", effects.isNightcore ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-[var(--color-outline)]" : "bg-[var(--color-primary)]/5 opacity-40 hover:opacity-100 border-[var(--color-outline)]")}
                  title="Nightcore (1.2x)"
               >
                  <Zap className="w-4 h-4" />
               </button>
               <button 
                  onClick={toggleVocal}
                  className={cn("p-3 rounded-2xl transition-all border", effects.isVocalReduced ? "bg-red-600 text-white border-[var(--color-outline)]" : "bg-[var(--color-primary)]/5 opacity-40 hover:opacity-100 border-[var(--color-outline)]")}
                  title="Vocal Isolation (AI SLot)"
               >
                  <MicOff className={cn("w-4 h-4", isMetro ? "fill-current" : "")} />
               </button>
            </div>

            <button className="p-2 opacity-30 hover:opacity-100 transition-all active:scale-90"><SkipBack className="w-5 h-5" /></button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-14 h-14 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-[32px] flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300"
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current ml-1" />}
            </button>
            <button className="p-2 opacity-30 hover:opacity-100 transition-all active:scale-90"><SkipForward className="w-5 h-5" /></button>
          </div>
          <div className="w-full flex items-center gap-4">
            <span className="text-[8px] font-mono opacity-30 w-10 text-right">{formatTime(currentTime)}</span>
            <div className="flex-1 h-8 flex items-center">
              <Waveform buffer={track.buffer} currentTime={currentTime} duration={duration} onSeek={seekTo} />
            </div>
            <span className="text-[8px] font-mono opacity-30 w-10">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Extras */}
        <div className="w-[180px] flex items-center justify-end gap-6 shrink-0 relative z-10 font-bold">
           <div className="flex flex-col items-end">
              <span className="text-[8px] uppercase tracking-widest opacity-20">Grade</span>
              <span className={cn("text-xs font-black", effects.quality === 'pro' ? "text-[var(--color-primary)]" : "")}>
                {effects.quality.toUpperCase()}
              </span>
           </div>
           {onExport ? (
                <button 
                  onClick={onExport} 
                  className={cn(
                    "m3-button m3-button-primary scale-75 origin-right",
                    isMetro ? "rounded-none" : ""
                  )}
                >
                  Render
                </button>
           ) : (
                <div className={cn(
                    "m3-chip bg-[var(--color-primary)] text-[var(--color-on-primary)] border-none",
                    isMetro ? "rounded-none" : ""
                )}>
                  STUDIO
                </div>
           )}
        </div>
      </motion.div>
    </div>
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

export default FloatingPlayer;
