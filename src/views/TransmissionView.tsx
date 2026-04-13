import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloudDownload, Loader2, CheckCircle2, AlertTriangle, Search, Activity, Download } from 'lucide-react';
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

const TransmissionView: React.FC = () => {
  const [consoleTab, setConsoleTab] = useState<'downloads' | 'studio'>('downloads');
  const [cloudUrls, setCloudUrls] = useState('');
  const [stagedItems, setStagedItems] = useState<StagedItem[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStaging, setIsStaging] = useState(false);
  
  const [downloadLogs, setDownloadLogs] = useState<string[]>([]);
  const [studioLogs, setStudioLogs] = useState<string[]>([]);
  
  const [overallProgress, setOverallProgress] = useState(0);
  const [ingestMode, setIngestMode] = useState<'audio' | 'video'>('audio');
  const [ingestQuality] = useState<'mp3' | 'wav'>('mp3');
  
  const logEndRef = useRef<HTMLDivElement>(null);
  const isCancelledRef = useRef(false);

  useEffect(() => {
    // Subscribe to Download Logs
    const unsubDownloads = studioAPI.subscribeToDownloads((data) => {
      setDownloadLogs(prev => [...prev.slice(-100), data]);
      const progressMatch = data.match(/(\d+\.?\d*)%/);
      if (progressMatch) setOverallProgress(parseFloat(progressMatch[1]));
    });

    // Subscribe to Studio Logs
    const unsubStudio = studioAPI.subscribeToStudio((data) => {
      setStudioLogs(prev => [...prev.slice(-100), data]);
    });

    return () => {
      unsubDownloads();
      unsubStudio();
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [downloadLogs, studioLogs, consoleTab]);

  const handleUnpack = async () => {
    const urls = cloudUrls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
    if (urls.length === 0) return;

    setIsStaging(true);
    setCloudUrls('');
    studioAPI.emitStudioLog(`[Ingest] Analyzing ${urls.length} remote targets...`);

    for (const url of urls) {
      if (window.electronAPI) {
        const res = await window.electronAPI.ytdlpGetInfo(url);
        if (res.success) {
          setStagedItems(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), url, info: res.info }]);
        } else {
          studioAPI.emitStudioLog(`[Metadata Error] ${url}: ${res.error}`);
        }
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

  const processQueue = async () => {
    setIsProcessing(true);
    isCancelledRef.current = false;
    setOverallProgress(0);
    studioAPI.emitStudioLog("--- Transmission Session Started ---");

    for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
      if (isCancelledRef.current || item.status === 'success') continue;

      setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'processing' } : q));

      try {
        if (!window.electronAPI) throw new Error('Native Bridge Offline');
        const res = await window.electronAPI.ytdlpDownload(item.url, { 
          quality: ingestQuality,
          mode: ingestMode
        });
        if (!res.success) throw new Error(res.error);
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success' } : q));
      } catch (e: any) {
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: e.message } : q));
      }
    }
    studioAPI.emitStudioLog("--- Transmission Session Complete ---");
    setIsProcessing(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }} 
      animate={{ opacity: 1, x: 0 }} 
      className="flex-1 flex flex-col gap-10 py-12 px-10 overflow-hidden"
    >
      <div className="flex justify-between items-end shrink-0">
        <div className="flex flex-col gap-2">
          <h1 className="text-8xl font-black tracking-tighter uppercase leading-[0.7] text-[var(--color-on-surface)] select-none">
            Material<br /><span className="text-[var(--color-primary)] opacity-20 italic">Transmission</span>
          </h1>
          <span className="text-[10px] font-black uppercase tracking-[0.5em] opacity-40 ml-1">Native Ingestion Hub</span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-10 flex-1 min-h-0">
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6 min-h-0">
            <div className="m3-card bg-black/20 p-10 flex flex-col gap-8 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-black uppercase tracking-tighter">Request Ingest</h2>
                    <div className="flex bg-black p-1 rounded-full border border-[var(--color-outline)] gap-1">
                            {(['audio', 'video'] as const).map(m => (
                                <button key={m} onClick={() => setIngestMode(m)} className={cn("px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all", ingestMode === m ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-lg" : "opacity-30 hover:opacity-100")}>{m}</button>
                            ))}
                    </div>
                </div>
                <div className="relative group">
                    <textarea
                    value={cloudUrls}
                    onChange={(e) => setCloudUrls(e.target.value)}
                    placeholder="Paste transmission target URLs..."
                    className="w-full h-40 m3-input resize-none p-8 font-mono text-[11px] leading-relaxed"
                    />
                    <button 
                        onClick={handleUnpack} 
                        disabled={!cloudUrls || isStaging} 
                        className="absolute bottom-6 right-6 m3-button m3-button-primary shadow-[0_20px_40px_rgba(255,255,255,0.05)]"
                    >
                        {isStaging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Fetch Metadata
                    </button>
                </div>
                </div>

                <AnimatePresence>
                {stagedItems.length > 0 && (
                    <div className="flex flex-col gap-6">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] opacity-30 px-2">Stage Container ({stagedItems.length})</h3>
                        <div className="grid grid-cols-1 gap-6">
                            {stagedItems.map(item => (
                                <IngestStage 
                                    key={item.id} 
                                    info={item.info} 
                                    onRemove={() => setStagedItems(prev => prev.filter(s => s.id !== item.id))}
                                    onCommit={() => commitToQueue(item)}
                                    isProcessing={isProcessing}
                                />
                            ))}
                        </div>
                    </div>
                )}
                </AnimatePresence>
            </div>
        </div>

        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6 min-h-0">
            <div className="flex-1 bg-[var(--color-surface-variant)] rounded-5xl flex flex-col min-h-0 border border-[var(--color-outline)] shadow-2xl overflow-hidden">
                <div className="p-1.5 bg-black/40 border-b border-[var(--color-outline)] flex">
                   {(['downloads', 'studio'] as const).map(t => (
                      <button 
                        key={t}
                        onClick={() => setConsoleTab(t)}
                        className={cn(
                          "flex-1 py-3 flex items-center justify-center gap-2 text-[8px] font-black uppercase tracking-widest transition-all",
                          consoleTab === t ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] rounded-2xl shadow-lg" : "opacity-30 hover:opacity-100"
                        )}
                      >
                         {t === 'downloads' ? <Download className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                         {t}
                      </button>
                   ))}
                </div>
                
                <div className="flex-1 p-8 font-mono text-[10px] overflow-y-auto custom-scrollbar leading-relaxed">
                    <div className="h-full flex flex-col">
                        {consoleTab === 'downloads' ? (
                           downloadLogs.length === 0 ? <span className="italic opacity-10 py-10">Waiting...</span> : downloadLogs.map((log, i) => <div key={i} className="mb-2 border-l border-white/10 pl-4 opacity-40">{log}</div>)
                        ) : (
                           studioLogs.length === 0 ? <span className="italic opacity-10 py-10">Studio Node Idle...</span> : studioLogs.map((log, i) => <div key={i} className="mb-2 border-l border-[var(--color-primary)] pl-4 text-[var(--color-primary)] opacity-80">{log}</div>)
                        )}
                        <div ref={logEndRef} />
                    </div>
                </div>

                {isProcessing && consoleTab === 'downloads' && (
                    <div className="h-1.5 w-full bg-white/5 relative overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${overallProgress}%` }} className="absolute h-full bg-[var(--color-primary)] shadow-[0_0_20px_var(--color-primary)]" />
                    </div>
                )}

                <div className="p-10 bg-black/40 border-t border-[var(--color-outline)] flex flex-col gap-6">
                    <div className="flex items-center justify-between px-2">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Session Queue</span>
                        <div className="m3-chip">{queue.length}</div>
                    </div>
                    
                    <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                        {queue.map(item => (
                            <div key={item.id} className={cn("p-4 rounded-3xl border flex items-center gap-4 transition-all duration-500", item.status === 'success' ? "bg-white/5 border-white/10 text-white" : item.status === 'processing' ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-2xl scale-[1.02]" : "bg-black border-[var(--color-outline)] opacity-40")}>
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
                        className="m3-button m3-button-primary w-full py-5 text-[11px] shadow-[0_20px_50px_rgba(255,255,255,0.05)]"
                    >
                        {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CloudDownload className="w-5 h-5" />} Start Transmission
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

export default TransmissionView;
