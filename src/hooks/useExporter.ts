import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { useRef, useState } from 'react';
import { studioAPI } from '../services/engine/MaterialStudioAPI';

export interface VideoExportOptions {
  audioBuffer: AudioBuffer;
  filename: string;
  resolution: '720p' | '1080p';
  preset: string;
  profile: string;
  coverArtBase64?: string;
  title?: string;
  artist?: string;
  includeText?: boolean;
  videoFps?: '24' | '30' | '60';
}

export function useExporter() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const ffmpegRef = useRef<FFmpeg>(new FFmpeg());

  const load = async () => {
    const ffmpeg = ffmpegRef.current;
    if (ffmpeg.loaded) return;

    studioAPI.emitStudioLog("Loading FFmpeg Production Core...");
    const baseURL = '/ffmpeg';
    ffmpeg.on('progress', ({ progress }) => {
      setProgress(Math.round(progress * 100));
    });
    
    ffmpeg.on('log', ({ message }) => {
      console.log('[FFmpeg Engine]', message);
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

  const exportVideo = async (options: VideoExportOptions) => {
    setIsExporting(true);
    setProgress(0);
    try {
      await load();
      const ffmpeg = ffmpegRef.current;
      
      const { audioBuffer, filename, resolution, preset, profile, coverArtBase64, videoFps = '30' } = options;
      const resString = resolution === '1080p' ? '1920x1080' : '1280x720';
      const [width, height] = resolution === '1080p' ? [1920, 1080] : [1280, 720];

      studioAPI.emitStudioLog(`Preparing Video Render: ${resolution} H.264 (${preset})`);

      // 1. Write Audio
      const wavData = audioBufferToWav32(audioBuffer);
      await ffmpeg.writeFile('input.wav', new Uint8Array(wavData));

      // 2. Write Image
      let hasImage = false;
      let coverExt = 'jpg';

      let finalCover = coverArtBase64;
      
      // If the user imports a track without a thumbnail, we programmatically draw the "Applied Effects" plate!
      if (!finalCover) {
          const canvas = document.createElement('canvas');
          canvas.width = 1920;
          canvas.height = 1080;
          const ctx = canvas.getContext('2d')!;
          
          ctx.fillStyle = '#09090b';
          ctx.fillRect(0, 0, 1920, 1080);
          
          ctx.strokeStyle = '#27272a';
          ctx.lineWidth = 4;
          ctx.strokeRect(40, 40, 1840, 1000);
          
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = '900 80px system-ui, sans-serif';
          
          const cleanTitle = filename.replace(/\.(mp3|wav|ogg|flac|mp4)$/i, '');
          ctx.fillText(cleanTitle, 1920 / 2, 1080 / 2);
          
          finalCover = canvas.toDataURL('image/jpeg', 0.9);
      }

      if (finalCover) {
        try {
          const match = finalCover.match(/^data:image\/(\w+);base64,/);
          if (match) coverExt = match[1] === 'jpeg' ? 'jpg' : match[1];

          const base64Data = finalCover.replace(/^data:image\/\w+;base64,/, '');
          const binaryString = window.atob(base64Data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
              bytes[i] = binaryString.charCodeAt(i);
          }
          await ffmpeg.writeFile(`cover.${coverExt}`, bytes);
          hasImage = true;
        } catch (e) {
          studioAPI.emitStudioLog(`Warning: Failed to decode coverart for video.`);
        }
      }

      const outName = `output.mp4`;
      const realName = filename.replace(/\.(mp3|wav|ogg|flac)$/i, '');

      // Calculate audio duration
      const durationSecs = audioBuffer.length / audioBuffer.sampleRate;

      // Build FFmpeg command
      const execArgs = [
        '-i', 'input.wav'
      ];

      if (hasImage) {
        execArgs.push('-loop', '1', '-framerate', videoFps, '-i', `cover.${coverExt}`);
        
        // Complex filter graph for the Vizzy.io style
        const fgHeight = resolution === '1080p' ? 600 : 400; // Scale artwork to fit nicely
        
        // bg: Scale to fill -> BoxBlur 20px -> Grayscale
        // fg: Scale to fixed height (ensure divisible by 2 with -2 instead of -1 to prevent libx264 crashes)
        // out: Overlay fg onto bg in the center
        const filterGraph = `[1:v]scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},boxblur=20:5,hue=s=0[bg];[1:v]scale=-2:${fgHeight}[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[out]`;
        
        execArgs.push('-filter_complex', filterGraph, '-map', '[out]', '-map', '0:a');
      } else {
        // Absolute Fallback (Used only if Canvas crashes)
        execArgs.push('-f', 'lavfi', '-i', `color=c=black:s=${resString}:r=${videoFps}`);
        execArgs.push('-map', '1:v', '-map', '0:a');
        execArgs.push('-shortest');
      }

      // Encode Video (H.264) and Audio (AAC/MP3 at 320k)
      // Note: standard WASM libx264 configs
      execArgs.push(
        '-c:v', 'libx264',
        '-preset', preset,
        '-profile:v', profile,
        '-r', videoFps, // Enforce output framerate
        '-b:a', '320k', // Enforce 320kbps audio
        '-c:a', 'aac',  // Use aac for mp4 compatibility
        '-pix_fmt', 'yuv420p', // Standard pixel format for web players
        '-t', durationSecs.toString(), // Ensure video ends exactly when audio ends
        '-y', // Overwrite
        outName
      );

      await ffmpeg.exec(execArgs);

      const data = await ffmpeg.readFile(outName) as Uint8Array;
      const blob = new Blob([data as any], { type: 'video/mp4' });
      
      studioAPI.emitStudioLog(`Video Render Complete: ${realName}.mp4`);
      return blob;
    } catch (e) {
      studioAPI.emitStudioLog(`VIDEO EXPORT ERROR: ${e}`);
      return null;
    } finally {
      setIsExporting(false);
      setProgress(0);
    }
  };

  return { exportAudio, exportVideo, isExporting, progress };
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
