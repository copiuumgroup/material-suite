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
}
