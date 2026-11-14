import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'node:path';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    electron([
      {
        entry: '07_BACKEND/index.ts',
        vite: {
          define: {
            __APP_VERSION__: JSON.stringify(pkg.version),
          },
          build: {
            outDir: 'dist-electron/main',
            rollupOptions: {
              external: [
                'electron',
                'sql.js',
                'node:fs',
                'node:path',
                'node:crypto',
                'node:child_process',
                'node:http',
                'node:net',
                'node:os',
                'node:url',
                'playwright-core',
              ],
            },
          },
        },
      },
      {
        entry: '10_CONFIG/preload/index.ts',
        vite: {
          build: {
            outDir: 'dist-electron/preload',
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, '01_UI'),
      '@shared': path.resolve(__dirname, '10_CONFIG/shared'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
