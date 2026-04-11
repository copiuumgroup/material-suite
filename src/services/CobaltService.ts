import axios from 'axios';

export interface CobaltTrack {
  id: string;
  url: string;
  title: string;
  artist: string;
  status: 'white' | 'teal' | 'green' | 'red';
  progress: number;
}

export const CobaltService = {
  async fetchDownloadUrl(trackUrl: string, instance = 'https://api.cobalt.tools'): Promise<string> {
    try {
      const response = await axios.post(`${instance}/api/json`, {
        url: trackUrl,
        audioFormat: 'mp3',
        audioBitrate: '320',
        filenameStyle: 'basic'
      }, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (response.data?.url) return response.data.url;
      throw new Error('No download URL returned');
    } catch (e) {
      console.error('Cobalt Error:', e);
      throw e;
    }
  }
};

export const SoundCloudUnpacker = {
  async unpack(url: string): Promise<Partial<CobaltTrack>[]> {
    // If it's a single track, just return it
    if (url.includes('/sets/') === false) {
      return [{ url, id: Math.random().toString(36).substr(2, 9), status: 'white', progress: 0 }];
    }

    // For playlists/albums, we'll use a simple proxy or internal logic 
    // In a real Electron app, we'd fetch the HTML and parse.
    // Simplifying for this demo by assuming single tracks or calling a main process helper.
    return [{ url, id: Math.random().toString(36).substr(2, 9), status: 'white', progress: 0 }];
  }
};
