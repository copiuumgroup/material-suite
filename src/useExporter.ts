import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { useRef, useState } from 'react';

export function useExporter() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const ffmpegRef = useRef<FFmpeg>(new FFmpeg());

  const load = async () => {
    const ffmpeg = ffmpegRef.current;
    if (ffmpeg.loaded) return;

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

      const wavData = audioBufferToWav(audioBuffer);
      await ffmpeg.writeFile('input.wav', new Uint8Array(wavData));

      const outName = `output.${format}`;
      
      const realName = filename.replace(/\.(mp3|wav|ogg|flac)$/i, '');
      
      if (format === 'mp3') {
        const br = parseInt(kbps) > 320 ? '320' : kbps; // Cap at 320 for mp3
        await ffmpeg.exec(['-i', 'input.wav', '-b:a', `${br}k`, outName]);
      } else {
        await ffmpeg.exec(['-i', 'input.wav', outName]);
      }

      const data = await ffmpeg.readFile(outName) as Uint8Array;
      const blob = new Blob([data as any], { type: `audio/${format}` });
      
      // Browser download (Only if not in Electron)
      if (!window.electronAPI) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `material-${format === 'mp3' ? kbps + 'k-' : ''}${realName}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
      }

      return blob;
    } catch (e) {
      console.error("Export Error", e);
      return null;
    } finally {
      setIsExporting(false);
      setProgress(0);
    }
  };

  return { exportAudio, isExporting, progress };
}

function audioBufferToWav(buffer: AudioBuffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  
  const bufferData = new Float32Array(buffer.length * numChannels);
  for (let i = 0; i < buffer.numberOfChannels; i++) {
    const channelData = buffer.getChannelData(i);
    for (let j = 0; j < buffer.length; j++) {
      bufferData[j * numChannels + i] = channelData[j];
    }
  }
  
  const dataByteLength = bufferData.length * bytesPerSample;
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
  for (let i = 0; i < bufferData.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, bufferData[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  
  return arrayBuffer;
}
