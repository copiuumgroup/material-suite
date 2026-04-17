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
  disabled?: boolean;
}

export const AudioKnob: React.FC<Props> = ({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue,
  onChange,
  suffix = '%',
  disabled = false
}) => {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  const rotation = ((value - min) / (max - min)) * 270 - 135;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
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
        className={cn(
          "relative w-14 h-14 cursor-ns-resize flex items-center justify-center transition-all duration-300 suite-glass-subtle rounded-full shadow-lg",
          disabled && "opacity-20 grayscale pointer-events-none"
        )}
      >
        <svg className="w-12 h-12 transform rotate-[135deg]">
              <circle 
                cx="24" cy="24" r="20" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                className="opacity-10"
                strokeDasharray="94.24 125.66"
                strokeDashoffset="0"
             />
        </svg>

        <motion.div 
            style={{ rotate: rotation }}
            className={cn(
                "absolute inset-0 flex items-center justify-center",
                isDragging ? "opacity-100 drop-shadow-[0_0_4px_var(--color-primary)]" : "opacity-100"
            )}
        >
            <div className="h-4 w-1.5 mb-6 bg-[var(--color-primary)] rounded-full shadow-lg" />
        </motion.div>
        
        <div className="absolute w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-surface-variant)] border border-[var(--color-outline)] shadow-xl">
             <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] opacity-40 shadow-[0_0_4px_currentColor]" />
        </div>
      </div>

      {/* Bottom Value Tooltip */}
      <div className="px-2 py-0.5 min-w-[32px] text-center suite-glass-subtle text-[9px] font-mono opacity-60 rounded-[var(--radius-element)]">
        {value % 1 === 0 ? value : value.toFixed(1)}{suffix}
      </div>
    </div>
  );
};
