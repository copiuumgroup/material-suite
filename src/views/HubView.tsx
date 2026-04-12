import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { ProjectMetadata } from '../db/database';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Music, ArrowRight, UploadCloud, Activity, CloudDownload, Loader2, CheckCircle2, AlertTriangle, Play, Trash2 } from 'lucide-react';



interface Props {
  onOpenProject: (project: ProjectMetadata) => void;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteProject: (id: number) => void;
}

interface QueueItem {
  id: string;
  url: string;
  title?: string;
  artist?: string;
  status: 'white' | 'teal' | 'green' | 'red';
  error?: string;
}

const HubView: React.FC<Props> = ({ onOpenProject, onUpload, onDeleteProject }) => {
  const [activeTab, setActiveTab] = useState<'local' | 'cloud'>('local');
  const [cloudUrls, setCloudUrls] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRipple, setShowRipple] = useState(false);
  const [useNative, setUseNative] = useState(false);
  const [currentMirror, setCurrentMirror] = useState<string | null>(null);

  const recentProjects = useLiveQuery(() => db.projects.orderBy('lastModified').reverse().limit(10).toArray());

  const handleUnpack = () => {
    const urls = cloudUrls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    const newItems: QueueItem[] = urls.map(url => ({
      id: Math.random().toString(36).substr(2, 9),
      url,
      status: 'white'
    }));
    setQueue([...queue, ...newItems]);
    setCloudUrls('');
  };

  const playSuccessChime = () => {
    const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  };

  const processQueue = async () => {
    setIsProcessing(true);

    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status === 'green') continue;

      const item = queue[i];
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'teal' } : q));

      let retryCount = 0;
      let success = false;

      while (retryCount < 3 && !success) {
        try {
          if (!window.electronAPI) {
            throw new Error('System Link Offline: Native Bridge Not Found');
          }

          if (useNative) {
            const res = await window.electronAPI.ytdlpDownload(item.url);
            if (!res.success) throw new Error(res.error);
            success = true;
          } else {
            const apiResult = await window.electronAPI.cobaltApiCall(item.url);
            if (!apiResult.success) throw new Error(apiResult.error);

            setCurrentMirror(apiResult.mirror || 'Cloud Instance');
            const downloadUrl = apiResult.url!;
            const result = await window.electronAPI.downloadWithMetadata(downloadUrl, {
              title: item.url.split('/').pop()?.split('?')[0] || 'Cloud Track',
              artist: 'Cobalt Ingest',
            });
            if (!result.success) throw new Error(result.error);
            success = true;
          }

          if (success) {
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'green' } : q));
          }
        } catch (e: any) {
          retryCount++;
          if (retryCount >= 3) {
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'red', error: e.message } : q));
          }
        }
      }
    }

    setIsProcessing(false);
    playSuccessChime();
    setShowRipple(true);
    setTimeout(() => setShowRipple(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col gap-16 py-12 px-10 overflow-x-hidden relative"
    >
      {showRipple && (
        <motion.div
          initial={{ scale: 0, opacity: 0.5 }}
          animate={{ scale: 4, opacity: 0 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[var(--color-primary)] rounded-full z-50 pointer-events-none"
        />
      )}

      {/* Dynamic Header */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 px-3 py-1 bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] rounded-full w-fit">
            <Activity className="w-3 h-3" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-primary-container)]">Mastering Suite v2.0</span>
          </div>
          <h1 className="text-7xl font-black tracking-tighter uppercase leading-[0.8] text-[var(--color-on-surface)]">
            Studio<br /><span className="text-[var(--color-primary)] opacity-40 italic">Archives</span>
          </h1>
        </div>

        <div className="flex gap-4 p-2 bg-[var(--color-surface-variant)] rounded-2xl border border-white/5">
          <button onClick={() => setActiveTab('local')} className={cn("px-6 py-2 rounded-xl text-xs font-black uppercase transition-all", activeTab === 'local' ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-lg" : "opacity-40 hover:opacity-100")}>Local Storage</button>
          <button onClick={() => setActiveTab('cloud')} className={cn("px-6 py-2 rounded-xl text-xs font-black uppercase transition-all", activeTab === 'cloud' ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-lg" : "opacity-40 hover:opacity-100")}>Cobalt Cloud</button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-10 min-h-0">

        {/* LEFT PANEL */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-6 h-full">
          <AnimatePresence mode="wait">
            {activeTab === 'local' ? (
              <motion.label
                key="local"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="group relative w-full flex-1 my-card bg-[var(--color-surface-variant)] flex flex-col items-center justify-center gap-8 cursor-pointer hover:border-[var(--color-primary)] transition-all duration-700 overflow-hidden shadow-2xl min-h-[400px]"
              >
                <input type="file" accept="audio/*" multiple className="hidden" onChange={onUpload} />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[var(--color-primary)] opacity-[0.03] blur-[100px] group-hover:opacity-[0.1] transition-opacity duration-1000" />
                <motion.div whileHover={{ scale: 1.05, rotate: -3 }} className="w-28 h-28 rounded-[24px] bg-[var(--color-primary)] text-[var(--color-on-primary)] flex items-center justify-center shadow-[0_20px_60px_rgba(0,0,0,0.3)] relative z-10">
                  <UploadCloud className="w-12 h-12" />
                </motion.div>
                <div className="text-center relative z-10">
                  <h2 className="text-4xl font-black uppercase tracking-tighter leading-tight text-[var(--color-on-surface)]">Mastering<br />Initialization</h2>
                  <p className="text-xs opacity-40 mt-4 font-bold uppercase tracking-[0.2em] text-[var(--color-on-surface)]">Drop files to start rendering</p>
                </div>
              </motion.label>
            ) : (
              <motion.div
                key="cloud"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col gap-6 flex-1 h-full"
              >
                <div className="my-card bg-[var(--color-surface-variant)] p-8 flex flex-col gap-6 flex-1">
                  <div className="flex items-center justify-between text-[var(--color-primary)]">
                    <div className="flex items-center gap-4">
                      <CloudDownload className="w-8 h-8" />
                      <h2 className="text-2xl font-black uppercase tracking-tighter text-[var(--color-on-surface)]">Cloud Ingest</h2>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-black uppercase opacity-40">Native Engine</span>
                      <button
                        onClick={() => setUseNative(!useNative)}
                        className={cn(
                          "w-12 h-6 rounded-full relative transition-all duration-500 border border-white/10",
                          useNative ? "bg-[var(--color-primary)]" : "bg-white/5"
                        )}
                      >
                        <motion.div
                          animate={{ x: useNative ? 24 : 2 }}
                          className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-lg"
                        />
                      </button>
                    </div>
                  </div>

                  {currentMirror && !useNative && (
                    <div className="px-4 py-2 bg-white/5 rounded-xl border border-white/5 flex items-center gap-3">
                      <Activity className="w-3 h-3 text-[var(--color-primary)] animate-pulse" />
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Connected: {currentMirror}</span>
                    </div>
                  )}

                  <textarea
                    value={cloudUrls}
                    onChange={(e) => setCloudUrls(e.target.value)}
                    placeholder="https://soundcloud.com/artist/track..."
                    className="flex-1 bg-black/20 rounded-2xl p-6 font-mono text-xs focus:ring-2 focus:ring-[var(--color-primary)] outline-none resize-none border border-white/5 text-[var(--color-on-surface)]"
                  />
                  <div className="flex gap-4">
                    <button onClick={handleUnpack} disabled={!cloudUrls} className="flex-1 my-button font-black uppercase tracking-widest disabled:opacity-20 hover:bg-[var(--color-primary)] hover:text-[var(--color-on-primary)]">Unpack Links</button>
                    <button onClick={processQueue} disabled={queue.length === 0 || isProcessing} className="flex-1 my-button my-button-primary font-black uppercase tracking-widest disabled:opacity-20 flex items-center gap-3">
                      {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                      Run Batch
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT PANEL */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-6 min-h-0">
          <div className="flex items-center gap-4 px-2">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 text-[var(--color-on-surface)]">
              {activeTab === 'local' ? 'Recent Archives' : 'Production Queue'}
            </h2>
            <div className="flex-1 h-[1px] bg-[var(--color-outline)] opacity-10" />
          </div>

          <div className="flex-1 my-card bg-[var(--color-surface-variant)] p-6 overflow-y-auto custom-scrollbar flex flex-col gap-4">
            {activeTab === 'local' ? (
              <>
                {recentProjects && recentProjects.length > 0 ? (
                  <AnimatePresence>
                    {recentProjects.map((project: ProjectMetadata, idx: number) => (
                      <motion.div
                        key={project.id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.1, ease: [0.2, 0.8, 0.2, 1] }}
                        onClick={() => onOpenProject(project)}
                        className={cn(
                          "group relative p-6 bg-[var(--color-surface)] rounded-3xl flex items-center gap-6 cursor-pointer overflow-hidden border border-white/5 hover:bg-[var(--color-primary)] transition-all",
                          idx % 3 === 0 ? "md:col-span-2" : ""
                        )}
                      >
                        <div className="w-16 h-16 rounded-[16px] overflow-hidden shadow-2xl relative bg-black/20">
                          {project.coverArt ? (
                            <img src={project.coverArt} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-neutral-800 to-black">
                              <Music className="w-6 h-6 text-white/40" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xl font-black uppercase tracking-tighter truncate group-hover:text-[var(--color-on-primary)]">{project.name}</p>
                          <p className="text-[10px] font-bold opacity-30 group-hover:text-[var(--color-on-primary)] group-hover:opacity-60">{new Date(project.lastModified).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onDeleteProject && project.id) onDeleteProject(project.id);
                            }}
                            className="p-3 rounded-2xl bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                          <ArrowRight className="w-5 h-5 opacity-0 group-hover:opacity-100 group-hover:translate-x-0 -translate-x-4 transition-all" />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-20 text-[var(--color-on-surface)]">
                    <Plus className="w-12 h-12 mb-4" />
                    <p className="text-sm font-black uppercase tracking-[0.2em]">No Recent Projects</p>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-3">
                {queue.length === 0 && (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-20 text-[var(--color-on-surface)]">
                    <CloudDownload className="w-12 h-12 mb-4" />
                    <p className="text-sm font-black uppercase tracking-[0.2em]">Queue is Empty</p>
                  </div>
                )}
                {queue.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
                    className={cn(
                      "p-4 rounded-2xl flex items-center gap-4 border transition-all duration-800",
                      item.status === 'white' && "bg-white/5 border-white/10",
                      item.status === 'teal' && "bg-white/20 border-white/40 animate-pulse",
                      item.status === 'green' && "bg-white/10 border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]",
                      item.status === 'red' && "status-error" // Keep red for failures
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                      item.status === 'white' ? "bg-white/5" : "bg-white/20"
                    )}>
                      {item.status === 'white' && <Music className="w-4 h-4 opacity-20" />}
                      {item.status === 'teal' && <Loader2 className="w-4 h-4 animate-spin" />}
                      {item.status === 'green' && <CheckCircle2 className="w-4 h-4 text-white" />}
                      {item.status === 'red' && <AlertTriangle className="w-4 h-4 text-[#ffdad6]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black uppercase tracking-tight truncate text-[var(--color-on-surface)]">{item.url}</p>
                      {item.error && <p className="text-[8px] text-red-500 font-bold uppercase truncate">{item.error}</p>}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </motion.div>
  );
};

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}

export default HubView;
