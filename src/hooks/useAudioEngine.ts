import { useState, useEffect, useRef } from 'react';
import { analyzeAudio } from '../services/analyzer';
import { studioEngine } from '../services/engine/StudioEngine';
import type { StudioEffects } from '../services/engine/StudioEngine';
import { resumeAudioContext } from '../services/engine/audioContext';

export function useAudioEngine(
  activeBuffer: AudioBuffer | null,
  effects: StudioEffects,
  stems?: { vocals: AudioBuffer | null, instrumental: AudioBuffer | null },
  onAnalysis?: (bpm: number, genre: string, suggestedEQ: any) => void
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [bpm, setBpm] = useState(0);
  const [genre, setGenre] = useState('');
  const [reductionLevel, setReductionLevel] = useState(1.0);

  const pausedAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Ref to always have the LATEST effects without causing stale closure restarts
  const effectsRef = useRef(effects);
  effectsRef.current = effects;

  // Sync Buffers with Engine
  useEffect(() => {
    studioEngine.setBuffers(activeBuffer, stems);
    if (activeBuffer) {
        analyzeAudio(activeBuffer).then((res: any) => {
            setBpm(res.bpm);
            setGenre(res.genreHint);
            if (onAnalysis) onAnalysis(res.bpm, res.genreHint, res.suggestedEQ);
        });
    }
  }, [activeBuffer, stems]);

  // Sync Effects with Engine in real-time
  useEffect(() => {
      studioEngine.updateEffects(effects);
  }, [effects]);

  // Main Playback Loop
  useEffect(() => {
    if (isPlaying) {
      resumeAudioContext();
      const ctx = studioEngine.getContext();
      if (ctx) {
        // Use effectsRef.current (not stale `effects`) so we get the absolute latest state
        studioEngine.play(pausedAtRef.current, effectsRef.current);
        startedAtRef.current = ctx.currentTime - pausedAtRef.current;

        const update = () => {
          const elapsed = ctx.currentTime - startedAtRef.current;
          setCurrentTime(elapsed);
          
          setReductionLevel(studioEngine.getReductionTelemetry());

          if (activeBuffer && elapsed >= activeBuffer.duration / (effectsRef.current.speed || 1)) {
            setIsPlaying(false);
            pausedAtRef.current = 0;
            setCurrentTime(0);
          } else {
            rafRef.current = requestAnimationFrame(update);
          }
        };
        rafRef.current = requestAnimationFrame(update);
      }
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      const ctx = studioEngine.getContext();
      if (ctx && startedAtRef.current > 0) {
        pausedAtRef.current = ctx.currentTime - startedAtRef.current;
      }
      studioEngine.stop();
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying]);

  const seekTo = (time: number) => {
    pausedAtRef.current = time;
    setCurrentTime(time);
    if (isPlaying) {
      studioEngine.stop();
      studioEngine.play(time, effectsRef.current);
      const ctx = studioEngine.getContext();
      if (ctx) startedAtRef.current = ctx.currentTime - time;
    }
  };

  return {
    isPlaying,
    setIsPlaying,
    currentTime,
    duration: activeBuffer ? (activeBuffer.duration / (effectsRef.current.speed || 1)) : 0,
    seekTo,
    audioCtx: studioEngine.getContext(),
    analyser: studioEngine.getAnalyser(),
    bpm,
    genre,
    reductionLevel
  };
}
