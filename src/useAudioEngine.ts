import { useState, useEffect, useRef } from 'react';
import { analyzeAudio } from './services/analyzer';
import { studioEngine } from './services/engine/AlgorithmEngine';
import type { StudioEffectParams } from './services/engine/AlgorithmEngine';

export function useAudioEngine(
  activeBuffer: AudioBuffer | null,
  effects: StudioEffectParams,
  onAnalysis?: (bpm: number, genre: string, suggestedEQ: any) => void
) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [bpm, setBpm] = useState(0);
  const [genre, setGenre] = useState('');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  
  // Effects Nodes
  const reverbNodeRef = useRef<ConvolverNode | null>(null);
  const reverbGainRef = useRef<GainNode | null>(null);
  const dryGainRef = useRef<GainNode | null>(null);

  const [pausedAt, setPausedAt] = useState(0);
  const startedAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Initialize Audio Graph
  useEffect(() => {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    audioCtxRef.current = ctx;
    setAudioCtx(ctx);
    studioEngine.setContext(ctx);

    const mainGain = ctx.createGain();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;

    // Sidechain-style Reverb Graph
    const reverbNode = ctx.createConvolver();
    const reverbGain = ctx.createGain();
    const dryGain = ctx.createGain();
    
    reverbGain.gain.value = 0; // Starts dry
    dryGain.gain.value = 1;

    // Connections
    // Source -> dryGain -> mainGain
    // Source -> reverbNode -> reverbGain -> mainGain
    mainGain.connect(analyser);
    analyser.connect(ctx.destination);

    reverbNodeRef.current = reverbNode;
    reverbGainRef.current = reverbGain;
    dryGainRef.current = dryGain;
    gainNodeRef.current = mainGain;
    analyserRef.current = analyser;

    return () => {
      ctx.close();
    };
  }, []);

  // Update Reverb Buffer when context or params change (Debounced generation if needed, but we do it once)
  useEffect(() => {
    if (!audioCtxRef.current || !reverbNodeRef.current) return;
    
    studioEngine.createReverbBuffer(3.5, 4.0).then(buffer => {
      if (reverbNodeRef.current) reverbNodeRef.current.buffer = buffer;
    });
  }, [audioCtx]);

  // Update Effect Gains in Real-time
  useEffect(() => {
    if (!reverbGainRef.current || !dryGainRef.current) return;
    reverbGainRef.current.gain.setTargetAtTime(effects.reverbWet, audioCtxRef.current?.currentTime || 0, 0.1);
    dryGainRef.current.gain.setTargetAtTime(1 - effects.reverbWet, audioCtxRef.current?.currentTime || 0, 0.1);

    if (sourceRef.current) {
        sourceRef.current.playbackRate.setTargetAtTime(effects.speed, audioCtxRef.current?.currentTime || 0, 0.1);
    }
  }, [effects, audioCtx]);

  useEffect(() => {
    setIsPlaying(false);
    setPausedAt(0);
    setCurrentTime(0);

    if (activeBuffer) {
      analyzeAudio(activeBuffer).then(res => {
        setBpm(res.bpm);
        setGenre(res.genreHint);
        if (onAnalysis) onAnalysis(res.bpm, res.genreHint, res.suggestedEQ);
      });
    }
  }, [activeBuffer]);

  useEffect(() => {
    if (isPlaying && activeBuffer && audioCtxRef.current) {
      const updateProgress = () => {
        const elapsed = (audioCtxRef.current!.currentTime - startedAtRef.current) * effects.speed;
        setCurrentTime(elapsed % activeBuffer.duration);
        rafRef.current = requestAnimationFrame(updateProgress);
      };
      rafRef.current = requestAnimationFrame(updateProgress);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, activeBuffer, effects.speed]);

  useEffect(() => {
    if (!activeBuffer || !audioCtxRef.current || !gainNodeRef.current) return;

    if (isPlaying) {
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      const source = audioCtxRef.current.createBufferSource();
      source.buffer = activeBuffer;
      source.playbackRate.value = effects.speed;

      // Connect to Dry/Wet Chain
      source.connect(dryGainRef.current!);
      dryGainRef.current!.connect(gainNodeRef.current);

      source.connect(reverbNodeRef.current!);
      reverbNodeRef.current!.connect(reverbGainRef.current!);
      reverbGainRef.current!.connect(gainNodeRef.current);

      source.start(0, pausedAt);
      startedAtRef.current = audioCtxRef.current.currentTime - (pausedAt / effects.speed);
      sourceRef.current = source;
      
      source.onended = () => {
        if (sourceRef.current === source) {
          setIsPlaying(false);
          setPausedAt(0);
          setCurrentTime(0);
        }
      };
    } else {
      if (sourceRef.current) {
        const elapsed = (audioCtxRef.current.currentTime - startedAtRef.current) * effects.speed;
        setPausedAt(elapsed % activeBuffer.duration);
        sourceRef.current.onended = null;
        sourceRef.current.stop();
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
    }

    return () => {
      if (sourceRef.current) {
        sourceRef.current.onended = null;
        sourceRef.current.stop();
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
    };
  }, [isPlaying, activeBuffer, effects.speed]);

  const seekTo = (time: number) => {
    if (!activeBuffer) return;
    const wasPlaying = isPlaying;
    if (wasPlaying) setIsPlaying(false);
    const bufferPos = Math.max(0, Math.min(time, activeBuffer.duration));
    setPausedAt(bufferPos);
    setCurrentTime(bufferPos);
    if (wasPlaying) setTimeout(() => setIsPlaying(true), 10);
  };

  return {
    isPlaying,
    setIsPlaying,
    currentTime,
    duration: activeBuffer?.duration || 0,
    seekTo,
    audioCtx,
    analyser: analyserRef.current,
    bpm,
    genre
  };
}
