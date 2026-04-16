import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  onChange: (val: number) => void;
  suffix?: string;
}

export const AudioKnob: React.FC<Props> = ({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  onChange,
  suffix = '%'
}) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const rotation = ((value - min) / (max - min)) * 270 - 135;

  // Bipolar logic: if defaultValue is roughly at the midpoint, we render outward from center
  const range = max - min;
  const midPoint = min + range / 2;
  const isBipolar = defaultValue !== undefined && Math.abs(defaultValue - midPoint) < range * 0.01;

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    knobRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const sensitivity = (max - min) / 400;
    const delta = -e.movementY * sensitivity;
    let newValue = value + delta;
    newValue = Math.max(min, Math.min(max, newValue));
    if (step) newValue = Math.round(newValue / step) * step;
    if (newValue !== value) onChange(newValue);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    knobRef.current?.releasePointerCapture(e.pointerId);
  };

  const handleDoubleClick = () => {
    if (defaultValue !== undefined) onChange(defaultValue);
  };

  // SVG math: 270 degree arc starting at -135deg (7:30)
  const totalLength = 94.24; // 270 degrees on a radius 20 circle
  const progressPercent = (value - min) / (max - min);
  
  let dashArray = `${progressPercent * totalLength} 125.66`;
  let dashOffset = "15.7"; // Aligns with -135deg starting point

  if (isBipolar) {
     const centerPercent = (defaultValue - min) / (max - min);
     const diff = progressPercent - centerPercent;
     dashArray = `${Math.abs(diff) * totalLength} 125.66`;
     // Shift offset based on whether we are left or right of center
     const centerOffset = 15.7 - (centerPercent * totalLength);
     dashOffset = diff > 0 ? `${centerOffset}` : `${centerOffset + (diff * totalLength)}`;
  } else {
     dashOffset = "15.7";
  }

  return (
    <div className="flex flex-col items-center gap-2 select-none group">
      <span className="text-[9px] font-black uppercase tracking-widest opacity-40 group-hover:opacity-100 transition-opacity">
        {label}
      </span>

      <div
        ref={knobRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onDoubleClick={handleDoubleClick}
        className="relative w-14 h-14 cursor-ns-resize flex items-center justify-center transition-all duration-300 suite-glass-subtle rounded-full shadow-lg"
      >
        <svg className="w-12 h-12 transform rotate-[135deg]">
             <circle 
                cx="24" cy="24" r="20" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                className="opacity-5"
                strokeDasharray={`${totalLength} 125.66`}
                strokeDashoffset="0"
             />
             <motion.circle 
                cx="24" cy="24" r="20" 
                fill="none" 
                stroke="var(--color-primary)" 
                strokeWidth="2"
                strokeLinecap="round"
                animate={{
                    strokeDasharray: dashArray,
                    strokeDashoffset: parseFloat(dashOffset)
                }}
                className="opacity-40"
             />
        </svg>

        <motion.div 
            style={{ rotate: rotation }}
            className={cn(
                "absolute inset-0 flex items-center justify-center",
                isDragging ? "opacity-100" : "opacity-60"
            )}
        >
            <div className="h-5 w-1 mb-6 bg-[var(--color-primary)] rounded-full" />
        </motion.div>
        
        <div className="absolute w-8 h-8 rounded-full flex items-center justify-center bg-[#111] shadow-inner">
             <div className="w-1 h-1 rounded-full bg-white opacity-10" />
        </div>
      </div>

      {/* Bottom Value Tooltip */}
      <div className="px-2 py-0.5 min-w-[32px] text-center suite-glass-subtle text-[9px] font-mono opacity-60 rounded-[var(--radius-element)]">
        {value % 1 === 0 ? value : value.toFixed(1)}{suffix}
      </div>
    </div>
  );
};
