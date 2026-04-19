import Dexie, { type Table } from 'dexie';

export interface ImpulseData {
  id?: number;
  name: string;
  data: ArrayBuffer;
  duration: number;
  addedAt: number;
}

export interface ProjectMetadata {
  id?: number;
  name: string;
  artist?: string;
  coverArt?: string;
  filePath?: string;
  lastModified: number;
  // Mastering State
  settings: {
    speed: number;
    reverbWet: number;
    quality: 'fast' | 'pro';
    isAutoEQEnabled: boolean;
    irId?: number;
    eq: {
      sub: number;
      bass: number;
      mid: number;
      treble: number;
      air: number;
    };
    attenuation: number;
    limiter: boolean;
    roomSize: number;
    nightcore: boolean;
  };
  detectedBpm?: number;
  detectedGenre?: string;
  sourceUrl?: string;
  archivedAt?: number;
  mediaType?: 'audio' | 'video';
  stems?: {
    vocals: string | null;
    instrumental: string | null;
  };
}

export interface StagedItem {
  id: string;
  url: string;
  info: any;
  addedAt: number;
}

export interface QueueItem {
  id: string;
  url: string;
  title?: string;
  uploader?: string;
  status: 'idle' | 'processing' | 'success' | 'error';
  error?: string;
  addedAt: number;
}

export class StudioDatabase extends Dexie {
  projects!: Table<ProjectMetadata>;
  impulses!: Table<ImpulseData>;
  stagedItems!: Table<StagedItem>;
  downloadQueue!: Table<QueueItem>;

  constructor() {
    super('StudioDatabase');
    this.version(4).stores({
      projects: '++id, name, lastModified, sourceUrl',
      impulses: '++id, name, addedAt',
      stagedItems: 'id, url, addedAt',
      downloadQueue: 'id, url, status, addedAt'
    });
  }
}

export const db = new StudioDatabase();
