import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import type { ProjectMetadata } from '../db/database';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Music, ArrowRight, UploadCloud, Activity, CloudDownload, Loader2, CheckCircle2, AlertTriangle, Play, Trash2, Terminal } from 'lucide-react';



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
  status: 'idle' | 'processing' | 'success' | 'error';
  error?: string;
}

const HubView: React.FC<Props> = ({ onOpenProject, onUpload, onDeleteProject }) => {
  const [activeTab, setActiveTab] = useState<'local' | 'cloud'>('local');
  const [cloudUrls, setCloudUrls] = useState('');
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRipple, setShowRipple] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [consoleFontSize, setConsoleFontSize] = useState(13);
  const [overallProgress, setOverallProgress] = useState(0);
  const [ingestQuality, setIngestQuality] = useState<'mp3' | 'wav'>('mp3');
  const logEndRef = React.useRef<HTMLDivElement>(null);
  const isCancelledRef = React.useRef(false);

  React.useEffect(() => {
    if (window.electronAPI) {
      const cleanup = window.electronAPI.onYtdlpLog((data) => {
        setLogs(prev => [...prev.slice(-50), data]); 
        const progressMatch = data.match(/(\d+\.?\d*)%/);
        if (progressMatch) {
          setOverallProgress(parseFloat(progressMatch[1]));
        }
      });
      return cleanup;
    }
  }, []);

  React.useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const recentProjects = useLiveQuery(() => db.projects.orderBy('lastModified').reverse().limit(10).toArray());

  const handleUnpack = () => {
    const urls = cloudUrls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    const newItems: QueueItem[] = urls.map(url => ({
      id: Math.random().toString(36).substr(2, 9),
      url,
      status: 'idle'
    }));
    setQueue([...queue, ...newItems]);
    setCloudUrls('');
  };

  const playSound = (type: 'success' | 'warning' | 'error' | 'fatal') => {
    const ctx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;

    if (type === 'success') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now); 
      osc.frequency.exponentialRampToValueAtTime(783.99, now + 0.2); 
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    } else if (type === 'warning') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.linearRampToValueAtTime(165, now + 0.4);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    } else {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.linearRampToValueAtTime(30, now + 1.2);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.2);
    }

    osc.start();
    osc.stop(now + 1.2);
  };

  const handleClearFinished = () => setQueue(prev => prev.filter(q => q.status !== 'success'));
  const handleOpenFolder = () => window.electronAPI?.openMusicFolder();

  const handleCancel = async () => {
    isCancelledRef.current = true;
    if (window.electronAPI) {
      await window.electronAPI.ytdlpCancel();
      playSound('warning');
      setLogs(prev => [...prev, "!!! SYSTEM RECOVERY: ALL PROCESSES PURGED !!!"]);
    }
  };

  const processQueue = async () => {
    setIsProcessing(true);
    isCancelledRef.current = false;
    setOverallProgress(0);
    setLogs(prev => [...prev, "--- Starting Batch Process ---"]);

    for (let i = 0; i < queue.length; i++) {
      if (isCancelledRef.current) break;
      if (queue[i].status === 'success') continue;

      const item = queue[i];
      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' } : q));

      try {
        if (!window.electronAPI) {
          throw new Error('System Link Offline: Native Bridge Not Found');
        }

        const res = await window.electronAPI.ytdlpDownload(item.url, { quality: ingestQuality });
        if (!res.success) throw new Error(res.error);

        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success' } : q));
      } catch (e: any) {
        if (isCancelledRef.current) {
          setLogs(prev => [...prev, `Process Interrupted: ${item.url}`]);
        } else {
          console.error('Queue error:', e);
          playSound('fatal');
          setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: e.message } : q));
        }
      }
    }

    if (isCancelledRef.current) {
      setLogs(prev => [...prev, "Batch processing aborted by user."]);
    } else {
      setLogs(prev => [...prev, "--- Batch Complete ---"]);
      playSound('success');
    }
    setIsProcessing(false);
    setShowRipple(true);
    setTimeout(() => setShowRipple(false), 2000);
  };

  const handleConsoleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      setConsoleFontSize(prev => Math.min(Math.max(prev - (e.deltaY > 0 ? 1 : -1), 10), 32));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col gap-16 py-12 px-10 overflow-hidden relative h-[calc(100vh-60px)]"
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
      <div className="flex justify-between items-end shrink-0">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 px-3 py-1 bg-[var(--color-primary-container)] text-[var(--color-on-primary-container)] rounded-full w-fit">
            <Activity className="w-3 h-3" />
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--color-on-primary-container)]">Mastering Suite v2.0 - YT-DLP Engaged</span>
          </div>
          <h1 className="text-7xl font-black tracking-tighter uppercase leading-[0.8] text-[var(--color-on-surface)]">
            Studio<br /><span className="text-[var(--color-primary)] opacity-40 italic">Archives</span>
          </h1>
        </div>

        <div className="flex gap-4 p-2 bg-[var(--color-surface-variant)] rounded-2xl border border-white/5">
          <button onClick={() => setActiveTab('local')} className={cn("px-6 py-2 rounded-xl text-xs font-black uppercase transition-all", activeTab === 'local' ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-lg" : "opacity-40 hover:opacity-100")}>Local Storage</button>
          <button onClick={() => setActiveTab('cloud')} className={cn("px-6 py-2 rounded-xl text-xs font-black uppercase transition-all", activeTab === 'cloud' ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-lg" : "opacity-40 hover:opacity-100")}>YT-DLP</button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-10 flex-1 min-h-0">

        {/* LEFT PANEL */}
        <div className="col-span-12 lg:col-span-5 flex flex-col gap-6 min-h-0 h-full">
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
                <div className="my-card bg-[var(--color-surface-variant)] p-8 flex flex-col gap-6 flex-1 min-h-0">
                  <div className="flex items-center justify-between text-[var(--color-primary)]">
                    <div className="flex items-center gap-4">
                      <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                        <button 
                          onClick={() => setIngestQuality('mp3')} 
                          disabled={isProcessing}
                          className={cn("px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all", ingestQuality === 'mp3' ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "opacity-30 hover:opacity-100")}
                        >MP3</button>
                        <button 
                          onClick={() => setIngestQuality('wav')} 
                          disabled={isProcessing}
                          className={cn("px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all", ingestQuality === 'wav' ? "bg-[var(--color-primary)] text-[var(--color-on-primary)]" : "opacity-30 hover:opacity-100")}
                        >WAV</button>
                      </div>
                      <button 
                        onClick={handleOpenFolder}
                        className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/5 group"
                        title="Open Music Folder"
                      >
                        <Plus className="w-4 h-4 opacity-40 group-hover:opacity-100 rotate-45 transform" />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 flex-1 min-h-0">
                    <p className="text-[10px] font-black uppercase opacity-40">Direct Import URL(s)</p>
                    <textarea
                      value={cloudUrls}
                      onChange={(e) => setCloudUrls(e.target.value)}
                      placeholder="https://soundcloud.com/artist/track..."
                      className="h-24 bg-black/20 rounded-2xl p-6 font-mono text-xs focus:ring-2 focus:ring-[var(--color-primary)] outline-none resize-none border border-white/5 text-[var(--color-on-surface)]"
                    />
                  </div>

                  <div className="flex-1 bg-black/40 rounded-3xl border border-white/5 overflow-hidden flex flex-col min-h-0">
                    <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-white/5">
                      <div className="flex items-center gap-3">
                        <Terminal className="w-3 h-3 text-[var(--color-primary)] opacity-40" />
                        <span className="text-[8px] font-black uppercase opacity-40 tracking-widest">System Monitor</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-[8px] font-black uppercase opacity-20 tracking-widest">Ctrl+Scroll to Zoom</span>
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500/50" />
                          <div className="w-1.5 h-1.5 rounded-full bg-yellow-500/50" />
                          <div className="w-1.5 h-1.5 rounded-full bg-green-500/50" />
                        </div>
                      </div>
                    </div>
                    
                    {isProcessing && (
                      <div className="h-1 w-full bg-white/5 relative overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${overallProgress}%` }}
                          className="absolute top-0 left-0 h-full bg-[var(--color-primary)] shadow-[0_0_15px_var(--color-primary)]"
                        />
                      </div>
                    )}

                    <div 
                      onWheel={handleConsoleWheel}
                      className="p-6 font-mono overflow-y-auto custom-scrollbar flex-1 whitespace-pre-wrap opacity-90 leading-relaxed cursor-ns-resize"
                      style={{ fontSize: `${consoleFontSize}px` }}
                    >
                      {logs.length === 0 ? (
                        <span className="opacity-20 italic">Waiting for process start...</span>
                      ) : (
                        logs.map((log, i) => (
                          <div key={i} className="mb-1">{log}</div>
                        ))
                      )}
                      <div ref={logEndRef} />
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <button onClick={handleUnpack} disabled={!cloudUrls || isProcessing} className="flex-1 my-button font-black uppercase tracking-widest disabled:opacity-20 hover:bg-[var(--color-surface)]">Unpack Links</button>
                    {isProcessing ? (
                      <button onClick={handleCancel} className="flex-1 my-button bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white font-black uppercase tracking-widest flex items-center justify-center gap-3 active:scale-95 transition-all">
                        <Trash2 className="w-4 h-4" />
                        Force Kill
                      </button>
                    ) : (
                      <button onClick={processQueue} disabled={queue.length === 0 || isProcessing} className="flex-1 my-button my-button-primary font-black uppercase tracking-widest disabled:opacity-20 flex items-center gap-3">
                        {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        Start Ingest
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT PANEL */}
        <div className="col-span-12 lg:col-span-7 flex flex-col gap-6 min-h-0">
          <div className="flex items-center gap-4 px-2">
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40 text-[var(--on-surface)]">
              {activeTab === 'local' ? 'Recent Archives' : 'Production Queue'}
            </h2>
            {activeTab === 'cloud' && queue.some(q => q.status === 'success') && (
              <button 
                onClick={handleClearFinished}
                className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all opacity-40 hover:opacity-100 border border-white/5"
              >
                Clear Finished
              </button>
            )}
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
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "p-5 rounded-[24px] flex items-center gap-5 border transition-all duration-500",
                      item.status === 'idle' && "bg-white/[0.03] border-white/5",
                      item.status === 'processing' && "bg-[var(--color-primary-container)] border-[var(--color-primary)] animate-pulse",
                      item.status === 'success' && "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-2xl scale-[1.02]",
                      item.status === 'error' && "bg-red-500/10 border-red-500"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg",
                      item.status === 'idle' && "bg-white/5",
                      item.status === 'processing' && "bg-[var(--color-primary)]",
                      item.status === 'success' && "bg-[var(--color-on-primary)]",
                      item.status === 'error' && "bg-red-500"
                    )}>
                      {item.status === 'idle' && <Music className="w-5 h-5 opacity-20" />}
                      {item.status === 'processing' && <Loader2 className="w-5 h-5 animate-spin text-[var(--color-on-primary)]" />}
                      {item.status === 'success' && <CheckCircle2 className="w-5 h-5 text-[var(--color-primary)]" />}
                      {item.status === 'error' && <AlertTriangle className="w-5 h-5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-[11px] font-black uppercase tracking-tight truncate",
                        item.status === 'success' ? "text-[var(--color-on-primary)]" : "text-[var(--color-on-surface)]"
                      )}>{item.url}</p>
                      {item.error ? (
                        <p className="text-[9px] text-red-500 font-bold uppercase truncate mt-1">{item.error}</p>
                      ) : (
                        <p className={cn(
                          "text-[8px] font-black uppercase opacity-40 mt-1",
                          item.status === 'success' ? "text-[var(--color-on-primary)]" : ""
                        )}>{item.status}</p>
                      )}
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
