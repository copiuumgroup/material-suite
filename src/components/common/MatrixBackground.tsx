import React, { useEffect, useRef } from 'react';

interface Star {
  x: number; y: number;
  vx: number; vy: number;
  r: number; phase: number;
  alpha: number;
}

const MatrixBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let time = 0;
    let stars: Star[] = [];
    let currentColor = '#ffffff';
    let width = 0, height = 0;

    const updateThemeColor = () => {
      const style = getComputedStyle(document.documentElement);
      currentColor = style.getPropertyValue('--color-on-surface').trim() || '#ffffff';
    };

    const generateStars = () => {
      stars = [];
      // ~1 star per 5000px² — spacious and clean
      const count = Math.floor((width * height) / 5000);
      for (let i = 0; i < count; i++) {
        stars.push({
          x: Math.random() * width,
          y: Math.random() * height,
          // Gentle drift — imperceptibly slow
          vx: (Math.random() - 0.5) * 0.12,
          vy: (Math.random() - 0.5) * 0.12,
          r: Math.random() * 1.4 + 0.3,
          phase: Math.random() * Math.PI * 2,
          alpha: Math.random() * 0.055 + 0.015,
        });
      }
    };

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      generateStars();
      updateThemeColor();
    };

    // React to theme changes without re-running the whole effect
    const observer = new MutationObserver(() => updateThemeColor());
    observer.observe(document.documentElement, { attributes: true });

    window.addEventListener('resize', resize);
    resize();

    const draw = () => {
      time += 0.006;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = currentColor;

      for (const star of stars) {
        // Drift + wrap
        star.x += star.vx;
        star.y += star.vy;
        if (star.x < 0) star.x = width;
        if (star.x > width) star.x = 0;
        if (star.y < 0) star.y = height;
        if (star.y > height) star.y = 0;

        // Gentle twinkle — slow sine on opacity
        const twinkle = Math.sin(time + star.phase) * 0.012;
        ctx.globalAlpha = Math.max(0.008, star.alpha + twinkle);

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
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
      style={{ willChange: 'transform' }}
    />
  );
};

export default MatrixBackground;
