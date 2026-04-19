import React, { useEffect, useRef } from 'react';

interface Props {
  analyser: AnalyserNode | null;
  audioCtx: AudioContext | null;
}

const StudioVisualizer: React.FC<Props> = ({ analyser }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(null);
  const smoothedHeights = useRef<number[]>(new Array(64).fill(0));

  useEffect(() => {
    if (!canvasRef.current || !analyser) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let currentColor = '#ffffff';
    const updateColor = () => {
      currentColor = getComputedStyle(document.documentElement).getPropertyValue('--color-on-surface').trim() || '#fff';
    };
    updateColor();

    const observer = new MutationObserver(updateColor);
    observer.observe(document.documentElement, { attributes: true });

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, width, height);

      const barCount = 48;
      const totalPad = 4;
      const barWidth = (width - (barCount * totalPad)) / barCount;

      ctx.fillStyle = currentColor;
      for (let i = 0; i < barCount; i++) {
        const percent = i / barCount;
        const sampleIdx = Math.floor(Math.pow(percent, 1.3) * bufferLength * 0.6);
        const rawHeight = (dataArray[sampleIdx] / 255) * height * 0.9;

        smoothedHeights.current[i] += (rawHeight - smoothedHeights.current[i]) * 0.2;
        const h = Math.max(2, smoothedHeights.current[i]);
        const x = i * (barWidth + totalPad) + totalPad;

        ctx.globalAlpha = 0.8;
        ctx.beginPath();
        const r = barWidth / 2;
        ctx.roundRect(x, height - h, barWidth, h, [r, r, 0, 0]);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      rafRef.current = requestAnimationFrame(render);
    };

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
    };
    window.addEventListener('resize', resize);
    resize();

    render();
    return () => {
      window.removeEventListener('resize', resize);
      observer.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [analyser]);

  return (
    <div className="w-full h-full relative">
      <canvas ref={canvasRef} className="w-full h-full opacity-60" />
    </div>
  );
};

export default StudioVisualizer;
