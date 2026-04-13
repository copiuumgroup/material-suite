import React from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, SkipForward, SkipBack, Music, Sparkles, Zap, MicOff, Settings2, Share } from 'lucide-react';
import Waveform from '../Waveform';
import StudioVisualizer from '../StudioVisualizer';
import type { Track } from '../types';
import type { StudioEffectParams } from '../services/engine/AlgorithmEngine';

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
  onExport
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
      initial={{ opacity: 0, scale: 0.98 }} 
      animate={{ opacity: 1, scale: 1 }} 
      className="flex-1 flex flex-col gap-10 py-12 px-10 overflow-hidden relative"
    >
      <div className="flex justify-between items-start shrink-0 z-10">
        <div className="flex flex-col gap-2">
          <h1 className="text-8xl font-black tracking-tighter uppercase leading-[0.7] text-[var(--color-on-surface)] select-none">
            Material<br /><span className="text-[var(--color-primary)] opacity-20 italic">Studio</span>
          </h1>
          <span className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40 ml-1">Advanced Algorithm Engine</span>
        </div>

        <div className="flex gap-4">
             <button className="m3-button opacity-40 hover:opacity-100"><Settings2 className="w-4 h-4" /> Config</button>
             <button onClick={onExport} className="m3-button m3-button-primary"><Share className="w-4 h-4" /> Render Master</button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-10 min-h-0 relative z-10">
          {/* Main Visualizer & Waveform Workspace */}
          <div className="col-span-12 lg:col-span-8 flex flex-col gap-8">
              <div className="flex-1 bg-black/40 rounded-5xl border border-[var(--color-outline)] overflow-hidden relative shadow-2xl">
                  <StudioVisualizer analyser={analyser} audioCtx={null} />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none" />
                  
                  <div className="absolute bottom-10 left-10 right-10 flex flex-col gap-6">
                      <div className="flex items-end justify-between px-2">
                          <div className="flex flex-col">
                              <h3 className="text-3xl font-black uppercase tracking-tighter truncate max-w-md">{track.metadata?.title || track.file.name}</h3>
                              <p className="text-sm font-bold opacity-40 uppercase tracking-widest">{track.metadata?.artist || 'Unknown Origin'}</p>
                          </div>
                          <div className="flex items-center gap-6 font-mono text-xs opacity-40">
                              <span>{formatTime(currentTime)}</span>
                              <div className="w-px h-4 bg-white/20" />
                              <span>{formatTime(duration)}</span>
                          </div>
                      </div>
                      <div className="h-24 flex items-center bg-white/5 rounded-4xl px-8 border border-white/5 backdrop-blur-3xl">
                          <Waveform buffer={track.buffer!} currentTime={currentTime} duration={duration} onSeek={seekTo} />
                      </div>
                  </div>
              </div>

              <div className="bg-[var(--color-surface-variant)] rounded-4xl p-8 flex items-center justify-between border border-[var(--color-outline)]">
                  <div className="flex items-center gap-6">
                      <button className="p-4 opacity-30 hover:opacity-100 transition-all active:scale-90"><SkipBack className="w-6 h-6" /></button>
                      <button 
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="w-20 h-20 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-[40px] flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300"
                      >
                        {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current ml-1" />}
                      </button>
                      <button className="p-4 opacity-30 hover:opacity-100 transition-all active:scale-90"><SkipForward className="w-6 h-6" /></button>
                  </div>

                  <div className="flex items-center gap-4 bg-black/40 p-2 rounded-[32px] border border-white/5 shadow-inner">
                      <button 
                         onClick={toggleSlowed}
                         className={cn("px-8 py-4 rounded-[24px] flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all", isSlowed ? "bg-[var(--color-primary)] text-white" : "opacity-30 hover:opacity-100")}
                      >
                         <Sparkles className="w-4 h-4" /> Slowed + Reverb
                      </button>
                      <button 
                         onClick={toggleNightcore}
                         className={cn("px-8 py-4 rounded-[24px] flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all", effects.isNightcore ? "bg-[var(--color-primary)] text-white" : "opacity-30 hover:opacity-100")}
                      >
                         <Zap className="w-4 h-4" /> Nightcore
                      </button>
                      <div className="w-px h-8 bg-white/10 mx-2" />
                      <button 
                         onClick={toggleVocal}
                         className={cn("px-8 py-4 rounded-[24px] flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all", effects.isVocalReduced ? "bg-red-500 text-white" : "opacity-30 hover:opacity-100")}
                      >
                         <MicOff className="w-4 h-4" /> Vocal Reducer
                      </button>
                  </div>
              </div>
          </div>

          {/* Right Panel: Rack/Details */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-8">
              <div className="flex-1 bg-[var(--color-surface-variant)] rounded-5xl border border-[var(--color-outline)] p-10 flex flex-col gap-8 shadow-2xl">
                  <div className="flex items-center justify-between">
                      <h3 className="text-xl font-black uppercase tracking-tighter">Chain Status</h3>
                      <div className="m3-chip">NODE-01</div>
                  </div>

                  <div className="flex flex-col gap-6">
                      <div className="flex flex-col gap-2">
                          <div className="flex justify-between text-[10px] font-black uppercase tracking-widest opacity-40">
                              <span>Playback Rate</span>
                              <span>{effects.speed.toFixed(2)}x</span>
                          </div>
                          <div className="h-1.5 w-full bg-black rounded-full overflow-hidden">
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
                          <div className="h-1.5 w-full bg-black rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${effects.reverbWet * 100}%` }}
                                className="h-full bg-[var(--color-primary)] shadow-[0_0_15px_var(--color-primary)]"
                              />
                          </div>
                      </div>
                  </div>

                  <div className="mt-auto p-6 bg-black/40 rounded-4xl border border-white/5 flex flex-col gap-4">
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
