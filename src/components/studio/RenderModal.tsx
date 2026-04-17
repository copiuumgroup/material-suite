import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Video, FileAudio, Settings } from 'lucide-react';
import { cn } from '../../utils';

export interface RenderConfig {
  type: 'audio' | 'video';
  audioFormat: 'mp3' | 'wav';
  videoResolution: '720p' | '1080p';
  videoPreset: string;
  videoProfile: string;
  videoFps: '24' | '30' | '60';
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRender: (config: RenderConfig) => void;
}

export const RenderModal: React.FC<Props> = ({ isOpen, onClose, onRender }) => {
  const [config, setConfig] = useState<RenderConfig>({
    type: 'audio',
    audioFormat: 'mp3',
    videoResolution: '1080p',
    videoPreset: 'fast',
    videoProfile: 'main',
    videoFps: '30'
  });

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] suite-glass-deep border border-[var(--color-outline)] shadow-2xl z-[160] overflow-hidden flex flex-col rounded-[var(--radius-container)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-outline)] bg-[var(--color-surface)]/50">
              <h2 className="text-sm font-black uppercase tracking-widest text-[var(--color-on-surface)] flex items-center gap-2">
                <Settings className="w-4 h-4 text-[var(--color-primary)]" />
                Render Options
              </h2>
              <button
                onClick={onClose}
                className="p-2 opacity-50 hover:opacity-100 transition-opacity rounded-[var(--radius-element)] hover:bg-[var(--color-surface)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 flex flex-col gap-8">
              {/* Type Selection */}
              <div className="flex bg-[var(--color-surface)] p-1 rounded-[var(--radius-element)] border border-[var(--color-outline)]">
                <button
                  onClick={() => setConfig({ ...config, type: 'audio' })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wider rounded-[var(--radius-element)] transition-all",
                    config.type === 'audio' 
                      ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-md" 
                      : "opacity-50 hover:opacity-100"
                  )}
                >
                  <FileAudio className="w-4 h-4" /> Audio (Master)
                </button>
                <button
                  onClick={() => setConfig({ ...config, type: 'video' })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold uppercase tracking-wider rounded-[var(--radius-element)] transition-all",
                    config.type === 'video' 
                      ? "bg-[var(--color-primary)] text-[var(--color-on-primary)] shadow-md" 
                      : "opacity-50 hover:opacity-100"
                  )}
                >
                  <Video className="w-4 h-4" /> Video (MP4)
                </button>
              </div>

              {/* Options */}
              <div className="flex flex-col gap-4">
                {config.type === 'audio' ? (
                  <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Audio Format</span>
                    <select 
                      value={config.audioFormat}
                      onChange={(e) => setConfig({ ...config, audioFormat: e.target.value as 'mp3' | 'wav' })}
                      className="suite-input py-2 text-xs"
                    >
                      <option value="mp3">MP3 (320kbps CBR)</option>
                      <option value="wav">WAV (32-bit Float LE Lossless)</option>
                    </select>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Resolution</span>
                        <select 
                          value={config.videoResolution}
                          onChange={(e) => setConfig({ ...config, videoResolution: e.target.value as '720p' | '1080p' })}
                          className="suite-input py-2 text-xs"
                        >
                          <option value="720p">720p (HD, Faster)</option>
                          <option value="1080p">1080p (FHD, Slower)</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Encoder Preset</span>
                        <select 
                          value={config.videoPreset}
                          onChange={(e) => setConfig({ ...config, videoPreset: e.target.value })}
                          className="suite-input py-2 text-xs"
                        >
                          <option value="ultrafast">Ultrafast (Large File)</option>
                          <option value="superfast">Superfast</option>
                          <option value="veryfast">Veryfast</option>
                          <option value="faster">Faster</option>
                          <option value="fast">Fast</option>
                          <option value="medium">Medium (Small File)</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Framerate</span>
                        <select 
                          value={config.videoFps}
                          onChange={(e) => setConfig({ ...config, videoFps: e.target.value as '24' | '30' | '60' })}
                          className="suite-input py-2 text-xs"
                        >
                          <option value="24">24 FPS (Fastest)</option>
                          <option value="30">30 FPS (Standard)</option>
                          <option value="60">60 FPS (Slowest)</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 mt-2">
                        <div className="flex justify-between items-center bg-[var(--color-surface)]/40 p-3 rounded-[var(--radius-element)] border border-[var(--color-outline)]">
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Multiplexed Audio</span>
                            <span className="text-[10px] font-mono text-[var(--color-primary)]">320kbps AAC</span>
                        </div>
                        <div className="flex justify-between items-center bg-[var(--color-surface)]/40 p-3 rounded-[var(--radius-element)] border border-[var(--color-outline)]">
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-70">Visual Processing</span>
                            <span className="text-[10px] font-mono text-[var(--color-primary)]">Monochrome Blur Overlay</span>
                        </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[var(--color-outline)] bg-[var(--color-surface)]/30 flex justify-end gap-4 mt-auto">
              <button onClick={onClose} className="suite-button suite-button-outline px-8">
                Cancel
              </button>
              <button onClick={() => { onRender(config); onClose(); }} className="suite-button suite-button-primary px-12">
                Commit Render
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
