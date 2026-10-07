import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['11_TESTS/**/*.test.ts'],
    testTimeout: 120000,
    hookTimeout: 120000,
  },
  resolve: {
    alias: {
      '@ui': path.resolve(__dirname, '01_UI'),
      '@browser': path.resolve(__dirname, '02_BROWSER'),
      '@hardware': path.resolve(__dirname, '03_HARDWARE'),
      '@licensing': path.resolve(__dirname, '04_LICENSING'),
      '@auth': path.resolve(__dirname, '05_AUTH'),
      '@database': path.resolve(__dirname, '06_DATABASE'),
      '@backend': path.resolve(__dirname, '07_BACKEND'),
      '@security': path.resolve(__dirname, '08_SECURITY'),
      '@automation': path.resolve(__dirname, '09_AUTOMATION'),
      '@config': path.resolve(__dirname, '10_CONFIG'),
      '@shared': path.resolve(__dirname, '10_CONFIG/shared'),
      '@renderer': path.resolve(__dirname, '01_UI'),
      '@main': path.resolve(__dirname, '07_BACKEND'),
    },
  },
});
