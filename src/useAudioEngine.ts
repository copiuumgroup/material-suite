import { useState, useEffect, useRef } from 'react';
import { analyzeAudio } from './services/analyzer';
import { studioEngine } from './services/engine/AlgorithmEngine';
import type { StudioEffectParams } from './services/engine/AlgorithmEngine';
import { getAudioContext, resumeAudioContext } from './services/engine/audioContext';

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
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);
  const eqRef = useRef<BiquadFilterNode[]>([]);

  const [pausedAt, setPausedAt] = useState(0);
  const startedAtRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Initialize Audio Graph
  useEffect(() => {
    const ctx = getAudioContext();
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

    // Mastering Chain (Pro Mode)
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3.0;
    limiter.knee.value = 30;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;

    // EQ Chain
    const createFilter = (freq: number, type: BiquadFilterType) => {
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.gain.value = 0;
        return f;
    };
    const filters = [
        createFilter(60, 'lowshelf'),
        createFilter(250, 'peaking'),
        createFilter(1000, 'peaking'),
        createFilter(4000, 'peaking'),
        createFilter(12000, 'highshelf')
    ];

    // Connections
    mainGain.connect(filters[0]);
    filters[0].connect(filters[1]);
    filters[1].connect(filters[2]);
    filters[2].connect(filters[3]);
    filters[3].connect(filters[4]);
    filters[4].connect(limiter);
    
    limiter.connect(analyser); 
    analyser.connect(ctx.destination);

    reverbNodeRef.current = reverbNode;
    reverbGainRef.current = reverbGain;
    dryGainRef.current = dryGain;
    gainNodeRef.current = mainGain;
    analyserRef.current = analyser;
    limiterRef.current = limiter;
    eqRef.current = filters;

    // Note: We don't close the ctx here because it's a singleton
  }, []);

  // Update Reverb Buffer when context or params change
  useEffect(() => {
    if (!audioCtxRef.current || !reverbNodeRef.current) return;
    
    if (effects.customIRBuffer) {
        reverbNodeRef.current.buffer = effects.customIRBuffer;
    } else {
        // Default Mathematical Reverb
        studioEngine.createReverbBuffer(4.0, 3.5, 0.03).then(buffer => {
            if (reverbNodeRef.current && !effects.customIRBuffer) reverbNodeRef.current.buffer = buffer;
        });
    }
  }, [audioCtx, effects.customIRBuffer]);

  // Update Effect Gains in Real-time
  useEffect(() => {
    if (!reverbGainRef.current || !dryGainRef.current || !audioCtxRef.current) return;
    
    const ctx = audioCtxRef.current;
    reverbGainRef.current.gain.setTargetAtTime(effects.reverbWet, ctx.currentTime, 0.1);
    dryGainRef.current.gain.setTargetAtTime(1 - effects.reverbWet, ctx.currentTime, 0.1);

    if (sourceRef.current) {
        sourceRef.current.playbackRate.setTargetAtTime(effects.speed, ctx.currentTime, 0.1);
    }

    // Limiter Bypass Logic
    if (limiterRef.current) {
        const settings = effects.limiter || {
            threshold: -3.0,
            ratio: 12,
            attack: 0.003,
            release: 0.25
        };

        if (effects.quality === 'pro') {
            limiterRef.current.threshold.setTargetAtTime(settings.threshold, ctx.currentTime, 0.1);
            limiterRef.current.ratio.setTargetAtTime(settings.ratio, ctx.currentTime, 0.1);
            limiterRef.current.attack.setTargetAtTime(settings.attack, ctx.currentTime, 0.1);
            limiterRef.current.release.setTargetAtTime(settings.release, ctx.currentTime, 0.1);
        } else {
            limiterRef.current.threshold.setTargetAtTime(0, ctx.currentTime, 0.1);
        }
    }

    // Auto-EQ Logic
    if (effects.isAutoEQEnabled && effects.analysis && eqRef.current.length === 5) {
        const eq = effects.analysis.suggestedEQ;
        eqRef.current[0].gain.setTargetAtTime(eq.sub, ctx.currentTime, 0.1);
        eqRef.current[1].gain.setTargetAtTime(eq.bass, ctx.currentTime, 0.1);
        eqRef.current[2].gain.setTargetAtTime(eq.mid, ctx.currentTime, 0.1);
        eqRef.current[3].gain.setTargetAtTime(eq.treble, ctx.currentTime, 0.1);
        eqRef.current[4].gain.setTargetAtTime(eq.air, ctx.currentTime, 0.1);
    } else if (eqRef.current.length === 5) {
        eqRef.current.forEach(f => f.gain.setTargetAtTime(0, ctx.currentTime, 0.1));
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
      resumeAudioContext();

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
