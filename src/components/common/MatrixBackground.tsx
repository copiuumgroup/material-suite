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
    const spacing = 48; // Slightly larger spacing for fewer dots
    let dots: { x: number; y: number; baseR: number; phase: number; jitterSeed: number }[] = [];
    let currentColor = '#ffffff';

    // Pre-calculate segments for morph shape (12 segments and simple circle)
    const segments = 12;
    const angleStep = (Math.PI * 2) / segments;
    const precalc: { cx: number; cy: number; dx: number; dy: number }[] = [];
    for (let i = 0; i < segments; i++) {
      const angle = i * angleStep;
      const cx = Math.cos(angle);
      const cy = Math.sin(angle);
      const dFactor = 1 / (Math.abs(cx) + Math.abs(cy));
      precalc.push({ cx, cy, dx: cx * dFactor, dy: cy * dFactor });
    }

    const updateThemeColor = () => {
      const isDark = !document.documentElement.classList.contains('light');
      const style = getComputedStyle(document.documentElement);
      currentColor = style.getPropertyValue('--color-on-surface').trim() || (isDark ? '#ffffff' : '#000000');
    };

    const generateDots = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cols = Math.ceil(w / spacing) + 2;
      const rows = Math.ceil(h / spacing) + 2;

      dots = [];
      for (let i = -1; i < cols; i++) {
        for (let j = -1; j < rows; j++) {
          dots.push({
            x: i * spacing,
            y: j * spacing,
            baseR: Math.random() * 1.5 + 0.5,
            phase: Math.random() * Math.PI * 2,
            jitterSeed: Math.random()
          });
        }
      }
    };

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      generateDots();
      updateThemeColor();
    };

    // Observer for theme changes to update color without reflow in loop
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          updateThemeColor();
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });

    window.addEventListener('resize', resize);
    resize();

    const drawMorphShape = (x: number, y: number, r: number, morph: number) => {
      ctx.beginPath();
      for (let i = 0; i < segments; i++) {
        const p = precalc[i];
        const rx = (p.cx * (1 - morph) + p.dx * morph) * r;
        const ry = (p.cy * (1 - morph) + p.dy * morph) * r;
        if (i === 0) ctx.moveTo(x + rx, y + ry);
        else ctx.lineTo(x + rx, y + ry);
      }
      ctx.closePath();
      ctx.fill();
    };

    const draw = () => {
      time += 0.0035;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const lensX = canvas.width / 2 + Math.cos(time * 1.1) * (canvas.width / 3.5);
      const lensY = canvas.height / 2 + Math.sin(time * 0.8) * (canvas.height / 3.5);
      const lensRadius = 380;

      ctx.fillStyle = currentColor;

      for (let i = 0; i < dots.length; i++) {
        const dot = dots[i];
        const dx = dot.x - lensX;
        const dy = dot.y - lensY;
        const distSq = dx * dx + dy * dy;

        let tx = dot.x;
        let ty = dot.y;

        if (distSq < lensRadius * lensRadius) {
          const dist = Math.sqrt(distSq);
          const force = (lensRadius - dist) / lensRadius;
          const push = force * 1.3;
          tx += dx * push;
          ty += dy * push;

          const proximity = Math.pow(force, 1.8);
          const morph = Math.min(1, proximity * 2.2);
          const currentR = dot.baseR + proximity * 8;

          ctx.globalAlpha = 0.05 + proximity * 0.9;
          drawMorphShape(tx, ty, currentR, morph);
        } else {
          // Static/Ambient dots are just circles for performance
          const outerNoise = Math.sin(time * 15 + dot.phase * 10) * dot.jitterSeed * 1.5;
          ctx.globalAlpha = 0.05 + dot.jitterSeed * 0.05;
          ctx.beginPath();
          ctx.arc(tx, ty, Math.max(0.5, dot.baseR + outerNoise), 0, Math.PI * 2);
          ctx.fill();
        }
      }

      ctx.globalAlpha = 1.0;
      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', resize);
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{
        filter: 'contrast(1.1) brightness(1.1)',
        willChange: 'transform'
      }}
    />
  );
};

export default MatrixBackground;
