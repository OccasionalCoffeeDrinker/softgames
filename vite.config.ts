import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  /**
   * Base URL for GitHub Pages deployment.
   * Set VITE_BASE env var to the repo name (e.g. "/softgames/") in the CI workflow.
   * Defaults to "./" for local dev and generic static hosting.
   */
  base: process.env['VITE_BASE'] ?? './',

  resolve: {
    alias: {
      '@app': resolve(__dirname, 'src/app'),
      '@core': resolve(__dirname, 'src/core'),
      '@features': resolve(__dirname, 'src/features'),
      '@scenes': resolve(__dirname, 'src/scenes'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@app-types': resolve(__dirname, 'src/types'),
    },
  },

  build: {
    target: 'es2020',
    outDir: 'dist',
    /** Raise the warning limit; pixi.js is intentionally large. */
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        /** Split vendor (pixi) from app code for better caching. */
        manualChunks: {
          pixi: ['pixi.js'],
        },
      },
    },
  },

  server: {
    port: 3000,
    open: true,
  },

  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/**/*.d.ts'],
    },
  },
});
