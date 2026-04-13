import React from 'react';
import { Clock, User, Globe, Trash2, Download } from 'lucide-react';
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
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -20 }}
      className="p-6 bg-[var(--color-surface)] rounded-[32px] border border-white/5 shadow-2xl flex flex-col gap-6"
    >
      <div className="flex gap-6">
        <div className="w-32 h-32 rounded-2xl overflow-hidden shadow-lg shrink-0 bg-black/20">
          <img src={info.thumbnail} className="w-full h-full object-cover" alt="" />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <h3 className="text-2xl font-black uppercase tracking-tighter truncate leading-tight mb-2">{info.title}</h3>
          <div className="flex flex-wrap gap-4 opacity-40">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase">
              <User className="w-3 h-3" /> {info.uploader}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase">
              <Clock className="w-3 h-3" /> {formatDuration(info.duration)}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase">
              <Globe className="w-3 h-3" /> Source Verified
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button 
          onClick={onRemove}
          disabled={isProcessing}
          className="flex-1 py-4 bg-red-500/10 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-3 disabled:opacity-20"
        >
          <Trash2 className="w-4 h-4" /> Discard
        </button>
        <button 
          onClick={onCommit}
          disabled={isProcessing}
          className="flex-[2] py-4 bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-20"
        >
          <Download className="w-4 h-4" /> Move to Production
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
