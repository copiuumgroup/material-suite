import { Clock, User, Trash2, Download } from 'lucide-react';
import { motion } from 'framer-motion';

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
}

const IngestStage: React.FC<Props> = ({ info, onRemove, onCommit, isProcessing }) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -10 }}
      className="p-3 border border-[var(--color-outline)] flex items-center gap-4 group transition-all suite-glass-subtle rounded-[var(--radius-container)] shadow-lg border-white/5"
    >
      <div className="w-20 h-20 overflow-hidden shrink-0 border border-[var(--color-outline)] bg-[var(--color-surface)]/20 rounded-[var(--radius-element)] shadow-inner">
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
          className="w-12 h-12 flex items-center justify-center transition-all disabled:opacity-20 bg-red-500/10 text-red-500 rounded-[var(--radius-element)] hover:bg-red-500 hover:text-white"
          title="Discard"
        >
          <Trash2 className="w-5 h-5" />
        </button>
        <button 
          onClick={onCommit}
          disabled={isProcessing}
          className="px-6 h-12 flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-20 min-w-[160px] bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-[var(--radius-element)] shadow-xl hover:scale-105 active:scale-95"
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
