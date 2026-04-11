import React, { useEffect, useRef, useMemo } from 'react';

interface WaveformProps {
  buffer: AudioBuffer | null;
  currentTime: number;
  duration: number;
  onSeek?: (time: number) => void;
}

const Waveform: React.FC<WaveformProps> = ({ buffer, currentTime, duration, onSeek }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Pre-calculate peaks for rendering efficiency
  const peaks = useMemo(() => {
    if (!buffer) return [];
    
    const rawData = buffer.getChannelData(0); 
    const samples = 600; // Increased density
    const blockSize = Math.floor(rawData.length / samples);
    const result = [];

    for (let i = 0; i < samples; i++) {
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const val = Math.abs(rawData[i * blockSize + j]);
        if (val > max) max = val;
      }
      // Apply a slight gain to peaks for better visibility
      result.push(Math.pow(max, 0.8)); 
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

    const barWidth = (width / peaks.length) * 0.7;
    const barGap = (width / peaks.length) * 0.3;
    const centerY = height / 2;

    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-primary').trim() || '#222';
    const playedColor = getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-on-surface').trim() || '#000';
    const surfaceColor = getComputedStyle(document.documentElement).getPropertyValue('--md-sys-color-surface-variant').trim() || '#ccc';

    peaks.forEach((peak, i) => {
      const x = i * (barWidth + barGap);
      const barHeight = Math.max(4, peak * height * 0.9); // Ensure minimum visibility
      
      const isPlayed = (i / peaks.length) < (currentTime / duration);
      
      ctx.fillStyle = isPlayed ? playedColor : surfaceColor;
      
      const r = barWidth / 2;
      ctx.beginPath();
      ctx.roundRect(x, centerY - barHeight / 2, barWidth, barHeight, r);
      ctx.fill();
    });

    // Playhead line
    const playheadX = (currentTime / duration) * width;
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
  };

  useEffect(() => {
    draw();
  }, [peaks, currentTime, duration]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (!onSeek || !canvasRef.current || duration === 0) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = x / rect.width;
    onSeek(ratio * duration);
  };

  return (
    <div className="w-full h-48 my-card p-0 overflow-hidden relative group cursor-pointer" onPointerDown={handlePointerDown}>
      <canvas 
        ref={canvasRef} 
        width={800} 
        height={200} 
        className="w-full h-full"
      />
      
      {/* Time indicators */}
      <div className="absolute bottom-2 left-4 text-xs font-mono opacity-60 pointer-events-none">
        {formatTime(currentTime)}
      </div>
      <div className="absolute bottom-2 right-4 text-xs font-mono opacity-60 pointer-events-none">
        {formatTime(duration)}
      </div>
    </div>
  );
};

function formatTime(s: number) {
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default Waveform;
