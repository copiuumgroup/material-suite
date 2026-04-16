import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import fs from 'fs'
import path from 'path'

const metadata = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'build-metadata.json'), 'utf-8'))
const buildId = metadata.buildId || '000'

export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(buildId)
  },
  plugins: [
    react(), 
    tailwindcss(),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              external: [
                'electron',
                'music-metadata',
                'node-id3',
                'axios',
                'fs',
                'path',
                'url',
                'child_process'
              ],
              onwarn(warning, warn) {
                if (warning.code === 'INVALID_OPTION' && warning.message.includes('"freeze"')) return;
                if (warning.message.includes('customResolver')) return;
                warn(warning);
              }
            }
          }
        }
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
      },
    ]),
    renderer(),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('framer-motion') || id.includes('lucide-react')) {
              return 'vendor-ui';
            }
            if (id.includes('react')) {
              return 'vendor-react';
            }
            if (id.includes('dexie')) {
              return 'vendor-db';
            }
            return 'vendor'; // all other deps
          }
        }
      }
    }
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
})
