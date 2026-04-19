import type { AnalysisResult } from './services/analyzer';

export interface Stems {
  vocals: string | null;
  instrumental: string | null;
}

export interface Track {
  id: string;
  file: File;
  buffer: AudioBuffer | null;
  isReady: boolean;
  metadata?: {
    title?: string;
    artist?: string;
    coverArt?: string;
  };
  internalPath?: string;
  needsRelink?: boolean;
  analysis?: AnalysisResult;
  stems?: Stems;
  dbId?: number;
}
