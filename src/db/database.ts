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
}

export class StudioDatabase extends Dexie {
  projects!: Table<ProjectMetadata>;
  impulses!: Table<ImpulseData>;

  constructor() {
    super('StudioDatabase');
    this.version(3).stores({
      projects: '++id, name, lastModified, sourceUrl',
      impulses: '++id, name, addedAt'
    });
  }
}

export const db = new StudioDatabase();
