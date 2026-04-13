import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { useRef, useState } from 'react';
import { studioAPI } from './services/engine/MaterialStudioAPI';

export function useExporter() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const ffmpegRef = useRef<FFmpeg>(new FFmpeg());

  const load = async () => {
    const ffmpeg = ffmpegRef.current;
    if (ffmpeg.loaded) return;

    studioAPI.emitStudioLog("Loading FFmpeg Production Core...");
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    ffmpeg.on('progress', ({ progress }) => {
      setProgress(Math.round(progress * 100));
    });
    
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  };

  const exportAudio = async (
    audioBuffer: AudioBuffer,
    format: 'wav' | 'mp3',
    kbps: string,
    filename: string
  ) => {
    setIsExporting(true);
    setProgress(0);
    try {
      await load();
      const ffmpeg = ffmpegRef.current;

      studioAPI.emitStudioLog(`Exporting at ${kbps}kbps with 32-bit float precision...`);

      // Convert to 32-bit float WAV (f32le)
      const wavData = audioBufferToWav32(audioBuffer);
      await ffmpeg.writeFile('input.wav', new Uint8Array(wavData));

      const outName = `output.${format}`;
      const realName = filename.replace(/\.(mp3|wav|ogg|flac)$/i, '');
      
      if (format === 'mp3') {
        const br = kbps === '320' ? '320' : kbps;
        // Use high-quality CBR settings for MP3
        await ffmpeg.exec([
           '-i', 'input.wav', 
           '-codec:a', 'libmp3lame', 
           '-b:a', `${br}k`,
           '-ar', '44100',
           '-ac', '2',
           outName
        ]);
      } else {
        await ffmpeg.exec(['-i', 'input.wav', outName]);
      }

      const data = await ffmpeg.readFile(outName) as Uint8Array;
      const blob = new Blob([data as any], { type: `audio/${format}` });
      
      studioAPI.emitStudioLog(`Mastering Complete: ${realName}.${format}`);
      return blob;
    } catch (e) {
      studioAPI.emitStudioLog(`EXPORT ERROR: ${e}`);
      return null;
    } finally {
      setIsExporting(false);
      setProgress(0);
    }
  };

  return { exportAudio, isExporting, progress };
}

/**
 * Generates a 32-bit Float LE (f32le) WAV file from an AudioBuffer.
 * This ensures "Lossless" internal quality before final encoding.
 */
function audioBufferToWav32(buffer: AudioBuffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 3; // IEEE Float
  const bitDepth = 32;
  const bytesPerSample = 4;
  const blockAlign = numChannels * bytesPerSample;
  
  const dataByteLength = buffer.length * numChannels * bytesPerSample;
  const bufferLength = 44 + dataByteLength;
  const arrayBuffer = new ArrayBuffer(bufferLength);
  const view = new DataView(arrayBuffer);
  
  function writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataByteLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataByteLength, true);
  
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const s = buffer.getChannelData(channel)[i];
      view.setFloat32(offset, s, true);
      offset += 4;
    }
  }
  
  return arrayBuffer;
}
