import React from 'react';
import { motion } from 'framer-motion';

interface Props {
  vocalPos: { x: number; y: number; z: number };
  instrumentalPos: { x: number; y: number; z: number };
  onPosChange: (type: 'vocal' | 'instrumental', pos: { x: number; y: number; z: number }) => void;
  isEnabled: boolean;
}

const SpatialStage: React.FC<Props> = ({ vocalPos, instrumentalPos, onPosChange, isEnabled }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleDrag = (type: 'vocal' | 'instrumental', _e: any, info: any) => {
    if (!isEnabled || !containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const x = ((info.point.x - bounds.left) / bounds.width) * 2 - 1;
    const z = ((info.point.y - bounds.top) / bounds.height) * 2 - 1;
    
    const current = type === 'vocal' ? vocalPos : instrumentalPos;
    onPosChange(type, { ...current, x, z });
  };

  return (
    <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center mb-1">
            <span className="text-[9px] font-black uppercase tracking-widest opacity-40">3D Immersive Stage</span>
            <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                <div className="w-2 h-2 rounded-full bg-amber-400" />
            </div>
        </div>
        
        <div 
          ref={containerRef}
          className="relative aspect-square border border-[var(--color-outline)] suite-glass-deep rounded-[var(--radius-element)] overflow-hidden bg-[radial-gradient(circle_at_center,rgba(var(--color-primary-rgb),0.1)_0%,transparent_70%)] shadow-inner"
        >
            {/* Grid Helper */}
            <div className="absolute inset-0 grid grid-cols-4 grid-rows-4 opacity-5 pointer-events-none">
                {[...Array(16)].map((_, i) => <div key={i} className="border border-[var(--color-outline)]" />)}
            </div>

            {/* Listener Icon (Center) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[var(--color-on-surface)] opacity-20" />
                <div className="absolute inset-0 border border-[var(--color-on-surface)] rounded-full opacity-10 animate-ping" />
            </div>

            {/* Vocal Node */}
            <motion.div 
              drag
              dragConstraints={containerRef}
              dragElastic={0}
              onDrag={(e, i) => handleDrag('vocal', e, i)}
              style={{
                x: (vocalPos.x + 1) * 50 + "%",
                y: (vocalPos.z + 1) * 50 + "%",
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 suite-glass-subtle bg-cyan-500/80 border border-cyan-400/50 rounded-full cursor-grab active:cursor-grabbing shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center justify-center z-20"
            >
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="absolute -bottom-4 text-[7px] font-black uppercase tracking-tighter text-cyan-500">VOX</span>
            </motion.div>

            {/* Instrumental Node */}
            <motion.div 
              drag
              dragConstraints={containerRef}
              dragElastic={0}
              onDrag={(e, i) => handleDrag('instrumental', e, i)}
              style={{
                x: (instrumentalPos.x + 1) * 50 + "%",
                y: (instrumentalPos.z + 1) * 50 + "%",
              }}
              className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 suite-glass-subtle bg-amber-500/80 border border-amber-400/50 rounded-full cursor-grab active:cursor-grabbing shadow-[0_0_15px_rgba(245,158,11,0.4)] flex items-center justify-center z-10"
            >
                <div className="w-1.5 h-1.5 rounded-full bg-white" />
                <span className="absolute -bottom-4 text-[7px] font-black uppercase tracking-tighter text-amber-500">INST</span>
            </motion.div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="p-2 border border-[var(--color-outline)] suite-glass-subtle rounded-[var(--radius-element)] flex flex-col gap-1">
                <span className="text-[7px] font-black uppercase opacity-30">Vocal Elevation</span>
                <input 
                  type="range" min="-1" max="1" step="0.01" value={vocalPos.y} 
                  onChange={(e) => onPosChange('vocal', { ...vocalPos, y: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-500 opacity-50 hover:opacity-100"
                />
            </div>
            <div className="p-2 border border-[var(--color-outline)] suite-glass-subtle rounded-[var(--radius-element)] flex flex-col gap-1">
                <span className="text-[7px] font-black uppercase opacity-30">Inst Elevation</span>
                <input 
                  type="range" min="-1" max="1" step="0.01" value={instrumentalPos.y} 
                  onChange={(e) => onPosChange('instrumental', { ...instrumentalPos, y: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 opacity-50 hover:opacity-100"
                />
            </div>
        </div>
    </div>
  );
};

export default SpatialStage;
