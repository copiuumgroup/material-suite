import React, { useEffect, useRef } from 'react';

interface EQSettings {
  sub: number;
  bass: number;
  mid: number;
  treble: number;
  air: number;
}

interface Props {
  analyser: AnalyserNode | null;
  eq: EQSettings;
  audioCtx: AudioContext | null;
  isClassicMode?: boolean;
}

const StudioVisualizer: React.FC<Props> = ({ analyser, eq, audioCtx, isClassicMode = false }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(null);
  const particles = useRef<any[]>([]);
  const smoothedHeights = useRef<number[]>(new Array(64).fill(0));

  // Particle Engine for Classic Mode
  useEffect(() => {
    if (!isClassicMode) {
      particles.current = [];
      return;
    }
    const count = 40;
    particles.current = Array.from({ length: count }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      s: 0.5 + Math.random() * 2,
      v: 0.2 + Math.random() * 0.5,
      a: Math.random() * Math.PI * 2,
      update(w: number, h: number, energy: number) {
        this.x += Math.cos(this.a) * this.v * (1 + energy * 2);
        this.y += Math.sin(this.a) * this.v * (1 + energy * 2);
        if (this.x < 0) this.x = w;
        if (this.x > w) this.x = 0;
        if (this.y < 0) this.y = h;
        if (this.y > h) this.y = 0;
      },
      draw(ctx: CanvasRenderingContext2D) {
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.s, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }));
  }, [isClassicMode]);

  useEffect(() => {
    if (!canvasRef.current || !analyser) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      const width = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      const height = canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);

      // Deep energy detection
      const bassEnergy = (dataArray[0] + dataArray[1] + dataArray[2]) / (3 * 255);

      if (isClassicMode) {
        particles.current.forEach(p => {
          p.update(width, height, bassEnergy);
          p.draw(ctx);
        });
      }

      const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-primary').trim() || '#fff';
      const barCount = 64;
      const totalPad = 6;
      const barWidth = (width - (barCount * totalPad)) / barCount;

      for (let i = 0; i < barCount; i++) {
        const percent = i / barCount;
        const sampleIdx = Math.floor(Math.pow(percent, 1.4) * bufferLength * 0.5);
        const rawHeight = (dataArray[sampleIdx] / 255) * height * 0.8;
        
        smoothedHeights.current[i] += (rawHeight - smoothedHeights.current[i]) * 0.25;
        const h = Math.max(4, smoothedHeights.current[i]);
        const x = i * (barWidth + totalPad) + totalPad;

        if (isClassicMode) {
          ctx.fillStyle = '#fff';
          ctx.shadowBlur = bassEnergy * 20;
          ctx.shadowColor = '#fff';
          ctx.beginPath();
          ctx.roundRect(x, height - h, barWidth, h, barWidth / 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else {
          // PRO GRADIENT MODE
          const grad = ctx.createLinearGradient(0, height, 0, height - h);
          grad.addColorStop(0, '#dfff00'); // Cyber Lime
          grad.addColorStop(1, primaryColor);
          
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, height - h, barWidth, h, [4, 4, 0, 0]);
          ctx.fill();

          // Peak Glow
          if (rawHeight > height * 0.6) {
             ctx.fillStyle = '#fff';
             ctx.globalAlpha = 0.4;
             ctx.fillRect(x, height - h, barWidth, 4);
             ctx.globalAlpha = 1;
          }
        }
      }

      if (!isClassicMode) {
        drawEQCurve(ctx, width, height, eq, audioCtx);
      }

      rafRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyser, eq, audioCtx, isClassicMode]);

  return (
    <div className={cn(
      "relative w-full h-48 rounded-[24px] overflow-hidden border transition-all duration-700",
      isClassicMode 
        ? "bg-[#000000] border-white/10 shadow-[0_0_50px_rgba(255,255,255,0.05)]" 
        : "bg-[var(--color-surface-variant)] border-[var(--color-outline)] border-opacity-10 shadow-inner"
    )}>
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute top-5 left-8 flex gap-4 items-center">
        <div className={cn(
          "w-2 h-2 rounded-full",
          isClassicMode ? "bg-white animate-pulse" : "bg-[#dfff00]"
        )} />
        <span className={cn(
          "text-[10px] font-black uppercase tracking-[0.2em] transition-opacity",
          isClassicMode ? "text-white opacity-40" : "text-[var(--color-on-surface)] opacity-40"
        )}>
          {isClassicMode ? "Monstercat Protocol v1.2" : "Surgical Spectrum Monitor"}
        </span>
      </div>
    </div>
  );
};

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}

function drawEQCurve(ctx: CanvasRenderingContext2D, width: number, height: number, eq: EQSettings, audioCtx: AudioContext | null) {
  if (!audioCtx) return;
  const numPoints = 120;
  const frequencies = new Float32Array(numPoints);
  for (let i = 0; i < numPoints; i++) {
    frequencies[i] = 20 * Math.pow(20000 / 20, i / (numPoints - 1));
  }
  const low = audioCtx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 60; low.gain.value = eq.sub;
  const bass = audioCtx.createBiquadFilter(); bass.type = 'peaking'; bass.frequency.value = 250; bass.gain.value = eq.bass;
  const mid = audioCtx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1000; mid.gain.value = eq.mid;
  const treble = audioCtx.createBiquadFilter(); treble.type = 'peaking'; treble.frequency.value = 4000; treble.gain.value = eq.treble;
  const air = audioCtx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 12000; air.gain.value = eq.air;
  const mLow = new Float32Array(numPoints);
  const mBass = new Float32Array(numPoints);
  const mMid = new Float32Array(numPoints);
  const mTreble = new Float32Array(numPoints);
  const mAir = new Float32Array(numPoints);
  const phase = new Float32Array(numPoints);
  low.getFrequencyResponse(frequencies, mLow, phase);
  bass.getFrequencyResponse(frequencies, mBass, phase);
  mid.getFrequencyResponse(frequencies, mMid, phase);
  treble.getFrequencyResponse(frequencies, mTreble, phase);
  air.getFrequencyResponse(frequencies, mAir, phase);
  ctx.beginPath();
  ctx.strokeStyle = '#dfff00';
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.6;
  const centerY = height / 2;
  const scale = height / 40;
  for (let i = 0; i < numPoints; i++) {
    const mag = mLow[i] * mBass[i] * mMid[i] * mTreble[i] * mAir[i];
    const db = 20 * Math.log10(mag);
    const x = (i / (numPoints - 1)) * width;
    const y = centerY - db * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.globalAlpha = 1.0;
}

export default StudioVisualizer;
