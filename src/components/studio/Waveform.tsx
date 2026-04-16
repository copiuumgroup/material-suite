import React, { useEffect, useRef, useMemo } from 'react';

interface WaveformProps {
  buffer: AudioBuffer | null;
  currentTime: number;
  duration: number;
  onSeek?: (time: number) => void;
}

const Waveform: React.FC<WaveformProps> = ({ buffer, currentTime, duration, onSeek }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const peaks = useMemo(() => {
    if (!buffer) return [];
    const rawData = buffer.getChannelData(0); 
    const samples = 300; 
    const blockSize = Math.floor(rawData.length / samples);
    const result = [];

    for (let i = 0; i < samples; i++) {
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const val = Math.abs(rawData[i * blockSize + j]);
        if (val > max) max = val;
      }
      result.push(Math.pow(max, 0.7)); 
    }
    return result;
  }, [buffer]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth * dpr;
    const height = canvas.clientHeight * dpr;
    
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    
    ctx.clearRect(0, 0, width, height);
    if (peaks.length === 0) return;

    const barWidth = (width / peaks.length) * 0.6;
    const barGap = (width / peaks.length) * 0.4;
    const centerY = height / 2;

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#fff';
    const outlineColor = getComputedStyle(document.documentElement).getPropertyValue('--outline').trim() || 'rgba(255,255,255,0.1)';

    peaks.forEach((peak, i) => {
      const x = i * (barWidth + barGap);
      const barHeight = Math.max(2, peak * height * 0.8);
      const isPlayed = (i / peaks.length) < (currentTime / duration);
      
      ctx.fillStyle = isPlayed ? primaryColor : outlineColor;
      ctx.globalAlpha = isPlayed ? 1 : 0.3;
      
      const r = barWidth / 2;
      ctx.beginPath();
      ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, r);
      ctx.fill();
    });
  };

  useEffect(() => {
    draw();
  }, [peaks, currentTime, duration]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!onSeek || !canvasRef.current || duration === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    onSeek(ratio * duration);
  };

  return (
    <div className="w-full h-full relative cursor-pointer" onPointerDown={handlePointerDown}>
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
};

export default Waveform;
