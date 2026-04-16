import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { ProjectMetadata } from '../db/database';
import { motion } from 'framer-motion';
import { Plus, Music, Trash2, Database } from 'lucide-react';

interface Props {
  onOpenProject: (project: ProjectMetadata) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteProject: (id: number) => void;
}

const VaultView: React.FC<Props> = ({ onOpenProject, onUpload, onDeleteProject }) => {
  const library = useLiveQuery(() => db.projects.orderBy('lastModified').reverse().toArray());

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="flex-1 flex flex-col gap-10 py-12 px-10 overflow-hidden relative"
    >
      <div className="flex justify-between items-end shrink-0 relative z-10">
        <div className="flex flex-col gap-2">
          <h1 className="font-black tracking-tighter uppercase leading-[0.7] text-[var(--color-on-surface)] select-none text-7xl">
            Material<br /><span className="text-[var(--color-primary)] opacity-20 italic">Vault</span>
          </h1>
          <span className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40 ml-1">Local Production Archive</span>
        </div>

        <label className="suite-button suite-button-primary cursor-pointer">
          <Plus className="w-4 h-4" /> Import Source
          <input type="file" accept="audio/*,video/*" multiple className="hidden" onChange={onUpload} />
        </label>
      </div>

      <div className="flex-1 p-10 overflow-y-auto custom-scrollbar border border-[var(--color-outline)] relative z-10 suite-glass-subtle rounded-[var(--radius-container)] shadow-2xl">
        <div className="flex items-center gap-4 mb-8 px-2">
            <h2 className="text-3xl font-black uppercase tracking-tighter">Collection</h2>
            <div className="suite-chip opacity-40">{library?.length || 0} ITEMS</div>
        </div>

        {library && library.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {library.map((project) => (
              <motion.div 
                key={project.id} 
                whileHover={{ scale: 1.02 }}
                onClick={() => onOpenProject(project)} 
                className="p-5 border border-[var(--color-outline)] flex items-center gap-5 cursor-pointer transition-all group relative overflow-hidden suite-glass-subtle rounded-[var(--radius-container)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)]/10 duration-500"
              >
                <div className="w-20 h-20 flex-shrink-0 overflow-hidden border border-[var(--color-outline)] rounded-[var(--radius-element)] shadow-2xl bg-[var(--color-surface)]/20">
                  {project.coverArt ? (
                    <img src={project.coverArt} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-8 h-8 opacity-10" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-black uppercase tracking-tight truncate mb-1">{project.name}</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest truncate opacity-30">{project.artist || 'Unknown Origin'}</p>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDeleteProject(project.id!); }} 
                  className="w-12 h-12 flex items-center justify-center transition-all rounded-[var(--radius-element)] opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-500"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center opacity-10 text-center">
              <Database className="w-32 h-32 mb-8 stroke-[1]" />
              <h3 className="text-3xl font-black uppercase tracking-tighter">Vault Empty</h3>
              <p className="text-sm font-bold uppercase tracking-[0.2em] mt-2">Initialize your local production database</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default VaultView;
