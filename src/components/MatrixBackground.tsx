import React, { useEffect, useRef } from 'react';

const MatrixBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;

    // Fixed High-Resolution Overlap (Covers up to 5K/8K displays)
    const gridSize = 5000; 
    const spacing = 45; 
    const dots: { x: number; y: number; baseR: number; phase: number; jitterSeed: number }[] = [];
    
    const cols = Math.ceil(gridSize / spacing);
    const rows = Math.ceil((gridSize / 1.77) / spacing); // 16:9 aspect ratio room

    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        dots.push({
          x: i * spacing,
          y: j * spacing,
          baseR: Math.random() * 2 + 0.5,
          phase: Math.random() * Math.PI * 2,
          jitterSeed: Math.random()
        });
      }
    }

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', resize);
    resize();

    const drawMorphShape = (x: number, y: number, r: number, morph: number) => {
        ctx.beginPath();
        const segments = 24;
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const cx = Math.cos(angle);
            const cy = Math.sin(angle);
            const dFactor = 1 / (Math.abs(cx) + Math.abs(cy));
            const dx = cx * dFactor;
            const dy = cy * dFactor;
            const rx = (cx * (1 - morph) + dx * morph) * r;
            const ry = (cy * (1 - morph) + dy * morph) * r;
            if (i === 0) ctx.moveTo(x + rx, y + ry);
            else ctx.lineTo(x + rx, y + ry);
        }
        ctx.closePath();
        ctx.fill();
    };

    const draw = () => {
      time += 0.0035;
      const isDark = !document.documentElement.classList.contains('light');
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Center-relative offsets
      const gridWidth = cols * spacing;
      const gridHeight = rows * spacing;
      const offsetX = (canvas.width - gridWidth) / 2;
      const offsetY = (canvas.height - gridHeight) / 2;

      // Organic Lens with Aberration Jitter
      const jitter = Math.sin(time * 50) * 2;
      const lensX = (canvas.width / 2 + Math.cos(time * 1.1) * (canvas.width / 3.5)) + jitter;
      const lensY = (canvas.height / 2 + Math.sin(time * 0.8) * (canvas.height / 3.5)) + jitter;
      const lensRadius = 380;

      ctx.fillStyle = isDark ? '#ffffff' : '#000000';

      dots.forEach(dot => {
        const realX = dot.x + offsetX;
        const realY = dot.y + offsetY;
        
        // Skip drawing if outside viewport for performance
        if (realX < -spacing || realX > canvas.width + spacing || realY < -spacing || realY > canvas.height + spacing) {
            return;
        }

        const dx = realX - lensX;
        const dy = realY - lensY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        let tx = realX;
        let ty = realY;
        
        const force = Math.max(0, (lensRadius - dist) / lensRadius);
        if (dist < lensRadius) {
            tx += dx * force * 1.3;
            ty += dy * force * 1.3;
        }

        const proximity = Math.pow(force, 1.8);
        const outerNoise = (1 - force) * Math.sin(time * 15 + dot.phase * 10) * dot.jitterSeed * 2.5;
        const currentR = (dot.baseR + proximity * 8) + outerNoise;
        const morph = Math.min(1, proximity * 2.2);

        ctx.globalAlpha = 0.05 + proximity * 0.9 + (1 - force) * dot.jitterSeed * 0.1;
        drawMorphShape(tx, ty, Math.max(0.5, currentR), morph);
      });

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ filter: isNaN((window as any).devicePixelRatio) ? 'none' : `contrast(1.2) brightness(${document.documentElement.classList.contains('light') ? 1.0 : 1.2})` }}
    />
  );
};

export default MatrixBackground;
