import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudDownload, Loader2, CheckCircle2, AlertTriangle, Search, Activity } from 'lucide-react';
import IngestStage from '../components/IngestStage';
import { studioAPI } from '../services/engine/MaterialStudioAPI';

interface StagedItem {
  id: string;
  url: string;
  info: any;
}

interface QueueItem {
  id: string;
  url: string;
  title?: string;
  uploader?: string;
  status: 'idle' | 'processing' | 'success' | 'error';
  error?: string;
}

interface Props {
  uiMode: 'material' | 'metro';
}

const YTDLPView: React.FC<Props> = ({ uiMode }) => {
  const isMetro = uiMode === 'metro';
  const [cloudUrls, setCloudUrls] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStaging, setIsStaging] = useState(false);
  
  const [masterLogs, setMasterLogs] = useState<string[]>([]);
  
  const [overallProgress, setOverallProgress] = useState(0);
  const [ingestMode, setIngestMode] = useState<'audio' | 'video'>('audio');
  const [ingestQuality] = useState<'mp3' | 'wav'>('mp3');
  
  const [targetDirectory, setTargetDirectory] = useState<string>('');
  const logEndRef = useRef<HTMLDivElement>(null);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getMusicPath().then(path => setTargetDirectory(path));
    }
  }, []);

  useEffect(() => {
    // Unified Session Feed
    const unsubDownloads = studioAPI.subscribeToDownloads((data) => {
      setMasterLogs(prev => [...prev.slice(-100), data]);
      const progressMatch = data.match(/(\d+\.?\d*)%/);
      if (progressMatch) setOverallProgress(parseFloat(progressMatch[1]));
    });

    const unsubStudio = studioAPI.subscribeToStudio((data) => {
      setMasterLogs(prev => [...prev.slice(-100), data]);
    });

    return () => {
      unsubDownloads();
      unsubStudio();
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [masterLogs]);

  const handleUnpack = async () => {
    const urls = cloudUrls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (urls.length === 0) return;

    setIsStaging(true);
    setStatusMessage("Connecting to remote infrastructure...");
    setCloudUrls('');
    studioAPI.emitStudioLog(`[Ingest] Analyzing ${urls.length} remote targets...`);

    for (const url of urls) {
      if (window.electronAPI) {
        setStatusMessage(`Fetching metadata: ${url.substring(0, 30)}...`);
        const res = await window.electronAPI.ytdlpGetInfo(url);
        if (res.success && res.infos) {
          const newStaged = res.infos.map((info: any) => ({
             id: Math.random().toString(36).substr(2, 9),
             url: info.webpage_url || url,
             info
          }));
          setStagedItems(prev => [...prev, ...newStaged]);
          setStatusMessage(null);
        } else {
          studioAPI.emitStudioLog(`[Metadata Error] ${url}: ${res.error}`);
          setStatusMessage(`Error: ${res.error}`);
          setTimeout(() => setStatusMessage(null), 3000);
        }
      } else {
        setStatusMessage("Native Bridge Offline");
      }
    }
    setIsStaging(false);
  };

  const commitToQueue = (item: StagedItem) => {
    setQueue(prev => [...prev, {
      id: item.id,
      url: item.url,
      title: item.info.title,
      uploader: item.info.uploader,
      status: 'idle'
    }]);
    setStagedItems(prev => prev.filter(s => s.id !== item.id));
  };

  const handleSelectDirectory = async () => {
    if (window.electronAPI) {
      const path = await window.electronAPI.selectDownloadDirectory();
      if (path) setTargetDirectory(path);
    }
  };

  const commitAllToQueue = () => {
    const newItems = stagedItems.map(item => ({
      id: item.id,
      url: item.url,
      title: item.info.title,
      uploader: item.info.uploader,
      status: 'idle' as const
    }));
    setQueue(prev => [...prev, ...newItems]);
    setStagedItems([]);
    studioAPI.emitStudioLog(`[Ingest] Committed ${newItems.length} items to production queue.`);
  };

  const processQueue = async () => {
    setIsProcessing(true);
    isCancelledRef.current = false;
    setOverallProgress(0);
    studioAPI.emitStudioLog("--- yt-dlp Session Started ---");

    for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
      if (isCancelledRef.current || item.status === 'success') continue;

      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' } : q));

      try {
        if (!window.electronAPI) throw new Error('Native Bridge Offline');
        const res = await window.electronAPI.ytdlpDownload(item.url, { 
          quality: ingestQuality,
          mode: ingestMode,
          destinationPath: targetDirectory
        });
        if (!res.success) throw new Error(res.error);
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success' } : q));
      } catch (e: any) {
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: e.message } : q));
      }
    }
    studioAPI.emitStudioLog("--- yt-dlp Session Complete ---");
    setIsProcessing(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: isMetro ? -100 : 0 }} 
      animate={{ opacity: 1, x: 0 }} 
      className="flex-1 flex flex-col gap-10 py-12 px-10 overflow-hidden relative"
    >
      {/* Giant Windows 8.1 Header */}
      {isMetro && (
           <div className="absolute top-[-20px] left-[-20px] pointer-events-none opacity-[0.03] select-none z-0">
               <h1 className="text-[240px] font-black uppercase tracking-tighter leading-none">YT<br/>DLP</h1>
               <p className="text-[20px] font-bold tracking-[1em] ml-4 mt-[-40px]">NATIVE INGEST MODE</p>
           </div>
       )}

      <div className="flex justify-between items-end shrink-0 relative z-10">
        <div className="flex flex-col gap-2">
          <h1 className={cn("font-black tracking-tighter uppercase leading-[0.7] text-[var(--color-on-surface)] select-none", isMetro ? "text-9xl" : "text-7xl")}>
            yt<br /><span className="text-[var(--color-primary)] opacity-20 italic">dlp</span>
          </h1>
          <span className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40 ml-1">Native Ingest Node</span>
        </div>
        {statusMessage && (
            <motion.div 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }}
                className={cn("px-6 py-3 border border-[var(--color-primary)] font-black text-[10px] uppercase", isMetro ? "" : "rounded-full")}
            >
                {statusMessage}
            </motion.div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-10 flex-1 min-h-0 relative z-10">
        <div className="col-span-12 lg:col-span-12 xl:col-span-8 flex flex-col gap-6 min-h-0">
            <div className={cn("p-10 flex flex-col gap-8 flex-1 min-h-0 overflow-y-auto custom-scrollbar border border-[var(--color-outline)]", isMetro ? "bg-black" : "m3-glass-subtle rounded-5xl shadow-xl")}>
                <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-black uppercase tracking-tighter">Request Ingest</h2>
                    <div className="flex bg-[var(--color-surface)]/40 p-1 rounded-full border border-[var(--color-outline)] gap-1">
                            {(['audio', 'video'] as const).map(m => (
                                <button key={m} onClick={() => setIngestMode(m)} className={cn("px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all", ingestMode === m ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-lg" : "opacity-30 hover:opacity-100")}>{m}</button>
                            ))}
                    </div>
                </div>
                <div className="relative group">
                    <textarea
                    value={cloudUrls}
                    onChange={(e) => setCloudUrls(e.target.value)}
                    placeholder="Paste yt-dlp target URLs..."
                    className="w-full h-40 m3-input resize-none p-8 font-mono text-[11px] leading-relaxed"
                    />
                    <button 
                        onClick={handleUnpack} 
                        disabled={!cloudUrls || isStaging} 
                        className={cn(
                            "absolute bottom-6 right-6 m3-button m3-button-primary shadow-[0_20px_40px_rgba(var(--color-primary-rgb),0.1)]",
                            isMetro ? "rounded-none shadow-none" : ""
                        )}
                    >
                        {isStaging ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Search className={cn("w-4 h-4", isMetro ? "fill-current" : "")} />
                        )} Fetch Metadata
                    </button>
                </div>
                </div>

                <AnimatePresence>
                {stagedItems.length > 0 && (
                    <div className="flex flex-col gap-6">
                        <div className="flex items-center justify-between px-2">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30">Stage Container ({stagedItems.length})</h3>
                            <button 
                                onClick={commitAllToQueue}
                                className={cn(
                                    "px-6 py-2 bg-[var(--color-primary)] text-[var(--color-on-primary)] text-[9px] font-black uppercase tracking-widest transition-all",
                                    isMetro ? "rounded-none" : "rounded-full shadow-lg hover:scale-105 active:scale-95"
                                )}
                            >
                                Queue All ({stagedItems.length})
                            </button>
                        </div>
                        <div className="grid grid-cols-1 gap-6">
                            {stagedItems.map(item => (
                                <IngestStage 
                                    key={item.id} 
                                    info={item.info} 
                                    onRemove={() => setStagedItems(prev => prev.filter(s => s.id !== item.id))}
                                    onCommit={() => commitToQueue(item)}
                                    isProcessing={isProcessing}
                                    uiMode={uiMode}
                                />
                            ))}
                        </div>
                    </div>
                )}
                </AnimatePresence>
            </div>
        </div>

        <div className="col-span-12 lg:col-span-12 xl:col-span-4 flex flex-col gap-6 min-h-0">
            <div className={cn("flex-1 flex flex-col min-h-0 border border-[var(--color-outline)] shadow-2xl overflow-hidden", isMetro ? "bg-black" : "m3-glass-subtle rounded-5xl")}>
                <div className="p-8 border-b border-[var(--color-outline)] flex items-center gap-3 shrink-0">
                   <Activity className="w-5 h-5 opacity-40" />
                   <h3 className="text-xs font-black uppercase tracking-widest">Master Session Feed</h3>
                </div>
                
                <div className="flex-1 p-8 font-mono text-[10px] overflow-y-auto custom-scrollbar leading-relaxed">
                    <div className="flex flex-col gap-1">
                        {masterLogs.length === 0 ? (
                           <span className="italic opacity-10 py-10">Waiting for ingest stream...</span> 
                        ) : (
                           masterLogs.map((log, i) => (
                               <div key={i} className={cn(
                                   "mb-2 border-l-2 pl-4 py-1",
                                   log.includes('[Error]') ? "border-red-500 text-red-500" : 
                                   log.includes('[Ingest]') ? "border-blue-500 text-blue-500" :
                                   "border-[var(--color-outline)] opacity-40"
                               )}>
                                   {log}
                               </div>
                           ))
                        )}
                        <div ref={logEndRef} />
                    </div>
                </div>

                {isProcessing && (
                    <div className="h-1.5 w-full bg-[var(--color-surface)]/10 relative overflow-hidden shrink-0">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${overallProgress}%` }} className="absolute h-full bg-[var(--color-primary)] shadow-[0_0_20px_var(--color-primary)]" />
                    </div>
                )}

                <div className="p-10 shrink-0 bg-[var(--color-surface)]/20 border-t border-[var(--color-outline)] flex flex-col gap-6">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Target Vault Node</span>
                            <button 
                                onClick={handleSelectDirectory}
                                className={cn("text-[9px] font-black uppercase tracking-widest text-[var(--color-primary)] hover:opacity-100", isMetro ? "opacity-100 underline" : "opacity-40")}
                            >
                                Change Path
                            </button>
                        </div>
                        <div className={cn(
                            "px-4 py-3 font-mono text-[9px] border border-[var(--color-outline)] truncate",
                            isMetro ? "bg-black" : "bg-[var(--color-surface)]/40 rounded-2xl"
                        )} title={targetDirectory}>
                            {targetDirectory || 'Fetching Default Path...'}
                        </div>
                    </div>

                    <div className="flex items-center justify-between px-2">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Session Queue</span>
                        <div className="m3-chip">{queue.length}</div>
                    </div>
                    
                    <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                        {queue.map(item => (
                            <div key={item.id} className={cn("p-4 rounded-3xl border flex items-center gap-4 transition-all duration-500", item.status === 'success' ? "bg-[var(--color-primary)]/5 border-[var(--color-outline)] text-[var(--color-on-surface)]" : item.status === 'processing' ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-2xl scale-[1.02]" : "bg-[var(--color-surface)]/40 border-[var(--color-outline)] opacity-40")}>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black uppercase truncate tracking-tight">{item.title || item.url}</p>
                                    <p className="text-[8px] font-bold opacity-60 uppercase mt-0.5 tracking-widest">{item.status}</p>
                                </div>
                                {item.status === 'success' ? <CheckCircle2 className="w-4 h-4 opacity-40" /> : item.status === 'error' ? <AlertTriangle className="w-4 h-4 text-red-500" /> : item.status === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            </div>
                        ))}
                    </div>

                    <button 
                        onClick={processQueue} 
                        disabled={queue.length === 0 || isProcessing} 
                        className={cn(
                            "m3-button m3-button-primary w-full py-5 text-[11px] shadow-[0_20px_50px_rgba(var(--color-primary-rgb),0.1)]",
                            isMetro ? "rounded-none shadow-none" : ""
                        )}
                    >
                        {isProcessing ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <CloudDownload className={cn("w-5 h-5", isMetro ? "fill-current" : "")} />
                        )} Pull from Cloud
                    </button>
                </div>
            </div>
        </div>
      </div>
    </motion.div>
  );
};

function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}

export default YTDLPView;
