import { Clock, User, Trash2, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../utils';

interface Props {
  info: {
    title: string;
    uploader: string;
    duration: number;
    thumbnail: string;
    webpage_url: string;
  };
  onRemove: () => void;
  onCommit: () => void;
  isProcessing: boolean;
  uiMode: 'material' | 'metro';
}

const IngestStage: React.FC<Props> = ({ info, onRemove, onCommit, isProcessing, uiMode }) => {
  const isMetro = uiMode === 'metro';
  return (
    <motion.div
      initial={isMetro ? { opacity: 0, x: 20 } : { opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      exit={isMetro ? { opacity: 0, x: -20 } : { opacity: 0, scale: 0.95, y: -10 }}
      className={cn(
          "p-3 border border-[var(--color-outline)] flex items-center gap-4 group transition-all",
          isMetro ? "bg-black rounded-none shadow-none" : "m3-glass-subtle rounded-3xl shadow-lg border-white/5"
      )}
    >
      <div className={cn(
          "w-20 h-20 overflow-hidden shrink-0 border border-[var(--color-outline)] bg-[var(--color-surface)]/20",
          isMetro ? "rounded-none" : "rounded-2xl shadow-inner"
      )}>
        <img src={info.thumbnail} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" alt="" />
      </div>

      <div className="flex-1 min-w-0 flex flex-col justify-center">
        <h3 className="text-lg font-black uppercase tracking-tighter truncate leading-tight mb-1">{info.title}</h3>
        <div className="flex flex-wrap gap-4 opacity-40">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
            <User className="w-3 h-3" /> {info.uploader}
          </div>
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest">
            <Clock className="w-3 h-3" /> {formatDuration(info.duration)}
          </div>
        </div>
      </div>

      <div className="flex gap-2 shrink-0">
        <button 
          onClick={onRemove}
          disabled={isProcessing}
          className={cn(
              "w-12 h-12 flex items-center justify-center transition-all disabled:opacity-20",
              isMetro ? "bg-red-600 text-white rounded-none" : "bg-red-500/10 text-red-500 rounded-2xl hover:bg-red-500 hover:text-white"
          )}
          title="Discard"
        >
          <Trash2 className="w-5 h-5" />
        </button>
        <button 
          onClick={onCommit}
          disabled={isProcessing}
          className={cn(
              "px-6 h-12 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-20 min-w-[160px]",
              isMetro ? "bg-white text-black rounded-none" : "bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-2xl shadow-xl hover:scale-105 active:scale-95"
          )}
        >
          <Download className="w-4 h-4" /> Queue
        </button>
      </div>
    </motion.div>
  );
};

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const rs = Math.floor(s % 60);
  return `${m}:${rs.toString().padStart(2, '0')}`;
}

export default IngestStage;
