import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));

/**
 * Authorizes Vite React Refresh's inline preamble in `vite dev` via its SHA-256 digest
 * so `index.html` and `app.html` enforce strict `script-src 'self'` without `'unsafe-inline'`.
 */
function devReactRefreshCspPlugin(): Plugin {
  return {
    name: 'mahi-dev-csp-hash',
    apply: 'serve',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const hashes: string[] = [];
        const inlineScriptRe = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
        for (const match of html.matchAll(inlineScriptRe)) {
          const body = match[1];
          if (body && body.includes('/@react-refresh')) {
            const digest = crypto.createHash('sha256').update(body, 'utf8').digest('base64');
            hashes.push(`'sha256-${digest}'`);
          }
        }
        if (hashes.length === 0) return html;
        return html.replace("script-src 'self';", `script-src 'self' ${hashes.join(' ')};`);
      },
    },
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    devReactRefreshCspPlugin(),
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
                'electron-updater',
                'sql.js',
                'node:fs',
                'node:path',
                'node:crypto',
                'node:child_process',
                'node:http',
                'node:https',
                'node:net',
                'node:os',
                'node:url',
                'node:zlib',
                'rebrowser-playwright-core',
                'fingerprint-generator',
                'header-generator',
                '@aws-sdk/client-s3',
                '@aws-sdk/s3-request-presigner',
                'fastify',
                '@fastify/cors',
                'ioredis',
                '@prisma/client',
                '@prisma/adapter-pg',
                'pg',
                '.prisma/client',
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
            lib: {
              entry: '10_CONFIG/preload/index.ts',
              formats: ['cjs'],
              fileName: () => 'index.cjs',
            },
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
                entryFileNames: 'index.cjs',
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
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        app: path.resolve(__dirname, 'app.html'),
      },
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-icons': ['lucide-react'],
          'vendor-state': ['zustand', 'zod'],
        },
      },
    },
  },
});
