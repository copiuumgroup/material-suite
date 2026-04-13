import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
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
                // Suppress specific noise that we can't control from internal plugins
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
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
})
